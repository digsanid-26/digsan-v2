// ─────────────────────────────────────────────────────────────
// Family graph model (Phase 2 foundation)
//
// A relation-based representation of the family, mirroring the backend
// `FamilyMember` model (parentId / spouseId / children). This replaces the
// fixed config-driven topology and is the basis for recursive expansion
// and recursive guardianship.
//
// The graph is seeded from the TreeConfig (self, spouse, parents, siblings,
// children, grandparents, ancestors) and then merged with any explicitly
// added circles held in the members blob (records carrying `group` +
// `parentId`/`spouseId`). Because layout is driven purely by relations,
// branches nest to unlimited depth — e.g. a nephew's grandchild, or a
// cousin's descendants under an uncle.
//
// See `scripts/verify-layout.ts` for the layout regression checks.
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
export function configToGraph(config: TreeConfig, members: Members, selfName: string, selfNodeId?: string): FamilyGraph {
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
  add(merge('self', { name: selfName || 'Anda', role: 'Diri Sendiri', group: 'self', isSelf: !selfNodeId || selfNodeId === 'self' }));

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
    const fc = o?.familyConfig;
    const older = fc?.olderCount ?? fc?.siblingCount ?? 0;
    const younger = fc?.youngerCount ?? 0;
    if (older <= 0 && younger <= 0) return;
    const sideLabel = sideKey === 'P' ? 'Ayah' : 'Ibu';
    // 'o' before 'y' so id string sort keeps birth order (kakak, then adik).
    for (let i = 0; i < older; i++) {
      add(merge(`uncle${sideKey}o-${i}`, {
        name: `Kakak ${sideLabel} ${i + 1}`,
        role: `Kakak ${sideLabel} (Paman/Bibi)`,
        group: 'uncle',
        parentId: parent.parentId,
      }));
    }
    for (let i = 0; i < younger; i++) {
      add(merge(`uncle${sideKey}y-${i}`, {
        name: `Adik ${sideLabel} ${i + 1}`,
        role: `Adik ${sideLabel} (Paman/Bibi)`,
        group: 'uncle',
        parentId: parent.parentId,
      }));
    }
  };
  buildParentSiblings('parent-0', 'P');
  buildParentSiblings('parent-1', 'M');

  // ─── Explicitly-added circles (recursive, graph-based) ───
  // Any member override carrying an explicit `group` + relation fields is a
  // circle added via the tree UI (super_user). These reference base ids or
  // other explicit ids as parent/spouse, enabling unlimited recursive depth.
  for (const [id, m] of Object.entries(members)) {
    if (g[id]) continue;               // already part of the base graph
    if (!m || !m.group) continue;      // only explicit records have a group
    add({
      id,
      name: m.name || '',
      gender: (m.gender as FGender) || '',
      alive: m.alive !== false,
      photo: m.photo ?? null,
      verified: m.verified,
      role: m.role || '',
      group: m.group as FGroup,
      parentId: m.parentId ?? null,
      spouseId: m.spouseId ?? null,
    });
  }
  // Ensure spouse links are symmetric for explicit couples.
  for (const m of Object.values(g)) {
    if (m.spouseId && g[m.spouseId] && !g[m.spouseId].spouseId) {
      g[m.spouseId].spouseId = m.id;
    }
  }

  // ─── Re-pivot: connected user sees the tree from their own node ───
  // When a linked user (e.g. wife) logs in, selfNodeId points to their
  // member node (e.g. 'spouse-0'). We mark that node as isSelf and give
  // it the 'self' group, while demoting the original 'self' to a spouse.
  if (selfNodeId && selfNodeId !== 'self' && g[selfNodeId]) {
    g['self'].isSelf = false;
    g['self'].group = 'spouse';
    g['self'].role = 'Suami / Istri';
    g[selfNodeId].isSelf = true;
    g[selfNodeId].group = 'self';
    g[selfNodeId].role = 'Diri Sendiri';
    // Transfer the parent link from the old self to the new self.
    // The config-driven base graph sets parentId on 'self' (the tree
    // owner). After re-pivot, the connected user (e.g. wife) becomes
    // self and should inherit that parent link — those are HER parents
    // from her own Pengaturan Bagan config. The old self (husband)
    // must lose the link so he doesn't appear as a child of wife's
    // parents.
    if (g['self'].parentId && !g[selfNodeId].parentId) {
      g[selfNodeId].parentId = g['self'].parentId;
      g['self'].parentId = null;
    }
    // Children with parentId === 'self' (the old self / husband) should
    // be reparented to the new self (wife) so they descend from her.
    for (const m of Object.values(g)) {
      if (m.parentId === 'self' && m.id !== selfNodeId) {
        m.parentId = selfNodeId;
      }
    }
  }

  return g;
}

// ─── Layout (relation-driven) ────────────────────────────────
//
// Reproduces the existing tree geometry from the relational graph. Being
// relation-driven (rather than reading config counts), it can render extra
// branches added in later phases (e.g. a deceased parent's siblings) without
// changing the layout code.

const LAYOUT_ANCESTORS_Y0 = -580;
const ROW = 210, ROW_PARENT = -210, ROW_GP = -420;
const WSLOT = 160;       // horizontal width reserved per person in a couple
const SIB_GAP = 44;      // spacing between adjacent sibling subtrees
const UNCLE_GAP = 90;    // extra spacing between the parents and uncle subtrees
const MIN_GP_SPREAD = 260; // min outward offset of each grandparent couple from the parents' midpoint

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

// Classify a child relative to its parent couple's centre so siblings render
// in birth order: older/elder branches to the left, the anchor in the middle,
// younger branches to the right.
function childSide(m: FMember): -1 | 0 | 1 {
  if (m.group === 'kakak') return -1;
  if (m.group === 'adik') return 1;
  if (m.group === 'uncle') return /o-\d+$/.test(m.id) ? -1 : 1;
  return 0; // self, parent, child, spouse-in
}

/**
 * Recursive relation-driven layout. Everything below (and including) the
 * highest resolved parent couple is laid out as a tidy descendant tree, so
 * unlimited depth (children → grandchildren → …) and per-node siblings all
 * pack without overlap. Ancestors (grandparents + chains) and a parent's
 * siblings (uncles/aunts, with their own recursive descendants) are attached
 * above, mirroring the classic paternal-left / maternal-right genogram look.
 */
export function layoutGraph(g: FamilyGraph): { nodes: TNode[]; lines: Poly[] } {
  const nodes: TNode[] = [];
  const lines: Poly[] = [];
  const self = Object.values(g).find((m) => m.isSelf) || g['self'];
  if (!self) return { nodes, lines };

  const push = (m: FMember, x: number, y: number) =>
    nodes.push({ id: m.id, name: m.name, role: m.role, x, y, group: m.group as TGroup });

  // ─── couple + children helpers ─────────────────────────────
  const spouseOf = (m: FMember): FMember | undefined =>
    (m.spouseId && g[m.spouseId]) ? g[m.spouseId] : undefined;

  // A couple = the anchor person followed by their spouse (if any).
  const coupleOf = (id: string): FMember[] => {
    const m = g[id];
    if (!m) return [];
    const sp = spouseOf(m);
    return sp ? [m, sp] : [m];
  };

  // Direct children of the couple anchored at `id` (parentId points at the
  // anchor or its spouse). Ordered elder-left → anchor → younger-right.
  const orderedChildren = (id: string): FMember[] => {
    const m = g[id];
    if (!m) return [];
    const spId = m.spouseId || undefined;
    const kids = Object.values(g).filter(
      (x) => x.parentId && (x.parentId === id || (spId && x.parentId === spId)),
    );
    const before = kids.filter((k) => childSide(k) < 0).sort((a, b) => idxOf(b.id) - idxOf(a.id));
    const centre = kids.filter((k) => childSide(k) === 0).sort((a, b) => idxOf(a.id) - idxOf(b.id));
    const after = kids.filter((k) => childSide(k) > 0).sort((a, b) => idxOf(a.id) - idxOf(b.id));
    return [...before, ...centre, ...after];
  };

  // ─── recursive width measure + placement ───────────────────
  const measured = new Map<string, number>();
  const measure = (id: string): number => {
    if (measured.has(id)) return measured.get(id)!;
    measured.set(id, WSLOT); // guard against relation cycles
    const coupleW = Math.max(1, coupleOf(id).length) * WSLOT;
    const kids = orderedChildren(id);
    let w = coupleW;
    if (kids.length) {
      let kidsW = kids.reduce((acc, k) => acc + measure(k.id), 0);
      kidsW += (kids.length - 1) * SIB_GAP;
      w = Math.max(coupleW, kidsW);
    }
    measured.set(id, w);
    return w;
  };

  const placed = new Set<string>();
  const place = (id: string, centerX: number, y: number) => {
    if (placed.has(id)) return;
    placed.add(id);
    const couple = coupleOf(id);
    const xs = spreadX(couple.length, WSLOT, centerX);
    couple.forEach((p, i) => { placed.add(p.id); push(p, xs[i], y); });
    if (couple.length >= 2) lines.push({ points: [[xs[0], y], [xs[xs.length - 1], y]], marriage: true });
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;

    const kids = orderedChildren(id);
    if (!kids.length) return;
    const widths = kids.map((k) => measure(k.id));
    const total = widths.reduce((a, b) => a + b, 0) + (kids.length - 1) * SIB_GAP;
    let cursor = centerX - total / 2;
    const centres: number[] = [];
    kids.forEach((k, i) => {
      const kx = cursor + widths[i] / 2;
      place(k.id, kx, y + ROW);
      // Use the child's actual node x (not couple midpoint) so the parent
      // line connects to the child's own circle, not between child and spouse.
      const childNode = nodes.find((n) => n.id === k.id);
      centres.push(childNode ? childNode.x : kx);
      cursor += widths[i] + SIB_GAP;
    });
    connectDown(lines, mid, y, centres, y + ROW);
  };

  // ─── choose the descendant root (parent couple, else self) ──
  const father = self.parentId ? g[self.parentId] : undefined;   // parent-0
  const mother = father ? spouseOf(father) : undefined;          // parent-1
  const rootId = father ? father.id : self.id;
  const rootY = father ? ROW_PARENT : 0;

  place(rootId, 0, rootY);

  // Normalise so "self" sits at x = 0 (keeps the view centred on the user).
  const selfNode = nodes.find((n) => n.id === self.id);
  const dx = selfNode ? -selfNode.x : 0;
  if (dx) {
    for (const n of nodes) n.x += dx;
    for (const l of lines) l.points = l.points.map(([x, y]) => [x + dx, y]);
  }

  const xOf = (id: string) => nodes.find((n) => n.id === id)?.x;

  // ─── ancestor chains above a grandparent couple ────────────
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

  // ─── grandparents + uncles (recursive descendants) ─────────
  // `dir` = -1 packs uncle subtrees to the left (paternal), +1 right (maternal).
  const buildGpSide = (anchorParentId: string | undefined, gpRootId: string | undefined, dir: -1 | 1) => {
    if (!gpRootId || !g[gpRootId] || !anchorParentId) return;
    const anchorX = xOf(anchorParentId);
    if (anchorX === undefined) return;

    // Uncles = the grandparents' other children (parent's siblings).
    const uncles = Object.values(g)
      .filter((m) => m.group === 'uncle' && (m.parentId === gpRootId || (g[gpRootId].spouseId && m.parentId === g[gpRootId].spouseId)))
      .sort((a, b) => idxOf(a.id) - idxOf(b.id));

    // Pack uncle subtrees outward, starting beyond everything already placed
    // on the parent row and below. Using the live bounding box (rather than
    // just the parent couple's own width) keeps deep cousin branches from
    // colliding with the siblings' subtrees.
    const occupied = nodes.filter((n) => n.y >= ROW_PARENT).map((n) => n.x);
    let edge = occupied.length
      ? (dir < 0 ? Math.min(...occupied) : Math.max(...occupied)) + dir * UNCLE_GAP
      : anchorX + dir * UNCLE_GAP;
    const uncleCentres: number[] = [];
    uncles.forEach((u) => {
      const w = measure(u.id);
      const ux = edge + dir * (w / 2);
      place(u.id, ux, ROW_PARENT);
      uncleCentres.push(ux);
      edge += dir * (w + UNCLE_GAP);
    });

    // Grandparent couple, centred over the parent + uncles cluster — but
    // pushed outward enough that the paternal & maternal couples never collide.
    const gpNodes = coupleOf(gpRootId);
    const clusterXs = [anchorX, ...uncleCentres];
    const rawCenter = clusterXs.reduce((a, b) => a + b, 0) / clusterXs.length;
    const midPoint = (father && mother) ? ((xOf(father.id) ?? 0) + (xOf(mother.id) ?? 0)) / 2 : anchorX;
    const gpCenter = dir < 0
      ? Math.min(rawCenter, midPoint - MIN_GP_SPREAD)
      : Math.max(rawCenter, midPoint + MIN_GP_SPREAD);
    const gpXs = spreadX(gpNodes.length, WSLOT, gpCenter);
    gpNodes.forEach((gp, i) => { push(gp, gpXs[i], ROW_GP); });
    if (gpNodes.length >= 2) lines.push({ points: [[gpXs[0], ROW_GP], [gpXs[gpXs.length - 1], ROW_GP]], marriage: true });
    const gpMid = gpXs.reduce((a, b) => a + b, 0) / gpXs.length;
    connectDown(lines, gpMid, ROW_GP, [anchorX, ...uncleCentres], ROW_PARENT);
    buildAncestorsChain(gpRootId, gpCenter);
  };

  buildGpSide(father?.id, father?.parentId || undefined, -1);
  buildGpSide(mother?.id, mother?.parentId || undefined, 1);

  return { nodes, lines };
}
