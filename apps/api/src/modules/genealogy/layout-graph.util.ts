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
const BASE_RE = new RegExp(`^(?:self|${REL_TOKEN})$`);

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

  constructor(private readonly members: Rec, private readonly ownerUserId: string, private readonly ownerName: string) {}

  /** Ensure a person exists for `key`; unnamed slots become placeholders. */
  person(key: string, rel = key): string {
    if (this.persons.has(key)) return key;
    const m = isObj(this.members[key]) ? this.members[key] : null;
    const isSelf = key === 'self';
    const name = (m?.name as string | undefined)?.trim() || (isSelf ? this.ownerName : '');
    this.persons.set(key, {
      key,
      userId: isSelf ? this.ownerUserId : (m?.linkedUserId || m?.claimedByUserId || null),
      displayName: name || slotLabel(rel),
      sex: toSex(m?.gender, defaultSex(rel)),
      vitalStatus: m?.alive === false ? 'DECEASED' : 'LIVING',
      photo: (m?.photo as string) || null,
      isPlaceholder: !name && !isSelf && !(m?.linkedUserId || m?.claimedByUserId),
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
  order: { older: number },
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
      b.parent(ego, target, idx);
      return;
    case 'parent':
      b.parent(target, ego);
      if (b.persons.has(k('parent-0')) && b.persons.has(k('parent-1'))) parentsUnion();
      return;
    case 'older':
    case 'younger': {
      parentsUnion();
      const birth = kind === 'older' ? idx : order.older + 1 + idx;
      b.parent(father(), target, birth);
      b.parent(mother(), target, birth);
      b.parent(father(), ego, order.older);
      b.parent(mother(), ego, order.older);
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
      // ancP/ancM (buyut, canggah …): generation unknown — keep the person, no edge.
      b.unmapped.add(target);
    }
  }
}

/** Convert one tree's layout JSON into a graph draft. */
export function layoutToGraphDraft(input: LayoutInput): GraphDraft {
  const members: Rec = isObj(input.members) ? input.members : {};
  const cfg: Rec = isObj(input.config) ? input.config : {};
  const b = new DraftBuilder(members, input.ownerUserId, input.ownerName);
  b.person('self');

  const count = (k: string) => Math.max(0, Math.floor(Number(cfg[k] ?? 0)) || 0);
  const selfOrder = { older: count('olderCount') };
  const selfK = (rel: string) => (rel === 'self' ? 'self' : rel);

  // 1. Slots the owner counted in the setup form (even unnamed ones are real people).
  if (cfg.configured) {
    const slots: [string, number][] = [
      ['spouse', count('spouseCount')],
      ['child', count('childCount')],
      ['parent', Math.min(2, count('parentCount'))],
      ['older', count('olderCount')],
      ['younger', count('youngerCount')],
    ];
    for (const [prefix, n] of slots) {
      for (let i = 0; i < n; i++) {
        const key = b.person(`${prefix}-${i}`);
        applyRelative(b, 'self', selfK, key, key, selfOrder);
      }
    }
  }

  // 2. Every stored member, base keys first so namespaced egos already exist.
  const keys = Object.keys(members).sort((x, y) => x.split('-').length - y.split('-').length);
  for (const key of keys) {
    if (key === 'self') continue;
    const m = members[key];
    if (!isObj(m)) { b.unmapped.add(key); continue; }

    if (BASE_RE.test(key)) {
      applyRelative(b, 'self', selfK, key, b.person(key), selfOrder);
      continue;
    }

    // Explicitly added circles (recursive tree UI): relations are stored on the node.
    if (m.parentId || m.spouseId) {
      b.person(key);
      if (typeof m.spouseId === 'string' && m.spouseId) b.union(b.person(m.spouseId), key);
      if (typeof m.parentId === 'string' && m.parentId) b.parent(b.person(m.parentId), key, null);
      continue;
    }

    // Namespaced: "<ego>-<rel>", e.g. spouse-0-parent-1, child-1-spouse-0.
    const ns = NAMESPACED_RE.exec(key);
    if (ns) {
      const [, ego, rel] = ns;
      b.person(ego);
      const egoOrder = { older: Object.keys(members).filter((x) => x.startsWith(`${ego}-older-`)).length };
      applyRelative(b, ego, (r) => (r === 'self' ? ego : `${ego}-${r}`), rel, b.person(key, rel), egoOrder);
      continue;
    }

    // Legacy shapes written by the old connection sync.
    const legacySpouse = /^(.+)-spouse$/.exec(key);
    if (legacySpouse) { b.union(b.person(legacySpouse[1]), b.person(key)); continue; }
    const legacySibling = /^sibling-(\d+)$/.exec(key);
    if (legacySibling) { applyRelative(b, 'self', selfK, `older-${legacySibling[1]}`, b.person(key), selfOrder); continue; }
    const legacyGp = /^grandparent-([pm])-(\d+)$/.exec(key);
    if (legacyGp) {
      applyRelative(b, 'self', selfK, `${legacyGp[1] === 'p' ? 'gpP' : 'gpM'}-${Math.max(0, Number(legacyGp[2]) - 1)}`, b.person(key), selfOrder);
      continue;
    }

    if (m.name) b.person(key);
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
