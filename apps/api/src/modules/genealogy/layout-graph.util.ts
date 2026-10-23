/**
 * F1-03 — translate the legacy, ego-relative layout JSON into absolute graph
 * facts (persons, parentages, unions).
 *
 * The layout encodes relationships in node KEYS relative to the tree owner
 * (`older-0` = "my elder sibling", `spouse-0-parent-1` = "my wife's mother").
 * Absolute facts are what let two trees describing the same people collapse
 * onto the same Person rows instead of duplicating them.
 *
 * Pure: no Prisma. The backfill/dual-write service resolves draft keys to
 * Person ids (by linked account, or by LegacyNodeMap).
 */

export type DraftSex = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type DraftUnionStatus = 'ONGOING' | 'DIVORCED' | 'WIDOWED' | 'UNKNOWN';

export interface DraftPerson {
  key: string;
  userId: string | null;
  displayName: string;
  sex: DraftSex;
  vitalStatus: 'LIVING' | 'DECEASED';
  photo: string | null;
  /** A counted/structural slot the user has not filled in (no name). */
  isPlaceholder: boolean;
  /** F2-05 — the user chose an existing Person for this circle ("sudah ada"). */
  graphPersonId?: string | null;
}

export interface DraftParentage {
  parentKey: string;
  childKey: string;
  unionKey: string | null;
  birthOrder: number | null;
}

export interface DraftUnion {
  key: string;
  aKey: string;
  bKey: string;
  status: DraftUnionStatus;
}

export interface GraphDraft {
  persons: Map<string, DraftPerson>;
  parentages: DraftParentage[];
  unions: DraftUnion[];
  /** Keys that could not be placed in the graph (kept as persons when they have data). */
  unmapped: string[];
}

export interface LayoutInput {
  ownerUserId: string;
  ownerName: string;
  config: Record<string, any> | null | undefined;
  members: Record<string, any> | null | undefined;
  /** FamilyTree.marriageStatus — applies to the owner's first union. */
  marriageStatus?: string | null;
}

type Rec = Record<string, any>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Relationship tokens a key can end with, relative to its ego. */
const REL_TOKEN = '(?:parent|older|younger|gpP|gpM|uncle[PM][oy]|ancP|ancM|spouse|child)-\\d+';
const NAMESPACED_RE = new RegExp(`^(.+)-(${REL_TOKEN})$`);

const SLOT_LABEL: Record<string, string> = {
  'parent-0': 'Ayah',
  'parent-1': 'Ibu',
  'gpP-0': 'Kakek (Ayah)',
  'gpP-1': 'Nenek (Ayah)',
  'gpM-0': 'Kakek (Ibu)',
  'gpM-1': 'Nenek (Ibu)',
};

function slotLabel(rel: string): string {
  if (SLOT_LABEL[rel]) return SLOT_LABEL[rel];
  const [prefix, idx] = rel.split(/-(?=\d+$)/);
  const n = Number(idx) + 1;
  const labels: Record<string, string> = {
    spouse: 'Pasangan', child: 'Anak', older: 'Kakak', younger: 'Adik', parent: 'Orang Tua',
    gpP: 'Simbah (Ayah)', gpM: 'Simbah (Ibu)', ancP: 'Leluhur (Ayah)', ancM: 'Leluhur (Ibu)',
  };
  if (prefix.startsWith('uncle')) return `Paman/Bibi ${n}`;
  return `${labels[prefix] ?? 'Anggota'} ${n}`;
}

function defaultSex(rel: string): DraftSex {
  if (/^(parent|gpP|gpM)-0$/.test(rel)) return 'MALE';
  if (/^(parent|gpP|gpM)-1$/.test(rel)) return 'FEMALE';
  return 'UNKNOWN';
}

function toSex(g: unknown, fallback: DraftSex): DraftSex {
  if (g === 'L' || g === 'male' || g === 'MALE') return 'MALE';
  if (g === 'P' || g === 'female' || g === 'FEMALE') return 'FEMALE';
  return fallback;
}

function unionStatus(s: unknown): DraftUnionStatus {
  if (s === 'ONGOING' || s === 'DIVORCED' || s === 'WIDOWED') return s;
  return 'UNKNOWN';
}

class DraftBuilder {
  readonly persons = new Map<string, DraftPerson>();
  readonly unions = new Map<string, DraftUnion>();
  private readonly parentages = new Map<string, DraftParentage>();
  readonly unmapped = new Set<string>();

  /**
   * Stored records the explorer does not draw (e.g. `parent-1` while
   * parentCount = 1). If such a slot is needed structurally it becomes an
   * empty placeholder — its stale data (and account link) is ignored.
   */
  readonly hidden = new Set<string>();

  constructor(private readonly members: Rec, private readonly ownerUserId: string, private readonly ownerName: string) {}

  /** Ensure a person exists for `key`; unnamed slots become placeholders. */
  person(key: string, rel = key): string {
    if (this.persons.has(key)) return key;
    const m = !this.hidden.has(key) && isObj(this.members[key]) ? this.members[key] : null;
    const isSelf = key === 'self';
    const name = (m?.name as string | undefined)?.trim() || (isSelf ? this.ownerName : '');
    this.persons.set(key, {
      key,
      userId: isSelf ? this.ownerUserId : (m?.linkedUserId || m?.claimedByUserId || null),
      displayName: name || slotLabel(rel),
      sex: toSex(m?.gender, defaultSex(rel)),
      vitalStatus: m?.alive === false ? 'DECEASED' : 'LIVING',
      photo: (m?.photo as string) || null,
      isPlaceholder: !name && !isSelf && !(m?.linkedUserId || m?.claimedByUserId) && !m?.graphPersonId,
      graphPersonId: isSelf ? null : ((m?.graphPersonId as string) || null),
    });
    return key;
  }

  union(a: string, b: string, status: DraftUnionStatus = 'UNKNOWN') {
    const [x, y] = [a, b].sort();
    const key = `${x}|${y}`;
    const existing = this.unions.get(key);
    if (!existing) this.unions.set(key, { key, aKey: a, bKey: b, status });
    else if (existing.status === 'UNKNOWN' && status !== 'UNKNOWN') existing.status = status;
    return key;
  }

  parent(parentKey: string, childKey: string, birthOrder: number | null = null) {
    if (parentKey === childKey) return;
    const key = `${parentKey}|${childKey}`;
    const existing = this.parentages.get(key);
    if (!existing) this.parentages.set(key, { parentKey, childKey, unionKey: null, birthOrder });
    else if (existing.birthOrder == null && birthOrder != null) existing.birthOrder = birthOrder;
  }

  /** Partners of a person among the unions built so far. */
  partnersOf(key: string): string[] {
    const out: string[] = [];
    for (const u of this.unions.values()) {
      if (u.aKey === key) out.push(u.bKey);
      else if (u.bKey === key) out.push(u.aKey);
    }
    return out;
  }

  parentsOf(childKey: string): string[] {
    return [...this.parentages.values()].filter((p) => p.childKey === childKey).map((p) => p.parentKey);
  }

  allParentages() {
    return [...this.parentages.values()];
  }
}

/**
 * Apply one relationship token relative to an ego. `k(rel)` turns a relative
 * token into the absolute key used in this layout.
 */
function applyRelative(
  b: DraftBuilder,
  ego: string,
  k: (rel: string) => string,
  rel: string,
  target: string,
  sib: { older: number },
) {
  const [kind, idxStr] = rel.split(/-(?=\d+$)/);
  const idx = Number(idxStr);
  const father = () => b.person(k('parent-0'), 'parent-0');
  const mother = () => b.person(k('parent-1'), 'parent-1');
  const parentsUnion = () => b.union(father(), mother());

  switch (kind) {
    case 'spouse':
      b.union(ego, target);
      return;
    case 'child':
      b.parent(ego, target, order(idx));
      return;
    case 'parent':
      b.parent(target, ego);
      if (b.persons.has(k('parent-0')) && b.persons.has(k('parent-1'))) parentsUnion();
      return;
    case 'older':
    case 'younger': {
      // Siblings share the ego's drawn parents; only when none is drawn do we
      // add placeholder parents so the sibling relation is not lost.
      const drawn = [k('parent-0'), k('parent-1')].filter((p) => b.persons.has(p) && !b.hidden.has(p));
      const parents = drawn.length ? drawn : [father(), mother()];
      if (parents.length === 2) b.union(parents[0], parents[1]);
      const birth = order(kind === 'older' ? idx : sib.older + 1 + idx);
      for (const p of parents) {
        b.parent(p, target, birth);
        b.parent(p, ego, order(sib.older));
      }
      return;
    }
    case 'gpP':
    case 'gpM': {
      if (idx > 1) { b.unmapped.add(target); return; }
      const child = kind === 'gpP' ? father() : mother();
      b.parent(target, child);
      b.parent(kind === 'gpP' ? father() : mother(), ego);
      const pair = [k(`${kind}-0`), k(`${kind}-1`)];
      if (pair.every((p) => b.persons.has(p))) b.union(pair[0], pair[1]);
      return;
    }
    default: {
      if (kind.startsWith('uncle')) {
        // uncle{P|M}{o|y}-i: sibling of the father (P) or mother (M).
        const side = kind[5] === 'P' ? 'gpP' : 'gpM';
        const gp0 = b.person(k(`${side}-0`), `${side}-0`);
        const gp1 = b.person(k(`${side}-1`), `${side}-1`);
        b.union(gp0, gp1);
        const parentOfEgo = side === 'gpP' ? father() : mother();
        for (const gp of [gp0, gp1]) {
          b.parent(gp, target);
          b.parent(gp, parentOfEgo);
        }
        b.parent(parentOfEgo, ego);
        return;
      }
      if (kind === 'ancP' || kind === 'ancM') {
        // Ancestor chain above the grandfather: anc{P|M}-0 = parent of gp{P|M}-0,
        // anc-i = parent of anc-(i-1) (mirrors configToGraph on the web).
        const side = kind === 'ancP' ? 'gpP' : 'gpM';
        const childKey = idx === 0 ? b.person(k(`${side}-0`), `${side}-0`) : b.person(k(`${kind}-${idx - 1}`), `${kind}-${idx - 1}`);
        b.parent(target, childKey);
        if (idx === 0) b.parent(childKey, side === 'gpP' ? father() : mother());
        return;
      }
      b.unmapped.add(target);
    }
  }
}

/** Birth order is only meaningful for small slot indices (never timestamps). */
const order = (i: number) => (Number.isInteger(i) && i >= 0 && i < 1000 ? i : null);

/** Convert one tree's layout JSON into a graph draft. */
export function layoutToGraphDraft(input: LayoutInput): GraphDraft {
  const members: Rec = isObj(input.members) ? input.members : {};
  const cfg: Rec = isObj(input.config) ? input.config : {};
  const b = new DraftBuilder(members, input.ownerUserId, input.ownerName);
  b.person('self');

  const count = (k: string) => Math.max(0, Math.floor(Number(cfg[k] ?? 0)) || 0);
  const selfOrder = { older: count('olderCount') };
  const selfK = (rel: string) => (rel === 'self' ? 'self' : rel);
  const placed = new Set<string>(['self']);
  const place = (key: string, rel = key) => {
    placed.add(key);
    applyRelative(b, 'self', selfK, rel, b.person(key, rel), selfOrder);
  };

  // 1. Base slots — exactly what the web explorer draws (configToGraph):
  //    a slot `child-3` only exists if childCount > 3, even if data is stored.
  const parentCount = Math.min(2, count('parentCount'));
  const slotCounts: [string, number][] = [
    ['spouse', count('spouseCount')],
    ['child', count('childCount')],
    ['parent', parentCount],
    ['older', count('olderCount')],
    ['younger', count('youngerCount')],
    ['gpP', parentCount > 0 ? count('simbahP') : 0],
    ['gpM', parentCount >= 2 ? count('simbahM') : 0],
  ];
  const limits = new Map(slotCounts);
  for (const [key, m] of Object.entries(members)) {
    const slot = /^(spouse|child|parent|older|younger|gpP|gpM)-(\d+)$/.exec(key);
    if (slot && !(isObj(m) && m.group) && Number(slot[2]) >= (limits.get(slot[1]) ?? 0)) b.hidden.add(key);
  }
  for (const [prefix, n] of slotCounts) {
    for (let i = 0; i < n; i++) {
      const key = `${prefix}-${i}`;
      // Unnamed counted slots are real people; extra grandparent slots (>2) have no defined edge.
      if (cfg.configured || members[key]) {
        if ((prefix === 'gpP' || prefix === 'gpM') && i > 1) { if (members[key]) { b.person(key); placed.add(key); } continue; }
        place(key);
      }
    }
  }
  // Ancestor chain + uncles only where the web would draw them.
  for (const [anc, simbah] of [['ancP', count('simbahP')], ['ancM', count('simbahM')]] as const) {
    if (simbah <= 0) continue;
    for (let i = 0; i < 6; i++) if (isObj(members[`${anc}-${i}`])) place(`${anc}-${i}`);
  }
  for (const [parentKey, side] of [['parent-0', 'P'], ['parent-1', 'M']] as const) {
    const fc = isObj(members[parentKey]?.familyConfig) ? members[parentKey].familyConfig : {};
    const older = Number(fc.olderCount ?? fc.siblingCount ?? 0) || 0;
    const younger = Number(fc.youngerCount ?? 0) || 0;
    if (!b.persons.has(parentKey)) continue;
    for (let i = 0; i < older; i++) place(`uncle${side}o-${i}`);
    for (let i = 0; i < younger; i++) place(`uncle${side}y-${i}`);
  }

  // 2. Per-node sub-trees from a node's familyConfig: `<node>-fc-<rel>-<i>`.
  //    Counts are TOTALS including relatives already drawn (mirrors the web's
  //    configToGraph): only the missing ones — plus slots already filled in —
  //    are generated, so a grandfather set to "1 spouse, 6 children" who
  //    already has his wife and children drawn gets no duplicates.
  const explicit = Object.entries(members)
    .filter(([k, m]) => isObj(m) && m.group && !placed.has(k))
    .map(([k, m]) => ({ key: k, parentId: (m.parentId as string) || null, spouseId: (m.spouseId as string) || null }));
  const isOwnFc = (key: string, owner: string) => key.startsWith(`${owner}-fc-`);
  const existing = (nodeKey: string) => {
    const spouses = new Set(b.partnersOf(nodeKey).filter((k) => !isOwnFc(k, nodeKey)));
    for (const e of explicit) if (e.spouseId === nodeKey) spouses.add(e.key);
    const ownSpouse = members[nodeKey]?.spouseId;
    if (typeof ownSpouse === 'string' && ownSpouse) spouses.add(ownSpouse);
    const childParents = new Set([nodeKey, ...spouses]);
    const children = new Set(
      b.allParentages().filter((p) => childParents.has(p.parentKey) && !isOwnFc(p.childKey, nodeKey)).map((p) => p.childKey),
    );
    for (const e of explicit) if (e.parentId && childParents.has(e.parentId)) children.add(e.key);
    const parents = new Set(b.parentsOf(nodeKey));
    const siblings = new Set(
      b.allParentages().filter((p) => parents.has(p.parentKey) && p.childKey !== nodeKey && !isOwnFc(p.childKey, nodeKey)).map((p) => p.childKey),
    );
    for (const e of explicit) if (e.parentId && parents.has(e.parentId) && e.key !== nodeKey) siblings.add(e.key);
    return { spouses: spouses.size, children: children.size, siblings: siblings.size };
  };
  const fcIndices = (nodeKey: string, rel: string, missing: number) => {
    const idx = new Set<number>(Array.from({ length: Math.max(0, missing) }, (_, i) => i));
    const prefix = `${nodeKey}-fc-${rel}-`;
    for (const [k, m] of Object.entries(members)) {
      if (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)) && isObj(m) && m.name) idx.add(Number(k.slice(prefix.length)));
    }
    return [...idx].sort((x, y) => x - y);
  };

  for (const nodeKey of [...b.persons.keys()]) {
    const fc = isObj(members[nodeKey]?.familyConfig) ? members[nodeKey].familyConfig : null;
    if (!fc) continue;
    const have = existing(nodeKey);
    const fcKey = (rel: string) => `${nodeKey}-fc-${rel}`;
    const ensure = (rel: string) => { placed.add(fcKey(rel)); return b.person(fcKey(rel), rel); };
    for (const i of fcIndices(nodeKey, 'spouse', (Number(fc.spouseCount) || 0) - have.spouses)) b.union(nodeKey, ensure(`spouse-${i}`));
    for (const i of fcIndices(nodeKey, 'child', (Number(fc.childCount) || 0) - have.children)) b.parent(nodeKey, ensure(`child-${i}`), order(i));
    let parents = b.parentsOf(nodeKey);
    const pc = Math.min(2, Number(fc.parentCount) || 0);
    if (pc > 0 && parents.length === 0) {
      parents = Array.from({ length: pc }, (_, i) => ensure(`parent-${i}`));
      for (const p of parents) b.parent(p, nodeKey);
      if (parents.length === 2) b.union(parents[0], parents[1]);
    }
    if (nodeKey === 'parent-0' || nodeKey === 'parent-1') continue; // siblings handled as uncles
    const older = Number(fc.olderCount ?? fc.siblingCount ?? 0) || 0;
    const younger = Number(fc.youngerCount ?? 0) || 0;
    const missingSiblings = Math.max(0, older + younger - have.siblings);
    const missingOlder = Math.min(older, missingSiblings);
    const sibs = [
      ...fcIndices(nodeKey, 'older', missingOlder).map((i) => ensure(`older-${i}`)),
      ...fcIndices(nodeKey, 'younger', missingSiblings - missingOlder).map((i) => ensure(`younger-${i}`)),
    ];
    for (const s of sibs) for (const p of parents) b.parent(p, s);
  }

  // 3. Stored members that are not base slots.
  for (const key of Object.keys(members)) {
    if (placed.has(key)) continue;
    const m = members[key];
    if (!isObj(m)) { b.unmapped.add(key); continue; }

    // Circles added through the tree UI carry `group` + explicit relations,
    // whatever their key looks like (e.g. `child-1785683950690370`).
    if (m.group) {
      b.person(key);
      if (typeof m.spouseId === 'string' && m.spouseId && m.spouseId !== key) b.union(b.person(m.spouseId), key);
      if (typeof m.parentId === 'string' && m.parentId && m.parentId !== key) b.parent(b.person(m.parentId), key, null);
      continue;
    }

    // Per-node sub-tree records saved for slots not counted any more are stale.
    if (/-fc-/.test(key)) { b.unmapped.add(key); continue; }

    // Married-in ancestry on the public page: spouse-N-<rel>, and legacy child-N-spouse.
    const ns = NAMESPACED_RE.exec(key);
    if (ns && /^spouse-\d+$/.test(ns[1]) && b.persons.has(ns[1])) {
      const [, ego, rel] = ns;
      const egoOrder = { older: Object.keys(members).filter((x) => x.startsWith(`${ego}-older-`)).length };
      applyRelative(b, ego, (r) => (r === 'self' ? ego : `${ego}-${r}`), rel, b.person(key, rel), egoOrder);
      continue;
    }
    const legacySpouse = /^(child-\d+)-spouse$/.exec(key);
    if (legacySpouse && b.persons.has(legacySpouse[1])) { b.union(legacySpouse[1], b.person(key)); continue; }

    // Anything else is not drawn by the explorer (e.g. data left after a count
    // was reduced, or junk keys) — report it, don't invent relations.
    b.unmapped.add(key);
  }

  // 3. Owner's first union carries FamilyTree.marriageStatus.
  if (b.persons.has('spouse-0')) b.union('self', 'spouse-0', unionStatus(input.marriageStatus));

  // 4. Co-parents: a child of X is also the child of X's only partner.
  finishCoParents(b);

  return { persons: b.persons, parentages: b.allParentages(), unions: [...b.unions.values()], unmapped: [...b.unmapped] };
}

function finishCoParents(b: DraftBuilder) {
  for (const p of b.allParentages()) {
    const parents = b.parentsOf(p.childKey);
    if (parents.length >= 2) {
      const u = b.unions.get([...parents].slice(0, 2).sort().join('|'));
      if (u) for (const q of b.allParentages()) if (q.childKey === p.childKey && parents.includes(q.parentKey)) q.unionKey = u.key;
      continue;
    }
    const partners = b.partnersOf(p.parentKey);
    if (partners.length !== 1) continue;
    const [other] = partners;
    if (other === p.childKey) continue;
    b.parent(other, p.childKey, p.birthOrder);
    const unionKey = [p.parentKey, other].sort().join('|');
    for (const q of b.allParentages()) {
      if (q.childKey === p.childKey && (q.parentKey === p.parentKey || q.parentKey === other)) q.unionKey = unionKey;
    }
  }
}

// ─── Table-based members (FamilyMember rows) ────────────────────

export interface FamilyMemberRow {
  id: string;
  userId: string | null;
  name: string;
  gender: string | null;
  deathDate: Date | null;
  photo: string | null;
  isCreator: boolean;
  parentId: string | null;
  spouseId: string | null;
  childOrder: number | null;
}

/** F1-05 — FamilyMember rows of one tree, keyed `fm:<id>`. */
export function familyMembersToGraphDraft(rows: FamilyMemberRow[], ownerUserId: string): GraphDraft {
  const b = new DraftBuilder({}, ownerUserId, '');
  const keyOf = (id: string) => `fm:${id}`;
  for (const r of rows) {
    b.persons.set(keyOf(r.id), {
      key: keyOf(r.id),
      userId: r.isCreator ? ownerUserId : r.userId,
      displayName: r.name,
      sex: toSex(r.gender, 'UNKNOWN'),
      vitalStatus: r.deathDate ? 'DECEASED' : 'LIVING',
      photo: r.photo,
      isPlaceholder: false,
    });
  }
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    if (r.spouseId && ids.has(r.spouseId)) b.union(keyOf(r.id), keyOf(r.spouseId));
  }
  for (const r of rows) {
    if (r.parentId && ids.has(r.parentId)) b.parent(keyOf(r.parentId), keyOf(r.id), r.childOrder);
  }
  finishCoParents(b);
  return { persons: b.persons, parentages: b.allParentages(), unions: [...b.unions.values()], unmapped: [] };
}
