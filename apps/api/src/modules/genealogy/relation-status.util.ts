/**
 * F2-03 — two-way confirmation of relationships. Pure (no Prisma).
 *
 * Every end of a relationship that is a Person with an account must agree:
 * the account itself (or the guardian of an early-access account). An end
 * agrees when its approver asserts the relationship from their own tree, or
 * explicitly confirms it. Ends without an account (placeholders, the deceased)
 * are managed by whoever draws them and need no confirmation.
 */

export type RelStatusT = 'PROPOSED' | 'CONFIRMED' | 'REJECTED';

export interface RelationEnd {
  personId: string;
  /** Who decides for this end; empty when the person has no account. */
  approvers: string[];
}

export interface RelationEvaluation {
  status: RelStatusT;
  /** Approvers whose end has not agreed yet (only when PROPOSED). */
  pending: string[];
}

export function evaluateRelation(
  ends: RelationEnd[],
  /** Owners of the trees that assert this relationship. */
  assertedBy: ReadonlySet<string>,
  /** Explicit decisions: userId → approve. */
  decisions: ReadonlyMap<string, boolean>,
): RelationEvaluation {
  const pending: string[] = [];
  let rejected = false;
  for (const end of ends) {
    if (!end.approvers.length) continue;
    // Drawing it in your own tree is the strongest agreement (it also
    // overrides an earlier rejection: you changed your mind).
    if (end.approvers.some((u) => assertedBy.has(u) || decisions.get(u) === true)) continue;
    if (end.approvers.some((u) => decisions.get(u) === false)) rejected = true;
    else pending.push(...end.approvers);
  }
  if (rejected) return { status: 'REJECTED', pending: [] };
  return pending.length ? { status: 'PROPOSED', pending: [...new Set(pending)] } : { status: 'CONFIRMED', pending: [] };
}

/** Human description of a parentage from the confirmer's point of view. */
export function describeParentage(
  parent: { name: string; sex: string; isMe: boolean },
  child: { name: string; isMe: boolean },
): string {
  const role = parent.sex === 'MALE' ? 'ayah' : parent.sex === 'FEMALE' ? 'ibu' : 'orang tua';
  if (child.isMe) return `${parent.name} adalah ${role} Anda`;
  if (parent.isMe) return `${child.name} adalah anak Anda`;
  return `${parent.name} adalah ${role} dari ${child.name}`;
}

export function describeUnion(a: { name: string; isMe: boolean }, b: { name: string; isMe: boolean }): string {
  if (a.isMe) return `${b.name} adalah pasangan Anda`;
  if (b.isMe) return `${a.name} adalah pasangan Anda`;
  return `${a.name} dan ${b.name} adalah pasangan`;
}
