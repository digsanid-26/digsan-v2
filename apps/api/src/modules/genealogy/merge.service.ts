import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { GraphRepository, type Db } from './graph.repository';
import { chooseSurvivor, findMergeCandidates, mergeBlocker, type MergePerson } from './merge-rules.util';
import { GenealogyService } from './genealogy.service';
import { PermissionService } from './permission.service';

type Notifier = Pick<NotificationService, 'create' | 'sendPushSafe'>;

const PERSON_SELECT = {
  id: true, displayName: true, sex: true, isPlaceholder: true, userId: true, photo: true, vitalStatus: true,
  birthDate: true, birthPlace: true, deathDate: true, mergedIntoId: true, createdAt: true,
} as const;

/**
 * F2-04 / F2-06 — duplicate detection and consent-based merging of Persons.
 *
 * A candidate needs the approval of every steward of BOTH Persons (for an
 * account Person that is the account itself). Merging rewires relationships,
 * legacy node maps and assertions onto the surviving Person and leaves the
 * other as a tombstone (`mergedIntoId`) with a revision for audit.
 */
@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: GraphRepository,
    private readonly notifications: NotificationService,
    private readonly permissions: PermissionService,
  ) {}

  /** For scripts without the Nest container (no notifications). */
  static standalone(prisma: PrismaService, graph: GraphRepository) {
    const noop: Notifier = { create: async () => null as any, sendPushSafe: async () => undefined };
    const permissions = new PermissionService(prisma, new GenealogyService(prisma, graph));
    return new MergeService(prisma, graph, noop as NotificationService, permissions);
  }

  private async loadPersons(db: Db) {
    const persons = await db.person.findMany({ select: PERSON_SELECT });
    return new Map<string, MergePerson & Record<string, any>>(persons.map((p) => [p.id, p]));
  }

  /** Authority matrix (F2-01): account itself, early-access guardian, or every steward. */
  private approversOf(personIds: string[], db: Db = this.prisma): Promise<string[]> {
    return this.permissions.approvers(personIds, db);
  }

  /** Detect candidates over the whole graph; create new ones and notify their approvers. */
  async detect(): Promise<{ open: number; created: number }> {
    const g = await this.graph.loadAll();
    const persons = await this.loadPersons(this.prisma);
    const pairs = findMergeCandidates(g, persons);
    let created = 0;

    for (const pair of pairs) {
      const existing = await this.prisma.mergeCandidate.findUnique({
        where: { personAId_personBId: { personAId: pair.personAId, personBId: pair.personBId } },
      });
      if (existing) {
        if (existing.status === 'OPEN') {
          await this.prisma.mergeCandidate.update({ where: { id: existing.id }, data: { score: pair.score, reasons: pair.reasons } });
        }
        continue; // never re-propose what people already rejected or merged
      }
      let candidate;
      try {
        candidate = await this.prisma.mergeCandidate.create({
          data: { personAId: pair.personAId, personBId: pair.personBId, score: pair.score, reasons: pair.reasons },
        });
      } catch (err) {
        // A concurrent detection created it first — nothing to do.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
      created += 1;
      await this.notifyApprovers(candidate.id, persons.get(pair.personAId)!, persons.get(pair.personBId)!);
    }

    // Candidates whose people were merged/removed meanwhile are obsolete.
    const open = await this.prisma.mergeCandidate.findMany({ where: { status: 'OPEN' } });
    for (const c of open) {
      const a = persons.get(c.personAId);
      const b = persons.get(c.personBId);
      if (!a || !b || a.mergedIntoId || b.mergedIntoId) {
        await this.prisma.mergeCandidate.update({ where: { id: c.id }, data: { status: 'OBSOLETE', resolvedAt: new Date() } });
      }
    }
    const openCount = await this.prisma.mergeCandidate.count({ where: { status: 'OPEN' } });
    if (created) this.logger.log(`Merge detection: ${created} new candidate(s), ${openCount} open`);
    return { open: openCount, created };
  }

  /** Fire-and-forget detection (after a dual-write sync). */
  detectInBackground() {
    this.detect().catch((err) => this.logger.error(`Merge detection failed: ${err}`));
  }

  private async notifyApprovers(candidateId: string, a: MergePerson, b: MergePerson) {
    for (const userId of await this.approversOf([a.id, b.id])) {
      this.notifications.create({
        userId,
        type: 'SYSTEM' as any,
        title: 'Kemungkinan orang yang sama',
        message: `"${a.displayName}" dan "${b.displayName}" tampaknya orang yang sama yang tercatat dua kali di silsilah. Gabungkan?`,
        data: { kind: 'MERGE_CANDIDATE', candidateId },
      }).catch(() => undefined);
      this.notifications.sendPushSafe(userId, 'Kemungkinan orang yang sama', `${a.displayName} dan ${b.displayName} — gabungkan?`).catch(() => undefined);
    }
  }

  /** Open candidates the user is asked to decide on, with context to decide. */
  async listForUser(userId: string) {
    const stewardOf = await this.permissions.managedPersonIds(userId);
    if (!stewardOf.length) return [];
    const candidates = await this.prisma.mergeCandidate.findMany({
      where: { status: 'OPEN', OR: [{ personAId: { in: stewardOf } }, { personBId: { in: stewardOf } }] },
      include: { approvals: true },
      orderBy: { score: 'desc' },
    });
    const out = [];
    for (const c of candidates) {
      const [a, b] = await Promise.all([this.describe(c.personAId), this.describe(c.personBId)]);
      // One side was linked to an existing person / merged meanwhile → nothing left to decide.
      if (!a || !b || a.mergedIntoId || b.mergedIntoId) {
        await this.prisma.mergeCandidate.update({ where: { id: c.id }, data: { status: 'OBSOLETE', resolvedAt: new Date() } });
        continue;
      }
      const approvers = await this.approversOf([c.personAId, c.personBId]);
      if (!approvers.includes(userId)) continue;
      out.push({
        id: c.id,
        score: c.score,
        reasons: c.reasons,
        personA: a,
        personB: b,
        sharedChildren: await this.sharedChildren(c.personAId, c.personBId),
        myDecision: c.approvals.find((x) => x.userId === userId)?.approve ?? null,
        approvalsNeeded: approvers.length,
        approvalsGiven: c.approvals.filter((x) => x.approve).length,
      });
    }
    return out;
  }

  private async describe(personId: string) {
    const p = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, displayName: true, sex: true, isPlaceholder: true, photo: true, userId: true, mergedIntoId: true, legacyNodes: { select: { tree: { select: { user: { select: { name: true } } } } } } },
    });
    if (!p) return null;
    const { userId, legacyNodes, ...rest } = p;
    return { ...rest, hasAccount: !!userId, drawnBy: [...new Set(legacyNodes.map((n) => n.tree.user?.name).filter(Boolean))] };
  }

  private async sharedChildren(aId: string, bId: string) {
    const [ca, cb] = await Promise.all([
      this.prisma.parentage.findMany({ where: { parentId: aId }, select: { childId: true } }),
      this.prisma.parentage.findMany({ where: { parentId: bId }, select: { childId: true } }),
    ]);
    const shared = ca.map((x) => x.childId).filter((id) => cb.some((y) => y.childId === id));
    if (!shared.length) return [];
    return (await this.prisma.person.findMany({ where: { id: { in: shared } }, select: { displayName: true } })).map((p) => p.displayName);
  }

  /** Approve or reject; when every approver agreed the merge executes. */
  async decide(userId: string, candidateId: string, approve: boolean) {
    const candidate = await this.prisma.mergeCandidate.findUnique({ where: { id: candidateId }, include: { approvals: true } });
    if (!candidate) throw new NotFoundException('Usulan penggabungan tidak ditemukan');
    if (candidate.status !== 'OPEN') throw new BadRequestException('Usulan ini sudah diputuskan');
    const alive = await this.prisma.person.count({ where: { id: { in: [candidate.personAId, candidate.personBId] }, mergedIntoId: null } });
    if (alive !== 2) {
      await this.prisma.mergeCandidate.update({ where: { id: candidateId }, data: { status: 'OBSOLETE', resolvedAt: new Date() } });
      throw new BadRequestException('Usulan ini sudah tidak berlaku (data telah dihubungkan atau digabung)');
    }
    const approvers = await this.approversOf([candidate.personAId, candidate.personBId]);
    if (!approvers.includes(userId)) throw new ForbiddenException('Anda bukan pengelola salah satu orang ini');

    await this.prisma.mergeApproval.upsert({
      where: { candidateId_userId: { candidateId, userId } },
      create: { candidateId, userId, approve },
      update: { approve },
    });

    if (!approve) {
      await this.prisma.mergeCandidate.update({ where: { id: candidateId }, data: { status: 'REJECTED', resolvedAt: new Date() } });
      return { id: candidateId, status: 'REJECTED' as const };
    }

    const yes = new Set((await this.prisma.mergeApproval.findMany({ where: { candidateId, approve: true } })).map((a) => a.userId));
    if (!approvers.every((u) => yes.has(u))) {
      return { id: candidateId, status: 'OPEN' as const, waitingFor: approvers.filter((u) => !yes.has(u)).length };
    }
    const keepPersonId = await this.executeMerge(candidateId);
    this.detectInBackground();
    return { id: candidateId, status: 'MERGED' as const, keepPersonId };
  }

  /** Merge the two Persons of a candidate. Returns the surviving Person id. */
  async executeMerge(candidateId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('graph-merge'))`;
      const candidate = await tx.mergeCandidate.findUnique({ where: { id: candidateId } });
      if (!candidate || candidate.status !== 'OPEN') throw new BadRequestException('Usulan ini sudah diputuskan');

      const persons = await this.loadPersons(tx);
      const g = await this.graph.loadGraph(
        await this.graph.relationSubgraphIds(candidate.personAId, candidate.personBId, 60, tx),
        tx,
      );
      const blocker = mergeBlocker(g, persons, candidate.personAId, candidate.personBId);
      if (blocker) throw new ConflictException(`Tidak dapat digabung: ${blocker}`);

      const [keep, drop] = chooseSurvivor(persons.get(candidate.personAId)!, persons.get(candidate.personBId)!);
      const filled = await this.fillProfile(tx, keep, drop);
      await this.rewire(tx, keep.id, drop.id);

      await tx.person.update({ where: { id: drop.id }, data: { mergedIntoId: keep.id, version: { increment: 1 } } });
      await tx.personRevision.create({
        data: { personId: keep.id, actorId: null, source: 'MERGE', diff: { mergedFrom: drop.id, mergedName: drop.displayName, filled } as any },
      });
      await tx.personRevision.create({
        data: { personId: drop.id, actorId: null, source: 'MERGE', diff: { mergedInto: keep.id } as any },
      });
      await tx.mergeCandidate.update({
        where: { id: candidateId },
        data: { status: 'MERGED', keepPersonId: keep.id, resolvedAt: new Date() },
      });
      await tx.mergeCandidate.updateMany({
        where: { status: 'OPEN', id: { not: candidateId }, OR: [{ personAId: drop.id }, { personBId: drop.id }] },
        data: { status: 'OBSOLETE', resolvedAt: new Date() },
      });
      this.logger.log(`Merged person ${drop.id} into ${keep.id} (candidate ${candidateId})`);
      return keep.id;
    }, { timeout: 60_000, maxWait: 30_000 });
  }

  /** Fill empty profile fields of the survivor from the merged Person. */
  private async fillProfile(tx: Prisma.TransactionClient, keep: Record<string, any>, drop: Record<string, any>) {
    const fill: Record<string, unknown> = {};
    if (keep.isPlaceholder && !drop.isPlaceholder) Object.assign(fill, { displayName: drop.displayName, isPlaceholder: false, placeholderKind: null });
    if (keep.sex === 'UNKNOWN' && drop.sex !== 'UNKNOWN') fill.sex = drop.sex;
    for (const f of ['photo', 'birthDate', 'birthPlace', 'deathDate'] as const) if (!keep[f] && drop[f]) fill[f] = drop[f];
    if (keep.vitalStatus === 'LIVING' && drop.vitalStatus === 'DECEASED') fill.vitalStatus = 'DECEASED';
    if (Object.keys(fill).length) await tx.person.update({ where: { id: keep.id }, data: { ...fill, version: { increment: 1 } } as any });

    const altName = drop.displayName?.trim();
    const keepName = (fill.displayName as string) ?? keep.displayName;
    if (altName && !drop.isPlaceholder && altName.toLowerCase() !== String(keepName).trim().toLowerCase()) {
      await tx.personName.create({ data: { personId: keep.id, kind: 'ALIAS', value: altName } });
    }
    await tx.personName.updateMany({ where: { personId: drop.id }, data: { personId: keep.id } });
    return fill;
  }

  /** Move every relation, map, steward and assertion from `dropId` to `keepId`. */
  private async rewire(tx: Prisma.TransactionClient, keepId: string, dropId: string) {
    const moveAssertions = async (kind: 'PARENTAGE' | 'UNION', fromId: string, toId: string) => {
      for (const a of await tx.graphAssertion.findMany({ where: { kind, targetId: fromId } })) {
        const dup = await tx.graphAssertion.findUnique({ where: { treeId_kind_targetId: { treeId: a.treeId, kind, targetId: toId } } });
        if (dup) await tx.graphAssertion.delete({ where: { id: a.id } });
        else await tx.graphAssertion.update({ where: { id: a.id }, data: { targetId: toId } });
      }
    };

    // Unions first (parentages reference them).
    const unions = await tx.union.findMany({ where: { OR: [{ partnerAId: dropId }, { partnerBId: dropId }] } });
    for (const u of unions) {
      const a = u.partnerAId === dropId ? keepId : u.partnerAId;
      const b = u.partnerBId === dropId ? keepId : u.partnerBId;
      if (a === b) {
        await tx.graphAssertion.deleteMany({ where: { kind: 'UNION', targetId: u.id } });
        await tx.union.delete({ where: { id: u.id } });
        continue;
      }
      const existing = b
        ? await tx.union.findFirst({
          where: { id: { not: u.id }, OR: [{ partnerAId: a, partnerBId: b }, { partnerAId: b, partnerBId: a }] },
        })
        : null;
      if (existing) {
        await moveAssertions('UNION', u.id, existing.id);
        await tx.parentage.updateMany({ where: { unionId: u.id }, data: { unionId: existing.id } });
        if (existing.status === 'UNKNOWN' && u.status !== 'UNKNOWN') await tx.union.update({ where: { id: existing.id }, data: { status: u.status } });
        await tx.union.delete({ where: { id: u.id } });
      } else {
        await tx.union.update({ where: { id: u.id }, data: { partnerAId: a, partnerBId: b } });
      }
    }

    const parentages = await tx.parentage.findMany({ where: { OR: [{ parentId: dropId }, { childId: dropId }] } });
    for (const p of parentages) {
      const parentId = p.parentId === dropId ? keepId : p.parentId;
      const childId = p.childId === dropId ? keepId : p.childId;
      if (parentId === childId) {
        await tx.graphAssertion.deleteMany({ where: { kind: 'PARENTAGE', targetId: p.id } });
        await tx.parentage.delete({ where: { id: p.id } });
        continue;
      }
      const existing = await tx.parentage.findUnique({ where: { parentId_childId_kind: { parentId, childId, kind: p.kind } } });
      if (existing && existing.id !== p.id) {
        await moveAssertions('PARENTAGE', p.id, existing.id);
        await tx.parentage.update({
          where: { id: existing.id },
          data: { unionId: existing.unionId ?? p.unionId, birthOrder: existing.birthOrder ?? p.birthOrder },
        });
        await tx.parentage.delete({ where: { id: p.id } });
      } else {
        await tx.parentage.update({ where: { id: p.id }, data: { parentId, childId } });
      }
    }

    await tx.legacyNodeMap.updateMany({ where: { personId: dropId }, data: { personId: keepId } });
    // Open proposals follow the person; approving re-checks they're not stale.
    await tx.changeProposal.updateMany({ where: { personId: dropId }, data: { personId: keepId } });
    for (const s of await tx.personSteward.findMany({ where: { personId: dropId } })) {
      await tx.personSteward.upsert({
        where: { personId_userId: { personId: keepId, userId: s.userId } },
        create: { personId: keepId, userId: s.userId, role: s.role === 'OWNER' ? 'CO_STEWARD' : s.role, grantedById: s.grantedById },
        update: {},
      });
    }
    await tx.personSteward.deleteMany({ where: { personId: dropId } });
  }
}
