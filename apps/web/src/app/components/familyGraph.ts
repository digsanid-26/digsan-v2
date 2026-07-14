// ─────────────────────────────────────────────────────────────
// Family graph model (Phase 2 foundation)
//
// A relation-based representation of the family, mirroring the backend
// `FamilyMember` model (parentId / spouseId / children). This replaces the
// fixed config-driven topology and is the basis for recursive expansion
// and recursive guardianship.
//
// Phase 1 deliverable: types + converter from the current config/members
// blob + recursive guardianship rule. Additive and non-breaking — the
// live UI still uses the config-driven layout until Phase 2 wires this in.
// ─────────────────────────────────────────────────────────────

import type { TreeConfig, Members, TNode, Poly, Group as TGroup } from './treeTypes';

export type FGender = 'L' | 'P' | '';

export type FGroup =
  | 'self' | 'spouse' | 'parent' | 'grandparent' | 'ancestor'
  | 'kakak' | 'adik' | 'child' | 'uncle';

/** A single person in the family graph (mirrors backend FamilyMember). */
export interface FMember {
  id: string;
  name: string;
  gender: FGender;
  alive: boolean;
  photo: string | null;
  /** Whether this member is linked to a real, verified/active account. */
  verified?: boolean;
  /** True when this member represents the account owner ("self"). */
  isSelf?: boolean;
  role: string;
  group: FGroup;
  /** The parent this member descends from (couple resolved via that parent's spouse). */
  parentId?: string | null;
  /** Marriage link. */
  spouseId?: string | null;
}

export type FamilyGraph = Record<string, FMember>;

// ─── Guardianship (recursive) ────────────────────────────────

/** Direct relatives of a member: parent (+ that parent's spouse), spouse, children, siblings. */
export function neighborsOf(graph: FamilyGraph, id: string): string[] {
  const m = graph[id];
  if (!m) return [];
  const out = new Set<string>();

  // Parent + parent's spouse (the other biological parent)
  if (m.parentId && graph[m.parentId]) {
    out.add(m.parentId);
    const parentSpouse = graph[m.parentId].spouseId;
    if (parentSpouse && graph[parentSpouse]) out.add(parentSpouse);
  }

  // Spouse
  if (m.spouseId && graph[m.spouseId]) out.add(m.spouseId);

  // Children (anyone whose parent is this member or this member's spouse)
  // Siblings (share the same parent as this member)
  for (const other of Object.values(graph)) {
    if (other.id === id) continue;
    if (other.parentId && (other.parentId === id || other.parentId === m.spouseId)) out.add(other.id);
    if (m.parentId && other.parentId === m.parentId) out.add(other.id);
  }

  out.delete(id);
  return [...out];
}

/**
 * Set of member ids the given living user may manage/edit.
 *
 * Rule: starting from the (living) user, you may manage any DECEASED direct
 * relative, and traverse THROUGH deceased relatives to reach further deceased
 * relatives — recursively. You may NOT traverse through a LIVING member
 * (managing their network requires their consent — Phase 4).
 *
 * Shared guardianship is automatic: a living sibling with an active account
 * runs the same BFS from their own node when they log in.
 */
export function manageableIds(graph: FamilyGraph, rootUserId: string): Set<string> {
  const manageable = new Set<string>();
  const root = graph[rootUserId];
  if (!root) return manageable;

  // BFS: expand from the living root; enqueue deceased neighbors (managed);
  // continue expanding only through deceased nodes.
  const queue: string[] = [rootUserId];
  const visited = new Set<string>([rootUserId]);

  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of neighborsOf(graph, cur)) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      const nbNode = graph[nb];
      if (!nbNode) continue;
      if (!nbNode.alive) {
        // Deceased relative → manageable, and we may traverse through them.
        manageable.add(nb);
        queue.push(nb);
      }
      // Living members are boundaries: not manageable, do not traverse.
    }
  }

  return manageable;
}

/** Whether the given user can edit the target member. */
export function canManage(graph: FamilyGraph, targetId: string, rootUserId: string): boolean {
  const target = graph[targetId];
  if (!target) return false;
  if (targetId === rootUserId) return true;   // self
  if (target.alive) {
    // Living members: only the member themself (their own account). Others
    // require consent (Phase 4). The account owner ("self") owns their record.
    return false;
  }
  return manageableIds(graph, rootUserId).has(targetId);
}

// ─── Converter (config blob → relational graph) ──────────────

const ANCESTOR_LABELS = ['Buyut', 'Canggah', 'Wareng', 'Udheg-udheg', 'Gantung Siwur', 'Gropak Senthe'];

/**
 * Build a relational family graph from the current config-driven setup and
 * the member-override blob. Reproduces the existing topology as explicit
 * relations so the recursive layout (Phase 2) can render it and extend it.
 */
export function configToGraph(config: TreeConfig, members: Members, selfName: string): FamilyGraph {
  const g: FamilyGraph = {};

  const add = (m: FMember) => { g[m.id] = m; };
  const ov = (id: string) => members[id];
  const merge = (id: string, base: Partial<FMember>): FMember => {
    const o = ov(id);
    return {
      id,
      name: o?.name || base.name || '',
      gender: (o?.gender as FGender) || base.gender || '',
      alive: o?.alive !== false,
      photo: o?.photo ?? base.photo ?? null,
      verified: o?.verified,
      isSelf: base.isSelf,
      role: base.role || '',
      group: base.group || 'child',
      parentId: base.parentId ?? null,
      spouseId: base.spouseId ?? null,
    };
  };

  // Self
  add(merge('self', { name: selfName || 'Anda', role: 'Diri Sendiri', group: 'self', isSelf: true }));

  // Spouses (married to self)
  for (let i = 0; i < config.spouseCount; i++) {
    const id = `spouse-${i}`;
    add(merge(id, { name: config.spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', role: 'Suami / Istri', group: 'spouse', spouseId: 'self' }));
    if (g['self'] && !g['self'].spouseId) g['self'].spouseId = id;
  }

  // Parents (self's parents). Father = parent-0, Mother = parent-1.
  const parentLabels = config.parentCount === 2 ? ['Ayah', 'Ibu'] : Array.from({ length: config.parentCount }, (_, i) => `Orang Tua ${i + 1}`);
  for (let i = 0; i < config.parentCount; i++) {
    add(merge(`parent-${i}`, { name: parentLabels[i], role: 'Orang Tua', group: 'parent' }));
  }
  if (config.parentCount >= 2) { g['parent-0'].spouseId = 'parent-1'; g['parent-1'].spouseId = 'parent-0'; }
  if (config.parentCount > 0) g['self'].parentId = 'parent-0';

  // Siblings of self (share self's parent-0)
  for (let i = 0; i < config.olderCount; i++) {
    add(merge(`older-${i}`, { name: `Kakak ${i + 1}`, role: 'Saudara Tua', group: 'kakak', parentId: config.parentCount > 0 ? 'parent-0' : null }));
  }
  for (let i = 0; i < config.youngerCount; i++) {
    add(merge(`younger-${i}`, { name: `Adik ${i + 1}`, role: 'Saudara Muda', group: 'adik', parentId: config.parentCount > 0 ? 'parent-0' : null }));
  }

  // Children of self
  for (let i = 0; i < config.childCount; i++) {
    add(merge(`child-${i}`, { name: `Anak ${i + 1}`, role: 'Keturunan', group: 'child', parentId: 'self' }));
  }

  // Grandparents — paternal (parents of parent-0) and maternal (parents of parent-1)
  const buildGrandparents = (side: 'P' | 'M', count: number, childOfId: string | undefined) => {
    if (count <= 0 || !childOfId || !g[childOfId]) return;
    const labels = count === 2 ? ['Kakek', 'Nenek'] : Array.from({ length: count }, (_, i) => `Simbah ${side === 'P' ? 'Ayah' : 'Ibu'} ${i + 1}`);
    for (let i = 0; i < count; i++) {
      add(merge(`gp${side}-${i}`, { name: labels[i], role: side === 'P' ? 'Simbah (dari Ayah)' : 'Simbah (dari Ibu)', group: 'grandparent' }));
    }
    if (count >= 2) { g[`gp${side}-0`].spouseId = `gp${side}-1`; g[`gp${side}-1`].spouseId = `gp${side}-0`; }
    g[childOfId].parentId = `gp${side}-0`;
  };
  buildGrandparents('P', config.simbahP, config.parentCount > 0 ? 'parent-0' : undefined);
  buildGrandparents('M', config.simbahM, config.parentCount >= 2 ? 'parent-1' : undefined);

  // Ancestor chains above each grandparent line
  const buildAncestors = (side: 'P' | 'M', enabled: boolean) => {
    if (!enabled) return;
    let childOf = `gp${side}-0`;
    ANCESTOR_LABELS.forEach((label, i) => {
      const id = `anc${side}-${i}`;
      add(merge(id, { name: label, role: `Leluhur — ${label}`, group: 'ancestor' }));
      if (g[childOf]) g[childOf].parentId = id;
      childOf = id;
    });
  };
  buildAncestors('P', config.simbahP > 0);
  buildAncestors('M', config.simbahM > 0);

  // Parent's siblings (uncles/aunts) — created from a DECEASED parent's
  // per-node setup. They attach to that parent's parent (the grandparent),
  // so they only appear once grandparents exist for that side.
  const buildParentSiblings = (parentId: string, sideKey: 'P' | 'M') => {
    const parent = g[parentId];
    if (!parent || !parent.parentId) return;
    const o = ov(parentId);
    const deceased = o ? o.alive === false : false;
    const count = o?.familyConfig?.siblingCount || 0;
    if (!deceased || count <= 0) return;
    const sideLabel = sideKey === 'P' ? 'Ayah' : 'Ibu';
    for (let i = 0; i < count; i++) {
      add(merge(`uncle${sideKey}-${i}`, {
        name: `Saudara ${sideLabel} ${i + 1}`,
        role: `Saudara ${sideLabel} (Paman/Bibi)`,
        group: 'uncle',
        parentId: parent.parentId,
      }));
    }
  };
  buildParentSiblings('parent-0', 'P');
  buildParentSiblings('parent-1', 'M');

  return g;
}

// ─── Layout (relation-driven) ────────────────────────────────
//
// Reproduces the existing tree geometry from the relational graph. Being
// relation-driven (rather than reading config counts), it can render extra
// branches added in later phases (e.g. a deceased parent's siblings) without
// changing the layout code.

const LAYOUT_ANCESTORS_Y0 = -580;
const ROW_CHILD = 210, ROW_PARENT = -210, ROW_GP = -420;
const GP_CENTER = 300;

const spreadX = (count: number, gap: number, cx: number): number[] => {
  if (count <= 0) return [];
  const total = (count - 1) * gap;
  return Array.from({ length: count }, (_, i) => cx - total / 2 + i * gap);
};

function connectDown(lines: Poly[], midX: number, parentY: number, childXs: number[], childY: number) {
  if (childXs.length === 0) return;
  const trunkY = (parentY + childY) / 2;
  lines.push({ points: [[midX, parentY], [midX, trunkY]] });
  const xs = [...childXs, midX];
  lines.push({ points: [[Math.min(...xs), trunkY], [Math.max(...xs), trunkY]] });
  for (const cx of childXs) lines.push({ points: [[cx, trunkY], [cx, childY]] });
}

const idxOf = (id: string) => parseInt(id.split('-').pop() || '0', 10) || 0;
const byIdx = (a: FMember, b: FMember) => idxOf(a.id) - idxOf(b.id);

export function layoutGraph(g: FamilyGraph): { nodes: TNode[]; lines: Poly[] } {
  const nodes: TNode[] = [];
  const lines: Poly[] = [];
  const self = Object.values(g).find((m) => m.isSelf) || g['self'];
  if (!self) return { nodes, lines };

  const push = (m: FMember, x: number, y: number) =>
    nodes.push({ id: m.id, name: m.name, role: m.role, x, y, group: m.group as TGroup });

  const byGroup = (grp: FGroup) => Object.values(g).filter((m) => m.group === grp).sort(byIdx);

  // Self + spouses (y = 0)
  const spouses = Object.values(g).filter((m) => m.group === 'spouse' && m.spouseId === self.id).sort(byIdx);
  const coupleXs = spreadX(1 + spouses.length, 160, 0);
  const selfX = coupleXs[0];
  push(self, selfX, 0);
  spouses.forEach((s, i) => { push(s, coupleXs[i + 1], 0); lines.push({ points: [[selfX, 0], [coupleXs[i + 1], 0]], marriage: true }); });
  const coupleMid = coupleXs.reduce((a, b) => a + b, 0) / coupleXs.length;
  const leftEdge = Math.min(...coupleXs);
  const rightEdge = Math.max(...coupleXs);

  // Children (y = 210) — anyone whose parent is self (or self's spouse)
  const children = Object.values(g).filter((m) => m.group === 'child' && (m.parentId === self.id || (self.spouseId && m.parentId === self.spouseId))).sort(byIdx);
  const childXs = spreadX(children.length, 150, coupleMid);
  children.forEach((c, i) => push(c, childXs[i], ROW_CHILD));
  connectDown(lines, coupleMid, 0, childXs, ROW_CHILD);

  // Siblings (y = 0) — share self's parent
  const older = byGroup('kakak').filter((m) => m.parentId === self.parentId);
  const younger = byGroup('adik').filter((m) => m.parentId === self.parentId);
  const olderXs = older.map((m, i) => { const x = leftEdge - 150 * (i + 1); push(m, x, 0); return x; });
  const youngerXs = younger.map((m, i) => { const x = rightEdge + 150 * (i + 1); push(m, x, 0); return x; });

  // Parents (y = -210)
  const parents = byGroup('parent');
  const parentXs = spreadX(parents.length, 160, 0);
  parents.forEach((p, i) => push(p, parentXs[i], ROW_PARENT));
  if (parents.length >= 2) lines.push({ points: [[parentXs[0], ROW_PARENT], [parentXs[parentXs.length - 1], ROW_PARENT]], marriage: true });
  const parentMid = parentXs.length ? parentXs.reduce((a, b) => a + b, 0) / parentXs.length : 0;
  if (parents.length > 0) connectDown(lines, parentMid, ROW_PARENT, [...olderXs, selfX, ...youngerXs], 0);

  // Grandparents + ancestor chains, resolved via relations.
  const fatherId = self.parentId || undefined;
  const father = fatherId ? g[fatherId] : undefined;
  const motherId = father?.spouseId || undefined;
  const fatherX = parentXs[0];
  const motherX = parentXs[parentXs.length - 1];

  const buildAncestorsChain = (rootGpId: string | undefined, centerX: number) => {
    if (!rootGpId || !g[rootGpId]) return;
    let cur: string | undefined = g[rootGpId].parentId || undefined;
    let prevY = ROW_GP;
    let i = 0;
    while (cur && g[cur]) {
      const y = LAYOUT_ANCESTORS_Y0 - i * 150;
      push(g[cur], centerX, y);
      lines.push({ points: [[centerX, prevY], [centerX, y]] });
      prevY = y;
      cur = g[cur].parentId || undefined;
      i++;
    }
  };

  const buildGpSide = (rootParentX: number | undefined, gpRootId: string | undefined, centerX: number, dir: -1 | 1) => {
    if (!gpRootId || !g[gpRootId]) return;
    const gpNodes = [g[gpRootId]];
    const sp = g[gpRootId].spouseId;
    if (sp && g[sp]) gpNodes.push(g[sp]);
    const xs = spreadX(gpNodes.length, 150, centerX);
    gpNodes.forEach((gp, i) => push(gp, xs[i], ROW_GP));
    if (gpNodes.length >= 2) lines.push({ points: [[xs[0], ROW_GP], [xs[xs.length - 1], ROW_GP]], marriage: true });
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;

    // The parent (anchor) + that parent's siblings (uncles/aunts) are all
    // children of this grandparent couple, laid out on the parent row.
    const childXs: number[] = [];
    if (rootParentX !== undefined) childXs.push(rootParentX);
    const uncles = Object.values(g).filter((m) => m.group === 'uncle' && m.parentId === gpRootId).sort(byIdx);
    uncles.forEach((u, i) => {
      const x = (rootParentX ?? centerX) + dir * 150 * (i + 1);
      push(u, x, ROW_PARENT);
      childXs.push(x);
    });
    if (childXs.length) connectDown(lines, mid, ROW_GP, childXs, ROW_PARENT);
    buildAncestorsChain(gpRootId, centerX);
  };

  buildGpSide(fatherX, father?.parentId || undefined, -GP_CENTER, -1);
  buildGpSide(motherX, motherId ? g[motherId]?.parentId || undefined : undefined, GP_CENTER, 1);

  return { nodes, lines };
}
