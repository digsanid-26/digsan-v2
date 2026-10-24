import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { Db } from './graph.repository';
import { PermissionService } from './permission.service';
import { changesFrom, staleFields, toLayoutPatch, toPersonData, type Changes, type Snapshot } from './profile-change.util';

const EXPIRES_DAYS = 30;
const LABEL: Record<string, string> = {
  displayName: 'nama', sex: 'jenis kelamin', vitalStatus: 'status hidup/wafat', photo: 'foto',
  birthDate: 'tanggal lahir', deathDate: 'tanggal wafat', birthPlace: 'tempat lahir',
};
const describeChanges = (c: Changes) => Object.keys(c).map((f) => LABEL[f] ?? f).join(', ');

/**
 * F2-02 — change proposals. A relative who may only PROPOSE (authority
 * matrix) gets their edit queued for the person's approvers; anyone with
 * DIRECT authority applies it right away. Applied changes are written back
 * to every tree that draws the person, so all views agree.
 */
@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationService,
  ) {}

  static standalone(prisma: PrismaService, permissions: PermissionService) {
    const noop = { create: async () => null, sendPushSafe: async () => undefined };
    return new ProposalService(prisma, permissions, noop as unknown as NotificationService);
  }

  // ─── applying ────────────────────────────────────────────────

  /** Update the Person, audit it, and mirror it into every tree that draws it. */
  async apply(db: Db, personId: string, changes: Changes, actorId: string, source: string, extra: Record<string, unknown> = {}, originTreeId?: string) {
    await db.person.update({ where: { id: personId }, data: { ...toPersonData(changes), version: { increment: 1 } } as any });
    await db.personRevision.create({ data: { personId, actorId, source, diff: { ...changes, ...extra } as any } });
    await this.writeBack(db, personId, changes, originTreeId);
  }

  private async writeBack(db: Db, personId: string, changes: Changes, originTreeId?: string) {
    const values = Object.fromEntries(Object.entries(changes).map(([f, c]) => [f, c!.to]));
    const patch = toLayoutPatch(values);
    // Ordered by tree so concurrent write-backs lock trees in the same order.
    const maps = await db.legacyNodeMap.findMany({ where: { personId, NOT: { nodeKey: { startsWith: 'fm:' } } }, orderBy: { treeId: 'asc' } });
    for (const m of maps) {
      const snapshot = { ...((m.snapshot as Snapshot) ?? {}) };
      for (const f of ['displayName', 'sex', 'vitalStatus', 'photo'] as const) if (f in values) snapshot[f] = values[f] as any;
      await db.legacyNodeMap.update({ where: { id: m.id }, data: { snapshot } });
      if (m.treeId === originTreeId || !Object.keys(patch).length) continue;
      await db.$queryRaw`SELECT id FROM family_trees WHERE id = ${m.treeId} FOR UPDATE`;
      const tree = await db.familyTree.findUnique({ where: { id: m.treeId }, select: { layoutMembers: true } });
      const members = { ...((tree?.layoutMembers as Record<string, any>) ?? {}) };
      members[m.nodeKey] = { ...(members[m.nodeKey] ?? {}), ...patch };
      await db.familyTree.update({ where: { id: m.treeId }, data: { layoutMembers: members } });
    }
  }

  // ─── proposing ───────────────────────────────────────────────

  /** Queue a proposal (supersedes the proposer's previous pending one for this person). */
  async propose(db: Db, input: { personId: string; proposerId: string; treeId?: string | null; changes: Changes; note?: string | null }) {
    await db.changeProposal.updateMany({
      where: { personId: input.personId, proposerId: input.proposerId, status: 'PENDING' },
      data: { status: 'SUPERSEDED', decidedAt: new Date() },
    });
    const p = await db.changeProposal.create({
      data: {
        personId: input.personId,
        proposerId: input.proposerId,
        treeId: input.treeId ?? null,
        changes: input.changes as any,
        note: input.note ?? null,
        expiresAt: new Date(Date.now() + EXPIRES_DAYS * 86_400_000),
      },
    });
    return p.id;
  }

  /** After commit: tell the approvers. */
  async notifyCreated(proposalIds: string[]) {
    for (const id of proposalIds) {
      const p = await this.prisma.changeProposal.findUnique({ where: { id }, include: { person: { select: { displayName: true } } } });
      if (!p || p.status !== 'PENDING') continue;
      const proposer = await this.prisma.user.findUnique({ where: { id: p.proposerId }, select: { name: true } });
      const msg = `${proposer?.name ?? 'Anggota keluarga'} mengusulkan perubahan ${describeChanges(p.changes as Changes)} untuk "${p.person.displayName}".`;
      for (const userId of await this.permissions.approvers([p.personId])) {
        if (userId === p.proposerId) continue;
        this.notifications.create({
          userId, type: 'SYSTEM' as any, title: 'Usulan perubahan data keluarga', message: msg,
          data: { kind: 'CHANGE_PROPOSAL', proposalId: id },
        }).catch(() => undefined);
        this.notifications.sendPushSafe(userId, 'Usulan perubahan data keluarga', msg).catch(() => undefined);
      }
    }
  }

  /** Propose (or, with DIRECT authority, apply) a change through the API. */
  async submit(actor: { userId: string; roles: string[] }, personId: string, input: Record<string, unknown>, note?: string) {
    const verdict = await this.permissions.can(actor, 'person.edit', personId);
    if (verdict.decision === 'DENY') throw new ForbiddenException(verdict.reason);
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException('Orang tidak ditemukan');
    const changes = changesFrom(input, person as any);
    if (!Object.keys(changes).length) throw new BadRequestException('Tidak ada perubahan');

    if (verdict.decision === 'DIRECT') {
      await this.prisma.$transaction((tx) => this.apply(tx, personId, changes, actor.userId, 'API'));
      return { status: 'APPLIED' as const };
    }
    const id = await this.propose(this.prisma, { personId, proposerId: actor.userId, changes, note });
    await this.notifyCreated([id]);
    return { status: 'PENDING' as const, id };
  }

  // ─── deciding ────────────────────────────────────────────────

  private async expireOld() {
    await this.prisma.changeProposal.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
  }

  async list(userId: string, box: 'incoming' | 'outgoing') {
    await this.expireOld();
    const where: Prisma.ChangeProposalWhereInput = box === 'outgoing'
      ? { proposerId: userId }
      : { status: 'PENDING', personId: { in: await this.permissions.managedPersonIds(userId) }, proposerId: { not: userId } };
    const rows = await this.prisma.changeProposal.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 100,
      include: { person: { select: { id: true, displayName: true, photo: true } } },
    });
    const names = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.proposerId))] } }, select: { id: true, name: true } }))
        .map((u) => [u.id, u.name]),
    );
    const out = [];
    for (const r of rows) {
      // Incoming: only what this user may actually decide.
      if (box === 'incoming' && !(await this.permissions.approvers([r.personId])).includes(userId)) continue;
      out.push({
        id: r.id, status: r.status, person: r.person, changes: r.changes, note: r.note,
        proposer: { id: r.proposerId, name: names.get(r.proposerId) ?? null },
        createdAt: r.createdAt, expiresAt: r.expiresAt, decidedAt: r.decidedAt,
      });
    }
    return out;
  }

  async decide(actor: { userId: string; roles: string[] }, proposalId: string, approve: boolean) {
    await this.expireOld();
    const p = await this.prisma.changeProposal.findUnique({ where: { id: proposalId } });
    if (!p) throw new NotFoundException('Usulan tidak ditemukan');
    if (p.status !== 'PENDING') throw new BadRequestException('Usulan ini sudah tidak menunggu keputusan');
    if (p.proposerId === actor.userId) throw new ForbiddenException('Usulan sendiri tidak bisa diputuskan sendiri');
    if (!(await this.permissions.approvers([p.personId])).includes(actor.userId)) {
      throw new ForbiddenException('Anda bukan pengelola orang ini');
    }

    if (approve) {
      await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.findUnique({ where: { id: p.personId } });
        if (!person || person.mergedIntoId) throw new BadRequestException('Data orang ini sudah tidak aktif');
        const stale = staleFields(p.changes as Changes, person as any);
        if (stale.length) {
          await tx.changeProposal.update({ where: { id: p.id }, data: { status: 'SUPERSEDED', decidedAt: new Date(), decidedById: actor.userId } });
          return;
        }
        await this.apply(tx, p.personId, p.changes as Changes, actor.userId, 'PROPOSAL', { proposalId: p.id, proposerId: p.proposerId });
        await tx.changeProposal.update({ where: { id: p.id }, data: { status: 'APPROVED', decidedAt: new Date(), decidedById: actor.userId } });
      });
    } else {
      await this.prisma.changeProposal.update({ where: { id: p.id }, data: { status: 'REJECTED', decidedAt: new Date(), decidedById: actor.userId } });
    }

    const after = await this.prisma.changeProposal.findUniqueOrThrow({ where: { id: p.id }, include: { person: { select: { displayName: true } } } });
    if (after.status === 'SUPERSEDED') {
      throw new ConflictException('Data sudah berubah sejak usulan dibuat; usulan ditutup. Minta pengusul mengirim ulang bila masih perlu.');
    }
    const verb = after.status === 'APPROVED' ? 'disetujui' : 'ditolak';
    this.notifications.create({
      userId: p.proposerId, type: 'SYSTEM' as any, title: `Usulan ${verb}`,
      message: `Usulan perubahan ${describeChanges(p.changes as Changes)} untuk "${after.person.displayName}" ${verb}.`,
      data: { kind: 'CHANGE_PROPOSAL_RESULT', proposalId: p.id, status: after.status },
    }).catch((err) => this.logger.warn(`notify proposer failed: ${err}`));
    return { id: p.id, status: after.status };
  }

  async withdraw(userId: string, proposalId: string) {
    const p = await this.prisma.changeProposal.findUnique({ where: { id: proposalId } });
    if (!p || p.proposerId !== userId) throw new NotFoundException('Usulan tidak ditemukan');
    if (p.status !== 'PENDING') throw new BadRequestException('Usulan ini sudah tidak menunggu keputusan');
    await this.prisma.changeProposal.update({ where: { id: p.id }, data: { status: 'WITHDRAWN', decidedAt: new Date() } });
    return { id: p.id, status: 'WITHDRAWN' as const };
  }
}
