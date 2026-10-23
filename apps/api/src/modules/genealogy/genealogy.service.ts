import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { GraphRepository } from './graph.repository';
import { checkGraph, relationOf, type Kinship, type ParentageKindT } from './graph-rules.util';
import { nameSimilarity } from './merge-rules.util';

/** How far around the user's own Person suggestions (and links) may reach. */
const SCOPE_UP = 4;
const SCOPE_DOWN = 3;

/** Relation a layout slot of the owner's tree is expected to have to the owner. */
function expectedRelation(nodeId: string | undefined): ((k: Kinship, sex: string) => boolean) | null {
  if (!nodeId) return null;
  if (nodeId === 'parent-0') return (k, sex) => k.code === 'PARENT' && sex !== 'FEMALE';
  if (nodeId === 'parent-1') return (k, sex) => k.code === 'PARENT' && sex !== 'MALE';
  if (/^parent-\d+$/.test(nodeId)) return (k) => k.code === 'PARENT';
  if (/^spouse-\d+$/.test(nodeId)) return (k) => k.code === 'PARTNER';
  if (/^child-\d+$/.test(nodeId)) return (k) => k.code === 'CHILD';
  if (/^(older|younger)-\d+$/.test(nodeId)) return (k) => k.code.startsWith('SIBLING_');
  if (/^gpP-\d+$/.test(nodeId)) return (k) => k.code === 'GRANDPARENT' && k.side !== 'IBU';
  if (/^gpM-\d+$/.test(nodeId)) return (k) => k.code === 'GRANDPARENT' && k.side !== 'AYAH';
  if (/^uncleP[oy]-\d+$/.test(nodeId)) return (k) => k.code === 'PARENT_SIBLING' && k.side !== 'IBU';
  if (/^uncleM[oy]-\d+$/.test(nodeId)) return (k) => k.code === 'PARENT_SIBLING' && k.side !== 'AYAH';
  return null;
}

const MODES: Record<string, ParentageKindT[]> = {
  nasab: ['BIOLOGICAL'],
  hukum: ['BIOLOGICAL', 'ADOPTIVE'],
  sosial: ['BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 'GUARDIAN'],
};

/** Read side of the canonical genealogy graph (Fase 1: read-only, ego = current user). */
@Injectable()
export class GenealogyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: GraphRepository,
  ) {}

  private async egoOf(userId: string) {
    const ego = await this.prisma.person.findUnique({ where: { userId }, select: { id: true } });
    if (!ego) throw new NotFoundException('Data silsilah Anda belum tersedia di model graf');
    return ego.id;
  }

  /** Family view around the current user, with each person's relation label. */
  async myView(userId: string, up = 3, down = 2, mode = 'hukum') {
    const egoId = await this.egoOf(userId);
    const kinds = MODES[mode] ?? MODES.hukum;
    const ids = await this.graph.neighborhood(egoId, Math.min(Math.max(up, 0), 10), Math.min(Math.max(down, 0), 10));
    const g = await this.graph.loadGraph(ids);
    const persons = await this.prisma.person.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, sex: true, vitalStatus: true, photo: true, isPlaceholder: true, userId: true, privacy: true },
    });
    return {
      egoId,
      mode: MODES[mode] ? mode : 'hukum',
      persons: persons.map(({ userId: uid, ...p }) => ({
        ...p,
        hasAccount: !!uid,
        relation: relationOf(g, egoId, p.id, kinds),
      })),
      parentages: g.parentages,
      unions: g.unions,
    };
  }

  /** "Who is this person to me?" */
  async relationToMe(userId: string, otherId: string, mode = 'hukum') {
    const egoId = await this.egoOf(userId);
    const other = await this.prisma.person.findUnique({ where: { id: otherId }, select: { id: true, displayName: true } });
    if (!other) throw new NotFoundException('Orang tidak ditemukan');
    const g = await this.graph.loadGraph(await this.graph.relationSubgraphIds(egoId, otherId));
    const relation = relationOf(g, egoId, otherId, MODES[mode] ?? MODES.hukum);
    if (!relation) throw new NotFoundException('Belum ditemukan hubungan keluarga dengan orang ini');
    return { egoId, person: other, relation };
  }

  /** Persons a user may refer to from their own tree: their family neighbourhood. */
  async scopeOf(userId: string): Promise<Set<string>> {
    const ego = await this.prisma.person.findUnique({ where: { userId }, select: { id: true } });
    if (!ego) return new Set();
    return new Set(await this.graph.neighborhood(ego.id, SCOPE_UP, SCOPE_DOWN));
  }

  /**
   * F2-05 — "search before create". People already recorded in the user's
   * family (by anyone) who match the typed name and/or the slot being filled,
   * so the user links to them instead of drawing a duplicate.
   *
   * With an empty query and a known slot (e.g. `parent-0`) it lists the people
   * the graph already knows in that role ("your father, drawn by Adi").
   */
  async suggest(userId: string, q: string | undefined, nodeId: string | undefined) {
    const ego = await this.prisma.person.findUnique({ where: { userId }, select: { id: true } });
    if (!ego) return [];
    const query = (q ?? '').trim();
    const expect = expectedRelation(nodeId);
    if (query.length < 3 && !expect) return [];

    const ids = [...(await this.scopeOf(userId))].filter((id) => id !== ego.id);
    if (!ids.length) return [];

    // People already used by another circle of the user's own tree are not offered again.
    const ownTree = await this.prisma.familyTree.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    const used = new Set(
      ownTree
        ? (await this.prisma.legacyNodeMap.findMany({ where: { treeId: ownTree.id, nodeKey: { not: nodeId ?? '' } }, select: { personId: true } })).map((m) => m.personId)
        : [],
    );

    const g = await this.graph.loadGraph([ego.id, ...ids]);
    const persons = await this.prisma.person.findMany({
      where: { id: { in: ids }, mergedIntoId: null, isPlaceholder: false },
      select: {
        id: true, displayName: true, sex: true, photo: true, vitalStatus: true, userId: true,
        names: { select: { value: true } },
        legacyNodes: { select: { tree: { select: { userId: true, user: { select: { name: true } } } } } },
      },
    });

    const out = [];
    for (const p of persons) {
      if (used.has(p.id)) continue;
      const relation = relationOf(g, ego.id, p.id);
      const roleMatch = !!(expect && relation && expect(relation, p.sex));
      const sim = query.length >= 3 ? Math.max(nameSimilarity(query, p.displayName), ...p.names.map((n) => nameSimilarity(query, n.value))) : 0;
      if (query.length >= 3 ? sim < 0.6 && !(roleMatch && sim >= 0.4) : !roleMatch) continue;
      const drawnBy = [...new Set(p.legacyNodes.filter((n) => n.tree.userId !== userId).map((n) => n.tree.user?.name).filter(Boolean))];
      out.push({
        personId: p.id,
        displayName: p.displayName,
        sex: p.sex,
        photo: p.photo,
        alive: p.vitalStatus !== 'DECEASED',
        hasAccount: !!p.userId,
        // Accounts are linked through a confirmation request, so the client needs the id.
        accountUserId: p.userId ?? null,
        relation: relation?.label ?? null,
        roleMatch,
        drawnBy,
        score: Math.round(((roleMatch ? 0.5 : 0) + 0.5 * sim) * 100) / 100,
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }

  /** Admin: invariant check over the whole graph (F1-07). */
  async check() {
    const issues = checkGraph(await this.graph.loadAll());
    const counts: Record<string, number> = {};
    for (const i of issues) counts[i.code] = (counts[i.code] ?? 0) + 1;
    return { counts, issues: issues.slice(0, 200) };
  }
}
