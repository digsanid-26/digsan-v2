/**
 * F2-04 / F2-06 — pure rules for duplicate detection and merging.
 *
 * Detection is STRUCTURAL first (two people of the same sex recorded as the
 * biological parent of the same child are almost certainly one person drawn
 * twice) and uses names only to rank. Nothing is merged automatically: every
 * candidate needs the approval of the stewards of both Persons.
 */
import type { Graph, GPerson } from './graph-rules.util';

export type MergeReason = 'SHARED_CHILD' | 'SAME_PARENTS' | 'SIMILAR_NAME' | 'SAME_NAME' | 'PLACEHOLDER';

export interface MergePerson extends GPerson {
  userId?: string | null;
  mergedIntoId?: string | null;
  createdAt?: Date;
}

export interface CandidatePair { personAId: string; personBId: string; score: number; reasons: MergeReason[] }

// ─── Names ─────────────────────────────────────────────────────

const HONORIFICS = new Set([
  'h', 'hj', 'haji', 'hajjah', 'bapak', 'bpk', 'pak', 'ibu', 'bu', 'mbah', 'simbah', 'eyang', 'kakek', 'nenek',
  'alm', 'almh', 'almarhum', 'almarhumah', 'dr', 'drs', 'dra', 'ir', 'kh', 'ust', 'ustadz', 'ustadzah', 'raden', 'r', 'mas', 'mbak',
]);

/** Lowercase, strip honorifics/titles and punctuation: "H. Nurhamid, S.Pd" → "nurhamid". */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .split(',')[0]
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ');
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a ? 1 : 0;
  if (!a || !b) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array(a.length).fill(false);
  const bHit = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = bHit[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[j]) j++;
    if (a[i] !== b[j]) t++;
    j++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Similarity of two person names: best of whole-name and token-subset matching. */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const tx = x.split(' ');
  const ty = y.split(' ');
  // "Asmuni" vs "Asmuni Saeful Gani": every token of the shorter name appears in the longer one.
  const [short, long] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  const subset = short.every((t) => long.some((u) => jaroWinkler(t, u) >= 0.92)) ? 0.9 : 0;
  return Math.max(jaroWinkler(x, y), subset);
}

// ─── Detection ─────────────────────────────────────────────────

const compatibleSex = (a: GPerson['sex'], b: GPerson['sex']) => a === b || a === 'UNKNOWN' || b === 'UNKNOWN';

/**
 * Why two Persons may NOT be merged (null = allowed).
 * Two accounts are two real people; a parent and child, or partners, are
 * obviously different; merging an ancestor with a descendant creates a cycle.
 */
export function mergeBlocker(g: Graph, persons: Map<string, MergePerson>, aId: string, bId: string): string | null {
  const a = persons.get(aId);
  const b = persons.get(bId);
  if (!a || !b) return 'Orang tidak ditemukan';
  if (aId === bId) return 'Orang yang sama';
  if (a.mergedIntoId || b.mergedIntoId) return 'Salah satu sudah digabung sebelumnya';
  if (a.userId && b.userId) return 'Keduanya memiliki akun sendiri — tidak dapat digabung';
  if (!compatibleSex(a.sex, b.sex)) return 'Jenis kelamin berbeda';
  if (g.unions.some((u) => (u.aId === aId && u.bId === bId) || (u.aId === bId && u.bId === aId))) return 'Keduanya tercatat sebagai pasangan';
  const ancestorsOf = (id: string) => {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const p of g.parentages) if (p.childId === cur && !seen.has(p.parentId)) { seen.add(p.parentId); stack.push(p.parentId); }
    }
    return seen;
  };
  if (ancestorsOf(aId).has(bId) || ancestorsOf(bId).has(aId)) return 'Salah satu adalah leluhur/keturunan yang lain';
  return null;
}

/**
 * Candidate pairs, best first.
 *  - SHARED_CHILD: two same-sex biological parents of one child (the classic
 *    "siblings each drew the father" duplicate) — strong.
 *  - SAME_PARENTS + similar name: a child recorded twice under the same parents.
 */
export function findMergeCandidates(g: Graph, persons: Map<string, MergePerson>, minScore = 0.6): CandidatePair[] {
  const out = new Map<string, CandidatePair>();
  const add = (aId: string, bId: string, score: number, reasons: MergeReason[]) => {
    const [x, y] = [aId, bId].sort();
    if (mergeBlocker(g, persons, x, y)) return;
    const prev = out.get(`${x}|${y}`);
    if (!prev || prev.score < score) {
      out.set(`${x}|${y}`, { personAId: x, personBId: y, score: Math.min(1, Math.round(score * 100) / 100), reasons: [...new Set([...(prev?.reasons ?? []), ...reasons])] });
    }
  };
  const live = (id: string) => !!persons.get(id) && !persons.get(id)!.mergedIntoId;

  const byChild = new Map<string, string[]>();
  const byParent = new Map<string, string[]>();
  for (const p of g.parentages) {
    if (p.kind !== 'BIOLOGICAL' || p.status === 'REJECTED' || p.status === 'RETRACTED') continue;
    if (!live(p.parentId) || !live(p.childId)) continue;
    byChild.set(p.childId, [...(byChild.get(p.childId) ?? []), p.parentId]);
    byParent.set(p.parentId, [...(byParent.get(p.parentId) ?? []), p.childId]);
  }

  for (const parents of byChild.values()) {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const a = persons.get(parents[i])!;
        const b = persons.get(parents[j])!;
        if (!compatibleSex(a.sex, b.sex)) continue;
        // Two parents of unknown sex are probably father + mother, not duplicates.
        if (a.sex === 'UNKNOWN' && b.sex === 'UNKNOWN') continue;
        const sim = nameSimilarity(a.displayName, b.displayName);
        const reasons: MergeReason[] = ['SHARED_CHILD'];
        if (sim === 1) reasons.push('SAME_NAME');
        else if (sim >= 0.85) reasons.push('SIMILAR_NAME');
        if (a.isPlaceholder || b.isPlaceholder) reasons.push('PLACEHOLDER');
        add(a.id, b.id, 0.6 + 0.3 * sim + (a.isPlaceholder || b.isPlaceholder ? 0.05 : 0), reasons);
      }
    }
  }

  for (const children of byParent.values()) {
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const a = persons.get(children[i])!;
        const b = persons.get(children[j])!;
        if (a.isPlaceholder || b.isPlaceholder || !compatibleSex(a.sex, b.sex)) continue;
        const sim = nameSimilarity(a.displayName, b.displayName);
        if (sim < 0.85) continue;
        add(a.id, b.id, 0.45 + 0.4 * sim, ['SAME_PARENTS', sim === 1 ? 'SAME_NAME' : 'SIMILAR_NAME']);
      }
    }
  }

  return [...out.values()].filter((c) => c.score >= minScore).sort((x, y) => y.score - x.score);
}

// ─── Merge planning ────────────────────────────────────────────

/** Which Person survives: the one with an account, else a named one, else the oldest. */
export function chooseSurvivor(a: MergePerson, b: MergePerson): [keep: MergePerson, drop: MergePerson] {
  const rank = (p: MergePerson) => (p.userId ? 4 : 0) + (p.isPlaceholder ? 0 : 2);
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? [a, b] : [b, a];
  return (a.createdAt?.getTime() ?? 0) <= (b.createdAt?.getTime() ?? 0) ? [a, b] : [b, a];
}
