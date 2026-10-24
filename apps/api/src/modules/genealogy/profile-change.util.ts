/**
 * F2-02 — which profile changes a tree really made, and how a Person's
 * profile maps back onto a legacy layout circle. Pure (no Prisma).
 *
 * A tree's circle can lag behind the shared Person (e.g. Budi still writes
 * "Pak Slamet" after Adi's "Bapak Slamet" was kept). Comparing the circle
 * with the Person would re-propose that on every save. Instead each
 * (tree, circle) keeps a snapshot of what it showed last time; only fields
 * that differ from that snapshot were edited by the owner.
 */

export const LAYOUT_FIELDS = ['displayName', 'sex', 'vitalStatus', 'photo'] as const;
export const PROPOSABLE_FIELDS = [...LAYOUT_FIELDS, 'birthDate', 'deathDate', 'birthPlace'] as const;
export type ProposableField = (typeof PROPOSABLE_FIELDS)[number];

export type Snapshot = Partial<Record<(typeof LAYOUT_FIELDS)[number], string | null>>;
export type Changes = Partial<Record<ProposableField, { from: unknown; to: unknown }>>;

interface ProfileLike {
  displayName: string;
  sex: string;
  vitalStatus: string;
  photo: string | null;
  isPlaceholder?: boolean;
}

export function snapshotOf(p: ProfileLike): Snapshot {
  return { displayName: p.displayName, sex: p.sex, vitalStatus: p.vitalStatus, photo: p.photo ?? null };
}

/**
 * Changes the owner made to a circle since its last snapshot, relative to the
 * current Person. Without a snapshot (first sync after this feature) nothing
 * counts as edited unless the tree is the Person's only view.
 */
export function editedFields(
  draft: ProfileLike,
  person: ProfileLike,
  snapshot: Snapshot | null | undefined,
  onlyView: boolean,
): Changes {
  if (draft.isPlaceholder || person.isPlaceholder) return {};
  const base: Snapshot = snapshot ?? (onlyView ? snapshotOf(person) : snapshotOf(draft));
  const now = snapshotOf(draft);
  const cur = snapshotOf(person);
  const out: Changes = {};
  for (const f of LAYOUT_FIELDS) {
    const to = now[f];
    if (to === base[f] || to === cur[f]) continue;
    // Clearing a photo or "unknown" sex is not a claim about the person.
    if ((f === 'photo' && !to) || (f === 'sex' && to === 'UNKNOWN')) continue;
    out[f] = { from: cur[f], to };
  }
  return out;
}

/** Person values → fields of a layout member record. */
export function toLayoutPatch(values: Partial<Record<ProposableField, unknown>>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (typeof values.displayName === 'string') patch.name = values.displayName;
  if (values.sex === 'MALE') patch.gender = 'L';
  if (values.sex === 'FEMALE') patch.gender = 'P';
  if (values.vitalStatus === 'DECEASED') patch.alive = false;
  if (values.vitalStatus === 'LIVING') patch.alive = true;
  if (values.photo !== undefined) patch.photo = values.photo;
  return patch;
}

/** Validate/normalise API input into Changes against the current Person. */
export function changesFrom(input: Record<string, unknown>, person: Record<string, unknown>): Changes {
  const out: Changes = {};
  for (const f of PROPOSABLE_FIELDS) {
    if (!(f in input)) continue;
    let to = input[f];
    if (f === 'displayName') {
      to = typeof to === 'string' ? to.trim() : '';
      if (!to || (to as string).length > 120) continue;
    }
    if (f === 'sex' && !['MALE', 'FEMALE', 'UNKNOWN'].includes(to as string)) continue;
    if (f === 'vitalStatus' && !['LIVING', 'DECEASED', 'UNKNOWN'].includes(to as string)) continue;
    if ((f === 'birthDate' || f === 'deathDate') && to !== null) {
      const d = new Date(to as string);
      if (Number.isNaN(d.getTime())) continue;
      to = d.toISOString();
    }
    const from = person[f] instanceof Date ? (person[f] as Date).toISOString() : (person[f] ?? null);
    if (from === (to ?? null)) continue;
    out[f] = { from, to: to ?? null };
  }
  return out;
}

/** Changes → Prisma update data. */
export function toPersonData(changes: Changes): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [f, c] of Object.entries(changes)) {
    data[f] = (f === 'birthDate' || f === 'deathDate') && c!.to ? new Date(c!.to as string) : c!.to;
  }
  if (data.displayName) Object.assign(data, { isPlaceholder: false, placeholderKind: null });
  return data;
}

/** A change is stale if a field moved since it was proposed. */
export function staleFields(changes: Changes, person: Record<string, unknown>): string[] {
  return Object.entries(changes)
    .filter(([f, c]) => {
      const cur = person[f] instanceof Date ? (person[f] as Date).toISOString() : (person[f] ?? null);
      return cur !== (c!.from ?? null);
    })
    .map(([f]) => f);
}
