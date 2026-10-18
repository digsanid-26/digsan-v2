/**
 * Pure graph rules over Person / Parentage / Union:
 *  - F1-07 invariants (cycles, too many biological parents, partner = own parent/child, date order)
 *  - F1-09 kinship calculator: "who is X to me?" in Indonesian, derived from
 *    the graph instead of being stored as ego-relative keys.
 */

export type ParentageKindT = 'BIOLOGICAL' | 'ADOPTIVE' | 'STEP' | 'FOSTER' | 'GUARDIAN' | 'DONOR' | 'SURROGATE';

export interface GPerson { id: string; sex: 'MALE' | 'FEMALE' | 'UNKNOWN'; birthDate?: Date | null; isPlaceholder?: boolean; displayName?: string }
export interface GParentage {
  parentId: string;
  childId: string;
  kind: ParentageKindT;
  certainty?: string;
  status?: string;
  birthOrder?: number | null;
}
export interface GUnion { aId: string; bId: string | null; status?: string }

export interface Graph {
  persons: Map<string, GPerson>;
  parentages: GParentage[];
  unions: GUnion[];
}

export function buildGraph(persons: GPerson[], parentages: GParentage[], unions: GUnion[]): Graph {
  return { persons: new Map(persons.map((p) => [p.id, p])), parentages, unions };
}

const LINEAGE_DEFAULT: ParentageKindT[] = ['BIOLOGICAL', 'ADOPTIVE'];

function parentsOf(g: Graph, id: string, kinds: ParentageKindT[]) {
  return g.parentages.filter((p) => p.childId === id && kinds.includes(p.kind) && p.status !== 'REJECTED' && p.status !== 'RETRACTED');
}
function childrenOf(g: Graph, id: string, kinds: ParentageKindT[]) {
  return g.parentages.filter((p) => p.parentId === id && kinds.includes(p.kind) && p.status !== 'REJECTED' && p.status !== 'RETRACTED');
}
function partnersOf(g: Graph, id: string) {
  return g.unions
    .filter((u) => u.bId && (u.aId === id || u.bId === id))
    .map((u) => ({ id: u.aId === id ? u.bId! : u.aId, status: u.status }));
}

// ─── F1-07 invariants ──────────────────────────────────────────

/** True if adding parent→child would make someone their own ancestor. */
export function wouldCreateCycle(g: Graph, parentId: string, childId: string): boolean {
  if (parentId === childId) return true;
  const seen = new Set<string>();
  const stack = [parentId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === childId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of g.parentages) if (p.childId === cur) stack.push(p.parentId);
  }
  return false;
}

export type IssueCode =
  | 'CYCLE'
  | 'MULTIPLE_CONFIRMED_BIO_PARENTS'
  | 'DUPLICATE_PARENT_SUSPECT'
  | 'UNION_WITH_PARENT_OR_CHILD'
  | 'CHILD_OLDER_THAN_PARENT';

export interface GraphIssue { code: IssueCode; severity: 'error' | 'warning'; personIds: string[]; message: string }

/**
 * Check the graph. Errors are hard violations; warnings flag likely duplicates
 * (e.g. two different "Ayah" placeholders for siblings who drew their parents
 * separately) that should become merge candidates.
 */
export function checkGraph(g: Graph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const name = (id: string) => g.persons.get(id)?.displayName ?? id;

  // Cycles: DFS with colouring over parent edges.
  const color = new Map<string, number>();
  const visit = (id: string, path: string[]): void => {
    color.set(id, 1);
    for (const p of g.parentages) {
      if (p.childId !== id) continue;
      const c = color.get(p.parentId) ?? 0;
      if (c === 1) issues.push({ code: 'CYCLE', severity: 'error', personIds: [...path, p.parentId], message: `Siklus keturunan melibatkan ${name(p.parentId)}` });
      else if (c === 0) visit(p.parentId, [...path, p.parentId]);
    }
    color.set(id, 2);
  };
  for (const id of g.persons.keys()) if (!color.get(id)) visit(id, [id]);

  for (const childId of g.persons.keys()) {
    const bio = parentsOf(g, childId, ['BIOLOGICAL']);
    for (const sex of ['MALE', 'FEMALE'] as const) {
      const same = bio.filter((p) => g.persons.get(p.parentId)?.sex === sex);
      const confirmed = same.filter((p) => p.certainty === 'CONFIRMED' && p.status === 'CONFIRMED');
      if (confirmed.length > 1) {
        issues.push({
          code: 'MULTIPLE_CONFIRMED_BIO_PARENTS', severity: 'error',
          personIds: [childId, ...confirmed.map((p) => p.parentId)],
          message: `${name(childId)} memiliki lebih dari satu ${sex === 'MALE' ? 'ayah' : 'ibu'} biologis terkonfirmasi`,
        });
      } else if (same.length > 1) {
        issues.push({
          code: 'DUPLICATE_PARENT_SUSPECT', severity: 'warning',
          personIds: [childId, ...same.map((p) => p.parentId)],
          message: `${name(childId)} memiliki ${same.length} ${sex === 'MALE' ? 'ayah' : 'ibu'} biologis (${same.map((p) => name(p.parentId)).join(', ')}) — kemungkinan orang yang sama tercatat ganda`,
        });
      }
    }
  }

  for (const u of g.unions) {
    if (!u.bId) continue;
    const related = g.parentages.some(
      (p) => (p.parentId === u.aId && p.childId === u.bId) || (p.parentId === u.bId && p.childId === u.aId),
    );
    if (related) issues.push({ code: 'UNION_WITH_PARENT_OR_CHILD', severity: 'error', personIds: [u.aId, u.bId], message: `${name(u.aId)} dan ${name(u.bId)} tercatat sebagai pasangan sekaligus orang tua–anak` });
  }

  for (const p of g.parentages) {
    const parent = g.persons.get(p.parentId);
    const child = g.persons.get(p.childId);
    if (parent?.birthDate && child?.birthDate && child.birthDate <= parent.birthDate && p.kind === 'BIOLOGICAL') {
      issues.push({ code: 'CHILD_OLDER_THAN_PARENT', severity: 'warning', personIds: [p.parentId, p.childId], message: `${name(p.childId)} lahir sebelum orang tuanya ${name(p.parentId)}` });
    }
  }
  return issues;
}

// ─── F1-09 kinship calculator ─────────────────────────────────

export interface Kinship {
  /** Machine code, e.g. PARENT, SIBLING_FULL, COUSIN, PARENT_IN_LAW. */
  code: string;
  /** Indonesian label, e.g. "Ibu", "Kakak (seayah)", "Sepupu derajat 2". */
  label: string;
  /** Generations from ego / other up to the common ancestor (blood relations). */
  up?: number;
  down?: number;
  /** Which parent of ego the relation runs through. */
  side?: 'AYAH' | 'IBU';
}

const ANCESTOR_TERMS = ['', 'Orang tua', 'Kakek/Nenek', 'Buyut', 'Canggah', 'Wareng', 'Udheg-udheg', 'Gantung siwur', 'Gropak senthe'];
const DESCENDANT_TERMS = ['', 'Anak', 'Cucu', 'Cicit', 'Piut'];

function gendered(sex: GPerson['sex'] | undefined, male: string, female: string, neutral: string) {
  return sex === 'MALE' ? male : sex === 'FEMALE' ? female : neutral;
}

interface AncestorInfo { depth: number; via: string | null; adoptive: boolean }

/** All ancestors (including self at depth 0) with the first parent on the path. */
function ancestorMap(g: Graph, id: string, kinds: ParentageKindT[]): Map<string, AncestorInfo> {
  const out = new Map<string, AncestorInfo>([[id, { depth: 0, via: null, adoptive: false }]]);
  let frontier = [id];
  for (let depth = 1; frontier.length && depth <= 40; depth++) {
    const next: string[] = [];
    for (const cur of frontier) {
      const curInfo = out.get(cur)!;
      for (const p of parentsOf(g, cur, kinds)) {
        if (out.has(p.parentId)) continue;
        out.set(p.parentId, { depth, via: curInfo.via ?? p.parentId, adoptive: curInfo.adoptive || p.kind === 'ADOPTIVE' });
        next.push(p.parentId);
      }
    }
    frontier = next;
  }
  return out;
}

function sideOf(g: Graph, via: string | null): 'AYAH' | 'IBU' | undefined {
  const sex = via ? g.persons.get(via)?.sex : undefined;
  return sex === 'MALE' ? 'AYAH' : sex === 'FEMALE' ? 'IBU' : undefined;
}

function bloodKinship(g: Graph, egoId: string, otherId: string, kinds: ParentageKindT[]): Kinship | null {
  if (egoId === otherId) return { code: 'SELF', label: 'Diri sendiri', up: 0, down: 0 };
  const a = ancestorMap(g, egoId, kinds);
  const b = ancestorMap(g, otherId, kinds);
  let best: { up: number; down: number; anc: string } | null = null;
  for (const [anc, ia] of a) {
    const ib = b.get(anc);
    if (!ib) continue;
    if (!best || ia.depth + ib.depth < best.up + best.down) best = { up: ia.depth, down: ib.depth, anc };
  }
  if (!best) return null;

  const other = g.persons.get(otherId);
  const { up, down } = best;
  const adoptive = (a.get(best.anc)?.adoptive || b.get(best.anc)?.adoptive) ?? false;
  const angkat = adoptive ? ' angkat' : '';
  const side = sideOf(g, a.get(best.anc)?.via ?? null);
  const sideLabel = side ? ` (pihak ${side.toLowerCase()})` : '';

  if (down === 0) {
    if (up === 1) return { code: 'PARENT', label: gendered(other?.sex, 'Ayah', 'Ibu', 'Orang tua') + angkat, up, down };
    if (up === 2) return { code: 'GRANDPARENT', label: gendered(other?.sex, 'Kakek', 'Nenek', 'Kakek/Nenek') + angkat + sideLabel, up, down, side };
    return { code: 'ANCESTOR', label: (ANCESTOR_TERMS[up] ?? `Leluhur generasi ke-${up}`) + angkat + sideLabel, up, down, side };
  }
  if (up === 0) {
    return { code: down === 1 ? 'CHILD' : 'DESCENDANT', label: (DESCENDANT_TERMS[down] ?? `Keturunan generasi ke-${down}`) + angkat, up, down };
  }
  if (up === 1 && down === 1) {
    const egoParents = new Set(parentsOf(g, egoId, kinds).map((p) => p.parentId));
    const shared = parentsOf(g, otherId, kinds).filter((p) => egoParents.has(p.parentId));
    const sharedBio = shared.filter((p) => p.kind === 'BIOLOGICAL');
    const elder = compareAge(g, egoId, otherId, shared.map((p) => p.parentId));
    const base = elder === 'OTHER_OLDER' ? 'Kakak' : elder === 'OTHER_YOUNGER' ? 'Adik' : 'Saudara';
    if (adoptive || sharedBio.length === 0) return { code: 'SIBLING_ADOPTIVE', label: `${base} angkat`, up, down };
    if (sharedBio.length >= 2 || egoParents.size === 1) return { code: 'SIBLING_FULL', label: `${base} kandung`, up, down };
    const via = g.persons.get(sharedBio[0].parentId)?.sex;
    return { code: 'SIBLING_HALF', label: `${base} (${via === 'MALE' ? 'seayah' : via === 'FEMALE' ? 'seibu' : 'satu orang tua'})`, up, down };
  }
  if (up === 2 && down === 1) return { code: 'PARENT_SIBLING', label: gendered(other?.sex, 'Paman', 'Bibi', 'Paman/Bibi') + angkat + sideLabel, up, down, side };
  if (up === 1 && down === 2) return { code: 'SIBLING_CHILD', label: 'Keponakan' + angkat, up, down };
  if (up >= 2 && down >= 2) {
    const degree = Math.min(up, down) - 1;
    const removed = Math.abs(up - down);
    const label = `Sepupu${degree > 1 ? ` derajat ${degree}` : ''}${removed ? `, ${removed} generasi ${up > down ? 'di atas' : 'di bawah'}` : ''}`;
    return { code: 'COUSIN', label: label + angkat + sideLabel, up, down, side };
  }
  if (down === 1) return { code: 'ANCESTOR_SIBLING', label: `Saudara ${ANCESTOR_TERMS[up - 1]?.toLowerCase() || `leluhur ke-${up - 1}`}${sideLabel}`, up, down, side };
  return { code: 'SIBLING_DESCENDANT', label: `${DESCENDANT_TERMS[down - 1] ?? 'Keturunan'} saudara`, up, down };
}

function compareAge(g: Graph, egoId: string, otherId: string, sharedParents: string[]): 'OTHER_OLDER' | 'OTHER_YOUNGER' | null {
  const ego = g.persons.get(egoId);
  const other = g.persons.get(otherId);
  if (ego?.birthDate && other?.birthDate) return other.birthDate < ego.birthDate ? 'OTHER_OLDER' : 'OTHER_YOUNGER';
  for (const pid of sharedParents) {
    const e = g.parentages.find((p) => p.parentId === pid && p.childId === egoId)?.birthOrder;
    const o = g.parentages.find((p) => p.parentId === pid && p.childId === otherId)?.birthOrder;
    if (e != null && o != null && e !== o) return o < e ? 'OTHER_OLDER' : 'OTHER_YOUNGER';
  }
  return null;
}

/**
 * "Who is `otherId` to `egoId`?" Tries blood (by lineage mode), then partner,
 * then one marriage hop (in-laws, step relations).
 *
 * `kinds` selects the lineage mode: ['BIOLOGICAL'] = nasab/biologis,
 * ['BIOLOGICAL','ADOPTIVE'] (default) = hukum.
 */
export function relationOf(g: Graph, egoId: string, otherId: string, kinds: ParentageKindT[] = LINEAGE_DEFAULT): Kinship | null {
  const blood = bloodKinship(g, egoId, otherId, kinds);
  if (blood) return blood;

  const other = g.persons.get(otherId);
  const partner = partnersOf(g, egoId).find((p) => p.id === otherId);
  if (partner) {
    const ex = partner.status === 'DIVORCED' ? ' (mantan)' : '';
    return { code: 'PARTNER', label: gendered(other?.sex, 'Suami', 'Istri', 'Pasangan') + ex };
  }

  // Ego's partner's blood relatives: mertua, ipar, anak tiri.
  for (const p of partnersOf(g, egoId)) {
    const k = bloodKinship(g, p.id, otherId, kinds);
    if (!k) continue;
    if (k.code === 'PARENT') return { code: 'PARENT_IN_LAW', label: gendered(other?.sex, 'Ayah mertua', 'Ibu mertua', 'Mertua') };
    if (k.code.startsWith('SIBLING_') && k.up === 1) return { code: 'SIBLING_IN_LAW', label: 'Ipar' };
    if (k.code === 'CHILD') return { code: 'STEPCHILD', label: 'Anak tiri' };
    return { code: 'IN_LAW', label: `${k.label} dari pasangan` };
  }

  // Partners of ego's blood relatives: menantu, ipar, ayah/ibu tiri, besan.
  for (const p of partnersOf(g, otherId)) {
    const k = bloodKinship(g, egoId, p.id, kinds);
    if (!k) continue;
    if (k.code === 'CHILD') return { code: 'CHILD_IN_LAW', label: 'Menantu' };
    if (k.code.startsWith('SIBLING_')) return { code: 'SIBLING_IN_LAW', label: 'Ipar' };
    if (k.code === 'PARENT') return { code: 'STEPPARENT', label: gendered(other?.sex, 'Ayah tiri', 'Ibu tiri', 'Orang tua tiri') };
    return { code: 'IN_LAW', label: `Pasangan ${k.label.toLowerCase()}` };
  }

  // Step-siblings: our parents are partners, but we share no parent.
  const egoParents = parentsOf(g, egoId, kinds).map((p) => p.parentId);
  const otherParents = parentsOf(g, otherId, kinds).map((p) => p.parentId);
  if (egoParents.some((ep) => partnersOf(g, ep).some((pp) => otherParents.includes(pp.id)))) {
    return { code: 'STEP_SIBLING', label: 'Saudara tiri' };
  }

  // Co-parents-in-law: our children are married to each other.
  const egoChildren = childrenOf(g, egoId, kinds).map((c) => c.childId);
  const otherChildren = childrenOf(g, otherId, kinds).map((c) => c.childId);
  if (egoChildren.some((c) => partnersOf(g, c).some((pp) => otherChildren.includes(pp.id)))) {
    return { code: 'CO_PARENT_IN_LAW', label: 'Besan' };
  }
  return null;
}
