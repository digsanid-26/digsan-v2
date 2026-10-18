import { Injectable } from '@nestjs/common';
import { Prisma, type ParentageKind } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { buildGraph, type Graph } from './graph-rules.util';

export type Db = PrismaService | Prisma.TransactionClient;

const LINEAGE: ParentageKind[] = ['BIOLOGICAL', 'ADOPTIVE'];

/**
 * F1-08 — graph reads over PostgreSQL using recursive CTEs.
 *
 * This is the single access point for graph traversal so a Graph DB
 * implementation (Apache AGE / Neo4j, Fase 7) can replace it later without
 * touching the services above.
 */
@Injectable()
export class GraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  private kinds(kinds: ParentageKind[]) {
    return Prisma.join(kinds.map((k) => Prisma.sql`${k}::"ParentageKind"`));
  }

  /** Ancestors of `personId` with their (minimum) generation distance. */
  async ancestors(personId: string, maxDepth = 15, kinds: ParentageKind[] = LINEAGE, db: Db = this.prisma) {
    return db.$queryRaw<{ id: string; depth: number }[]>(Prisma.sql`
      WITH RECURSIVE up(id, depth) AS (
        SELECT p.parent_id, 1 FROM parentages p
        WHERE p.child_id = ${personId} AND p.kind IN (${this.kinds(kinds)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
        UNION
        SELECT p.parent_id, up.depth + 1 FROM parentages p
        JOIN up ON p.child_id = up.id
        WHERE up.depth < ${maxDepth} AND p.kind IN (${this.kinds(kinds)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
      )
      SELECT id, MIN(depth)::int AS depth FROM up GROUP BY id`);
  }

  /** Descendants of `personId` with their generation distance. */
  async descendants(personId: string, maxDepth = 15, kinds: ParentageKind[] = LINEAGE, db: Db = this.prisma) {
    return db.$queryRaw<{ id: string; depth: number }[]>(Prisma.sql`
      WITH RECURSIVE down(id, depth) AS (
        SELECT p.child_id, 1 FROM parentages p
        WHERE p.parent_id = ${personId} AND p.kind IN (${this.kinds(kinds)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
        UNION
        SELECT p.child_id, down.depth + 1 FROM parentages p
        JOIN down ON p.parent_id = down.id
        WHERE down.depth < ${maxDepth} AND p.kind IN (${this.kinds(kinds)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
      )
      SELECT id, MIN(depth)::int AS depth FROM down GROUP BY id`);
  }

  /** True if `ancestorId` is (any kind of) ancestor of `personId` — used to refuse cycles. */
  async isAncestor(ancestorId: string, personId: string, db: Db = this.prisma): Promise<boolean> {
    if (ancestorId === personId) return true;
    const rows = await db.$queryRaw<{ found: boolean }[]>(Prisma.sql`
      WITH RECURSIVE up(id, depth) AS (
        SELECT parent_id, 1 FROM parentages WHERE child_id = ${personId}
        UNION
        SELECT p.parent_id, up.depth + 1 FROM parentages p JOIN up ON p.child_id = up.id WHERE up.depth < 80
      )
      SELECT EXISTS (SELECT 1 FROM up WHERE id = ${ancestorId}) AS found`);
    return !!rows[0]?.found;
  }

  /**
   * A family view around `egoId`: ancestors up to `up` generations, everyone
   * descending from them down to `down` generations below ego, plus partners.
   */
  async neighborhood(egoId: string, up = 3, down = 2, db: Db = this.prisma): Promise<string[]> {
    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH RECURSIVE anc(id, gen) AS (
        SELECT ${egoId}::text, 0
        UNION
        SELECT p.parent_id, anc.gen - 1 FROM parentages p JOIN anc ON p.child_id = anc.id
        WHERE anc.gen > ${-up} AND p.kind IN (${this.kinds(LINEAGE)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
      ),
      fam(id, gen) AS (
        SELECT id, gen FROM anc
        UNION
        SELECT p.child_id, fam.gen + 1 FROM parentages p JOIN fam ON p.parent_id = fam.id
        WHERE fam.gen < ${down} AND p.kind IN (${this.kinds(LINEAGE)}) AND p.status NOT IN ('REJECTED', 'RETRACTED')
      ),
      ids AS (SELECT DISTINCT id FROM fam)
      SELECT id FROM ids
      UNION
      SELECT CASE WHEN u.partner_a_id = ids.id THEN u.partner_b_id ELSE u.partner_a_id END
      FROM unions u JOIN ids ON ids.id IN (u.partner_a_id, u.partner_b_id)
      WHERE u.partner_b_id IS NOT NULL AND u.confirm_status NOT IN ('REJECTED', 'RETRACTED')`);
    return rows.map((r) => r.id).filter(Boolean);
  }

  /**
   * Minimal subgraph needed to name the relation between two people: both
   * ancestries, partners (and their ancestries), children and their partners,
   * and the partners of direct parents (step relations).
   */
  async relationSubgraphIds(egoId: string, otherId: string, maxDepth = 40, db: Db = this.prisma): Promise<string[]> {
    const ids = new Set<string>([egoId, otherId]);
    const partners = async (id: string) =>
      (await db.union.findMany({
        where: { OR: [{ partnerAId: id }, { partnerBId: id }], partnerBId: { not: null } },
        select: { partnerAId: true, partnerBId: true },
      })).map((u) => (u.partnerAId === id ? u.partnerBId! : u.partnerAId));
    const children = async (id: string) =>
      (await db.parentage.findMany({ where: { parentId: id }, select: { childId: true } })).map((c) => c.childId);

    for (const root of [egoId, otherId]) {
      const roots = [root, ...(await partners(root))];
      for (const r of roots) {
        ids.add(r);
        for (const a of await this.ancestors(r, maxDepth, LINEAGE, db)) ids.add(a.id);
      }
      for (const c of await children(root)) {
        ids.add(c);
        for (const p of await partners(c)) ids.add(p);
      }
      for (const parent of await db.parentage.findMany({ where: { childId: root }, select: { parentId: true } })) {
        for (const p of await partners(parent.parentId)) ids.add(p);
      }
    }
    return [...ids];
  }

  /** Load persons + relations among `ids` into the pure rules Graph. */
  async loadGraph(ids: string[], db: Db = this.prisma): Promise<Graph> {
    const [persons, parentages, unions] = await Promise.all([
      db.person.findMany({
        where: { id: { in: ids } },
        select: { id: true, sex: true, birthDate: true, isPlaceholder: true, displayName: true },
      }),
      db.parentage.findMany({
        where: { parentId: { in: ids }, childId: { in: ids } },
        select: { parentId: true, childId: true, kind: true, certainty: true, status: true, birthOrder: true },
      }),
      db.union.findMany({
        where: { partnerAId: { in: ids }, OR: [{ partnerBId: { in: ids } }, { partnerBId: null }] },
        select: { partnerAId: true, partnerBId: true, status: true },
      }),
    ]);
    return buildGraph(
      persons,
      parentages,
      unions.map((u) => ({ aId: u.partnerAId, bId: u.partnerBId, status: u.status })),
    );
  }

  /** The whole graph (admin checks / backfill report). */
  async loadAll(db: Db = this.prisma): Promise<Graph> {
    const ids = (await db.person.findMany({ where: { mergedIntoId: null }, select: { id: true } })).map((p) => p.id);
    return this.loadGraph(ids, db);
  }
}
