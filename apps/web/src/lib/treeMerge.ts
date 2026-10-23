/**
 * Client-side helpers for saving the tree layout safely.
 *
 * The server owns account-link fields (who is linked/pending/claimed) and
 * rejects stale writes with 409. These helpers keep local state in sync with
 * the server's view and merge local edits on top of newer remote data.
 */

/** Fields only the server may change; always taken from the server's copy. */
export const SERVER_FIELDS = [
  'linkedUserId',
  'pendingLinkUserId',
  'claimedByUserId',
  'verified',
  'earlyAccess',
  'username',
  // Validated by the server (must be a person in the user's own family).
  'graphPersonId',
] as const;

type Rec = Record<string, any>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Copy server-controlled fields from the server's members into the local members. */
export function adoptServerFields<M extends Rec>(local: Record<string, M>, server: Record<string, M> | null | undefined): Record<string, M> {
  if (!server) return local;
  let changed = false;
  const out: Record<string, M> = { ...local };
  for (const [id, m] of Object.entries(local)) {
    const s = server[id];
    if (!m || typeof m !== 'object' || !s) continue;
    const next: Rec = { ...m };
    for (const f of SERVER_FIELDS) {
      if (s[f] === undefined) delete next[f];
      else next[f] = s[f];
    }
    if (!same(next, m)) {
      out[id] = next as M;
      changed = true;
    }
  }
  return changed ? out : local;
}

/**
 * Three-way merge of member maps: nodes the user edited since `base` keep the
 * local version, everything else takes the newer remote version. Server-
 * controlled fields always come from remote.
 */
export function mergeMembers<M extends Rec>(
  base: Record<string, M>,
  local: Record<string, M>,
  remote: Record<string, M>,
): Record<string, M> {
  const out: Record<string, M> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const v = same(base[k], local[k]) ? remote[k] : local[k];
    if (v !== undefined) out[k] = v;
  }
  return adoptServerFields(out, remote);
}

/** Config: local wins only if the user changed it since `base`. */
export function mergeConfig<C>(base: C | null | undefined, local: C, remote: C | null | undefined): C {
  if (!same(base, local) || remote == null) return local;
  return remote;
}
