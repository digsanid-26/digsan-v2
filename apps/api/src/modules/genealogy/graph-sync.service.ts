import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { GraphRepository, type Db } from './graph.repository';
import { checkGraph, type GraphIssue } from './graph-rules.util';
import { familyMembersToGraphDraft, layoutToGraphDraft, type DraftPerson, type GraphDraft } from './layout-graph.util';
import { findMergeCandidates } from './merge-rules.util';
import { MergeService } from './merge.service';

export interface SyncReport {
  trees: number;
  personsCreated: number;
  personsReusedByAccount: number;
  personsUpdated: number;
  personsDeleted: number;
  mapsCreated: number;
  mapsRemoved: number;
  unionsCreated: number;
  parentagesCreated: number;
  relationsRemoved: number;
  cyclesSkipped: { treeId: string; parentKey: string; childKey: string }[];
  unmapped: { treeId: string; keys: string[] }[];
  errors: { treeId: string; error: string }[];
}

export interface BackfillReport extends SyncReport {
  dryRun: boolean;
  totals: { persons: number; accountPersons: number; placeholders: number; parentages: number; unions: number };
  /** F2-04 — likely duplicates that would be proposed for merging. */
  mergeCandidates: number;
  issues: { counts: Record<string, number>; samples: GraphIssue[] };
}

const emptyReport = (): SyncReport => ({
  trees: 0, personsCreated: 0, personsReusedByAccount: 0, personsUpdated: 0, personsDeleted: 0,
  mapsCreated: 0, mapsRemoved: 0, unionsCreated: 0, parentagesCreated: 0, relationsRemoved: 0,
  cyclesSkipped: [], unmapped: [], errors: [],
});

class DryRunRollback extends Error {}

/**
 * Projects legacy trees (layout JSON + FamilyMember rows) onto the canonical
 * graph. Idempotent: LegacyNodeMap ties each (tree, node key) to its Person,
 * GraphAssertion records which tree asserts which relationship, so re-running
 * after an edit adds, updates and retracts exactly what that tree changed.
 *
 * Persons tied to an account are shared by every tree that links that
 * account — this is what makes A-in-A's-tree and A-in-B's-tree the same row.
 */
@Injectable()
export class GraphSyncService {
  private readonly logger = new Logger(GraphSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: GraphRepository,
    private readonly config: ConfigService,
    private readonly merge: MergeService,
  ) {}

  /** F1-06 feature flag: dual-write only when GRAPH_MODEL=true. */
  get enabled(): boolean {
    return String(this.config.get('GRAPH_MODEL') ?? '').toLowerCase() === 'true';
  }

  /** Fire-and-forget dual-write after a legacy write. Never throws into the caller. */
  syncTreeInBackground(treeId: string): void {
    if (!this.enabled) return;
    this.syncTree(treeId)
      .then(() => this.merge.detectInBackground())
      .catch((err) => this.logger.error(`Graph dual-write failed for tree ${treeId}: ${err}`));
  }

  /** Re-project one tree inside its own transaction (serialised per tree). */
  async syncTree(treeId: string): Promise<SyncReport> {
    const report = emptyReport();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`graph-sync:${treeId}`}))`;
        await this.syncTreeWith(tx, treeId, report, 'LEGACY_SYNC');
      },
      { timeout: 60_000, maxWait: 30_000 },
    );
    return report;
  }

  /** Before a tree is deleted: drop its assertions and anything only it asserted. */
  async retractTree(treeId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`graph-sync:${treeId}`}))`;
      const assertions = await tx.graphAssertion.findMany({ where: { treeId } });
      const maps = await tx.legacyNodeMap.findMany({ where: { treeId }, select: { personId: true } });
      await tx.graphAssertion.deleteMany({ where: { treeId } });
      await tx.legacyNodeMap.deleteMany({ where: { treeId } });
      for (const a of assertions) {
        if (await tx.graphAssertion.count({ where: { kind: a.kind, targetId: a.targetId } })) continue;
        if (a.kind === 'PARENTAGE') await tx.parentage.deleteMany({ where: { id: a.targetId } });
        else await tx.union.deleteMany({ where: { id: a.targetId } });
      }
      for (const { personId } of maps) {
        const p = await tx.person.findUnique({
          where: { id: personId },
          select: { userId: true, _count: { select: { legacyNodes: true, asParent: true, asChild: true, unionsAsA: true, unionsAsB: true } } },
        });
        const c = p?._count;
        if (p && !p.userId && c && c.legacyNodes + c.asParent + c.asChild + c.unionsAsA + c.unionsAsB === 0) {
          await tx.person.delete({ where: { id: personId } });
        }
      }
    }, { timeout: 60_000, maxWait: 30_000 });
  }

  /**
   * F1-04 / F1-05 — project every tree. With `dryRun` (default) everything runs
   * inside one transaction that is rolled back at the end, so the report shows
   * the real outcome on real data without persisting anything.
   */
  async backfill(opts: { dryRun?: boolean } = {}): Promise<BackfillReport> {
    const dryRun = opts.dryRun !== false;
    const report = emptyReport() as BackfillReport;
    report.dryRun = dryRun;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const trees = await tx.familyTree.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
          for (const t of trees) {
            await tx.$executeRaw`SAVEPOINT tree_sync`;
            try {
              await this.syncTreeWith(tx, t.id, report, 'BACKFILL');
              await tx.$executeRaw`RELEASE SAVEPOINT tree_sync`;
            } catch (err) {
              await tx.$executeRaw`ROLLBACK TO SAVEPOINT tree_sync`;
              report.errors.push({ treeId: t.id, error: String(err) });
            }
          }
          await this.summarise(tx, report);
          if (dryRun) throw new DryRunRollback();
        },
        { timeout: 30 * 60_000, maxWait: 60_000 },
      );
    } catch (err) {
      if (!(err instanceof DryRunRollback)) throw err;
    }
    if (!dryRun) await this.merge.detect();
    this.logger.log(
      `Graph backfill ${dryRun ? '(dry-run, rolled back)' : '(applied)'}: ${report.trees} trees, ` +
      `${report.personsCreated} persons created, ${report.parentagesCreated} parentages, ${report.unionsCreated} unions, ` +
      `${report.errors.length} errors`,
    );
    return report;
  }

  private async summarise(db: Db, report: BackfillReport) {
    const [persons, accountPersons, placeholders, parentages, unions] = await Promise.all([
      db.person.count(),
      db.person.count({ where: { userId: { not: null } } }),
      db.person.count({ where: { isPlaceholder: true } }),
      db.parentage.count(),
      db.union.count(),
    ]);
    report.totals = { persons, accountPersons, placeholders, parentages, unions };
    const all = await this.graph.loadAll(db);
    const issues = checkGraph(all);
    const people = await db.person.findMany({ select: { id: true, displayName: true, sex: true, isPlaceholder: true, userId: true, mergedIntoId: true, createdAt: true } });
    report.mergeCandidates = findMergeCandidates(all, new Map(people.map((p) => [p.id, p]))).length;
    const counts: Record<string, number> = {};
    for (const i of issues) counts[i.code] = (counts[i.code] ?? 0) + 1;
    report.issues = { counts, samples: issues.slice(0, 50) };
  }

  // ─── core ────────────────────────────────────────────────────

  private async syncTreeWith(db: Prisma.TransactionClient, treeId: string, report: SyncReport, source: 'BACKFILL' | 'LEGACY_SYNC') {
    const tree = await db.familyTree.findUnique({
      where: { id: treeId },
      select: {
        id: true, userId: true, layoutConfig: true, layoutMembers: true, marriageStatus: true,
        user: { select: { name: true } },
        members: {
          select: { id: true, userId: true, name: true, gender: true, deathDate: true, photo: true, isCreator: true, parentId: true, spouseId: true, childOrder: true },
        },
      },
    });
    if (!tree) return;
    report.trees += 1;

    const drafts: GraphDraft[] = [
      layoutToGraphDraft({
        ownerUserId: tree.userId,
        ownerName: tree.user?.name ?? '',
        config: tree.layoutConfig as Record<string, any>,
        members: tree.layoutMembers as Record<string, any>,
        marriageStatus: tree.marriageStatus,
      }),
    ];
    if (tree.members.length) drafts.push(familyMembersToGraphDraft(tree.members, tree.userId));
    for (const d of drafts) if (d.unmapped.length) report.unmapped.push({ treeId, keys: d.unmapped });

    // 1. Persons + legacy maps
    const existingMaps = await db.legacyNodeMap.findMany({ where: { treeId } });
    const mapByKey = new Map(existingMaps.map((m) => [m.nodeKey, m]));
    const personOf = new Map<string, string>();
    for (const d of drafts) {
      for (const p of d.persons.values()) {
        personOf.set(p.key, await this.resolvePerson(db, tree.userId, p, mapByKey.get(p.key)?.personId, report, source));
      }
    }
    const liveKeys = new Set(personOf.keys());
    const orphanCandidates = new Set<string>();
    for (const [key, personId] of personOf) {
      const m = mapByKey.get(key);
      if (!m) {
        await db.legacyNodeMap.create({ data: { treeId, nodeKey: key, personId } });
        report.mapsCreated += 1;
      } else if (m.personId !== personId) {
        await db.legacyNodeMap.update({ where: { id: m.id }, data: { personId } });
        orphanCandidates.add(m.personId);
      }
    }
    const staleMaps = existingMaps.filter((m) => !liveKeys.has(m.nodeKey));
    if (staleMaps.length) {
      await db.legacyNodeMap.deleteMany({ where: { id: { in: staleMaps.map((m) => m.id) } } });
      report.mapsRemoved += staleMaps.length;
      for (const m of staleMaps) orphanCandidates.add(m.personId);
    }

    const accountOf = new Map<string, string | null>();
    for (const d of drafts) for (const p of d.persons.values()) accountOf.set(personOf.get(p.key)!, p.userId);
    const ownerPersonId = personOf.get('self');
    const statusFor = (a: string, b: string) => {
      const third = [a, b].filter((id) => accountOf.get(id) && id !== ownerPersonId && accountOf.get(id) !== tree.userId);
      return third.length === 2 ? 'PROPOSED' as const : 'CONFIRMED' as const;
    };

    // 2. Unions
    const asserted: { kind: 'PARENTAGE' | 'UNION'; targetId: string }[] = [];
    const unionIdOf = new Map<string, string>();
    for (const d of drafts) {
      for (const u of d.unions) {
        const a = personOf.get(u.aKey)!;
        const b = personOf.get(u.bKey)!;
        if (!a || !b || a === b) continue;
        let row = await db.union.findFirst({
          where: { OR: [{ partnerAId: a, partnerBId: b }, { partnerAId: b, partnerBId: a }] },
        });
        if (!row) {
          const status = statusFor(a, b);
          row = await db.union.create({
            data: { partnerAId: a, partnerBId: b, status: u.status, confirmStatus: status, proposedById: tree.userId },
          });
          report.unionsCreated += 1;
        } else if (row.status === 'UNKNOWN' && u.status !== 'UNKNOWN') {
          row = await db.union.update({ where: { id: row.id }, data: { status: u.status } });
        }
        unionIdOf.set(`${d === drafts[0] ? 'L' : 'F'}:${u.key}`, row.id);
        asserted.push({ kind: 'UNION', targetId: row.id });
      }
    }

    // 3. Parentages (biological, assumed — legacy data never said otherwise)
    for (const d of drafts) {
      for (const p of d.parentages) {
        const parentId = personOf.get(p.parentKey);
        const childId = personOf.get(p.childKey);
        if (!parentId || !childId || parentId === childId) continue;
        const unionId = p.unionKey ? unionIdOf.get(`${d === drafts[0] ? 'L' : 'F'}:${p.unionKey}`) ?? null : null;
        let row = await db.parentage.findUnique({
          where: { parentId_childId_kind: { parentId, childId, kind: 'BIOLOGICAL' } },
        });
        if (!row) {
          if (await this.graph.isAncestor(childId, parentId, db)) {
            report.cyclesSkipped.push({ treeId, parentKey: p.parentKey, childKey: p.childKey });
            continue;
          }
          const status = statusFor(parentId, childId);
          row = await db.parentage.create({
            data: {
              parentId, childId, kind: 'BIOLOGICAL', certainty: 'ASSUMED', unionId, birthOrder: p.birthOrder,
              status, proposedById: tree.userId, confirmedAt: status === 'CONFIRMED' ? new Date() : null,
            },
          });
          report.parentagesCreated += 1;
        } else if ((row.unionId == null && unionId) || (row.birthOrder == null && p.birthOrder != null)) {
          row = await db.parentage.update({
            where: { id: row.id },
            data: { unionId: row.unionId ?? unionId, birthOrder: row.birthOrder ?? p.birthOrder },
          });
        }
        asserted.push({ kind: 'PARENTAGE', targetId: row.id });
      }
    }

    // 4. Assertions: add new, retract what this tree no longer says.
    const current = new Set(asserted.map((a) => `${a.kind}:${a.targetId}`));
    const before = await db.graphAssertion.findMany({ where: { treeId } });
    const beforeSet = new Set(before.map((a) => `${a.kind}:${a.targetId}`));
    const toAdd = asserted.filter((a, i) => !beforeSet.has(`${a.kind}:${a.targetId}`) && asserted.findIndex((x) => x.kind === a.kind && x.targetId === a.targetId) === i);
    if (toAdd.length) await db.graphAssertion.createMany({ data: toAdd.map((a) => ({ treeId, ...a })), skipDuplicates: true });
    const retracted = before.filter((a) => !current.has(`${a.kind}:${a.targetId}`));
    if (retracted.length) {
      await db.graphAssertion.deleteMany({ where: { id: { in: retracted.map((a) => a.id) } } });
      for (const r of retracted) {
        const still = await db.graphAssertion.count({ where: { kind: r.kind, targetId: r.targetId } });
        if (still) continue;
        if (r.kind === 'PARENTAGE') await db.parentage.deleteMany({ where: { id: r.targetId } });
        else await db.union.deleteMany({ where: { id: r.targetId } });
        report.relationsRemoved += 1;
      }
    }

    // 5. Orphans: unlinked persons no tree maps and no relation references.
    for (const personId of orphanCandidates) {
      const p = await db.person.findUnique({
        where: { id: personId },
        select: { userId: true, _count: { select: { legacyNodes: true, asParent: true, asChild: true, unionsAsA: true, unionsAsB: true } } },
      });
      if (!p || p.userId) continue;
      const c = p._count;
      if (c.legacyNodes + c.asParent + c.asChild + c.unionsAsA + c.unionsAsB === 0) {
        await db.person.delete({ where: { id: personId } });
        report.personsDeleted += 1;
      }
    }
  }

  /**
   * Find or create the Person for a draft node.
   * - Account-linked nodes always resolve to that account's Person (shared across trees).
   * - Otherwise the tree's LegacyNodeMap keeps the same Person across syncs.
   * Profile fields of account Persons belong to the account and are only filled when empty.
   */
  private async resolvePerson(
    db: Prisma.TransactionClient,
    ownerId: string,
    d: DraftPerson,
    mappedPersonId: string | undefined,
    report: SyncReport,
    source: 'BACKFILL' | 'LEGACY_SYNC',
  ): Promise<string> {
    const fields = {
      displayName: d.displayName,
      sex: d.sex,
      vitalStatus: d.vitalStatus,
      photo: d.photo,
      isPlaceholder: d.isPlaceholder,
      placeholderKind: d.isPlaceholder ? ('UNFILLED_SLOT' as const) : null,
    };

    // F2-05 — the circle was linked to a Person that already exists (validated
    // on save to lie within the owner's family). Follow merges to the survivor.
    if (d.graphPersonId && !d.userId) {
      let target = await db.person.findUnique({ where: { id: d.graphPersonId } });
      for (let hops = 0; target?.mergedIntoId && hops < 10; hops++) {
        target = await db.person.findUnique({ where: { id: target.mergedIntoId } });
      }
      // Account Persons are only ever linked through a confirmed link request.
      if (target && !target.mergedIntoId && !target.userId) {
        const fill: Record<string, unknown> = {};
        if (target.sex === 'UNKNOWN' && d.sex !== 'UNKNOWN') fill.sex = d.sex;
        if (!target.photo && d.photo) fill.photo = d.photo;
        if (Object.keys(fill).length) await this.updatePerson(db, target.id, fill, ownerId, source, report);
        report.personsReusedByAccount += 1;
        return target.id;
      }
    }

    if (d.userId) {
      const existing = await db.person.findUnique({ where: { userId: d.userId } });
      if (existing) {
        report.personsReusedByAccount += 1;
        const fill: Record<string, unknown> = {};
        if (existing.sex === 'UNKNOWN' && d.sex !== 'UNKNOWN') fill.sex = d.sex;
        if (!existing.photo && d.photo) fill.photo = d.photo;
        if (existing.isPlaceholder) Object.assign(fill, { isPlaceholder: false, placeholderKind: null });
        if (Object.keys(fill).length) await this.updatePerson(db, existing.id, fill, ownerId, source, report);
        return existing.id;
      }
      const user = await db.user.findUnique({ where: { id: d.userId }, select: { name: true, avatar: true } });
      if (user) {
        // An unlinked Person mapped to this node becomes the account's Person.
        if (mappedPersonId) {
          const mapped = await db.person.findUnique({ where: { id: mappedPersonId } });
          if (mapped && !mapped.userId) {
            await this.updatePerson(db, mapped.id, { userId: d.userId, isPlaceholder: false, placeholderKind: null }, ownerId, source, report);
            return mapped.id;
          }
        }
        const created = await db.person.create({
          data: { ...fields, displayName: user.name || d.displayName, photo: user.avatar || d.photo, isPlaceholder: false, placeholderKind: null, userId: d.userId, createdById: ownerId },
        });
        await db.personSteward.create({ data: { personId: created.id, userId: d.userId, role: 'OWNER' } });
        report.personsCreated += 1;
        return created.id;
      }
    }

    if (mappedPersonId) {
      const mapped = await db.person.findUnique({ where: { id: mappedPersonId } });
      if (mapped && !mapped.userId) {
        // A Person shared by several trees (e.g. after a merge) is not owned by
        // any one of them: a tree may only fill gaps, never overwrite, so two
        // trees can't keep flipping the name back and forth.
        const shared = (await db.legacyNodeMap.count({ where: { personId: mapped.id } })) > 1;
        const diff: Record<string, unknown> = {};
        if (!shared) {
          for (const [k, v] of Object.entries(fields)) if ((mapped as any)[k] !== v) diff[k] = v;
        } else {
          if (mapped.isPlaceholder && !d.isPlaceholder) Object.assign(diff, { displayName: d.displayName, isPlaceholder: false, placeholderKind: null });
          if (mapped.sex === 'UNKNOWN' && d.sex !== 'UNKNOWN') diff.sex = d.sex;
          if (!mapped.photo && d.photo) diff.photo = d.photo;
        }
        if (Object.keys(diff).length) await this.updatePerson(db, mapped.id, diff, ownerId, source, report);
        return mapped.id;
      }
    }

    const created = await db.person.create({ data: { ...fields, createdById: ownerId } });
    await db.personSteward.create({ data: { personId: created.id, userId: ownerId, role: 'PRIMARY' } });
    report.personsCreated += 1;
    return created.id;
  }

  private async updatePerson(
    db: Prisma.TransactionClient,
    personId: string,
    diff: Record<string, unknown>,
    actorId: string,
    source: string,
    report: SyncReport,
  ) {
    await db.person.update({ where: { id: personId }, data: { ...diff, version: { increment: 1 } } as any });
    await db.personRevision.create({ data: { personId, actorId, source, diff: diff as any } });
    report.personsUpdated += 1;
  }
}
