/**
 * F2-09 — what a family page may show to whom. Pure (no Prisma).
 *
 * - Account identifiers (`linkedUserId`, `claimedByUserId`, `pendingLinkUserId`,
 *   `graphPersonId`) never leave the server; the page only gets `hasAccount`.
 * - Contact details (email, phone) are shown only to family: the tree owner,
 *   people drawn in this tree, and relatives in the owner's family graph.
 * - A LIVING person whose privacy is PRIVATE is shown to non-family as an
 *   anonymous "Anggota keluarga" circle (no name, photo or label). The
 *   deceased and PUBLIC/FAMILY persons keep their name and photo.
 */

export type PrivacyT = 'PUBLIC' | 'FAMILY' | 'PRIVATE';

export interface NodePrivacy {
  privacy: PrivacyT;
  living: boolean;
}

const ID_FIELDS = ['linkedUserId', 'claimedByUserId', 'pendingLinkUserId', 'graphPersonId'] as const;
const CONTACT_FIELDS = ['email', 'phone'] as const;
const IDENTIFYING_FIELDS = ['name', 'publicName', 'statusLabel', 'photo', 'username'] as const;

export const ANONYMOUS_NAME = 'Anggota keluarga';

/**
 * Personal profile page: birth date/place are family-only; a PRIVATE living
 * person shows non-family nothing beyond their name and family role.
 */
export function filterProfileForViewer<T extends Record<string, any>>(profile: T, opts: { viewerIsFamily: boolean; privacy: NodePrivacy | undefined }): T {
  if (opts.viewerIsFamily) return profile;
  const next: Record<string, any> = { ...profile, birthDate: null, birthPlace: null };
  if (opts.privacy?.privacy === 'PRIVATE' && opts.privacy.living) {
    Object.assign(next, { avatar: null, bio: null, education: null, occupation: null, hobbies: null, private: true });
  }
  return next as T;
}

export function filterMembersForViewer(
  members: Record<string, any>,
  opts: { viewerIsFamily: boolean; privacyOf: (nodeId: string) => NodePrivacy | undefined },
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [id, m] of Object.entries(members ?? {})) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      out[id] = m;
      continue;
    }
    const next: Record<string, any> = { ...m };
    next.hasAccount = !!(m.linkedUserId || m.claimedByUserId);
    for (const f of ID_FIELDS) delete next[f];
    if (!opts.viewerIsFamily) {
      for (const f of CONTACT_FIELDS) delete next[f];
      const p = opts.privacyOf(id);
      if (p?.privacy === 'PRIVATE' && p.living && id !== 'self') {
        for (const f of IDENTIFYING_FIELDS) delete next[f];
        next.name = ANONYMOUS_NAME;
        next.photo = null;
        next.private = true;
      }
    }
    out[id] = next;
  }
  return out;
}
