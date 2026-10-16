/**
 * Pure helpers for the config-driven layout JSON (`FamilyTree.layoutMembers`).
 *
 * Kept free of Prisma/Nest so the authority rules can be unit-tested without a
 * database: which fields the client may write, which nodes form the owner's
 * household, what may be projected across trees, and how a connection request
 * seeds an empty tree.
 */

export type LayoutMember = Record<string, any>;
export type LayoutMembers = Record<string, LayoutMember>;

/** Fields only the server may set (link approval, claims, early access). */
export const SERVER_CONTROLLED_FIELDS = ['claimedByUserId', 'earlyAccess', 'username', 'verified'] as const;

/** Profile fields that belong to the person once they have an active account. */
export const PROTECTED_PROFILE_FIELDS = [
  'name',
  'publicName',
  'statusLabel',
  'gender',
  'alive',
  'photo',
  'email',
  'phone',
] as const;

/** Every field that ties a node to an account. Never copied between trees. */
const IDENTITY_FIELDS = ['linkedUserId', 'pendingLinkUserId', ...SERVER_CONTROLLED_FIELDS] as const;

const isObj = (v: unknown): v is LayoutMember => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Node classification ──────────────────────────────────────

/**
 * Whether a node belongs to the owner's household (spouse(s) + children).
 * Only household members share the owner's Family Node / public slug; parents,
 * siblings, uncles etc. keep their own household page.
 */
export function isHouseholdNode(nodeId: string, layout: LayoutMembers): boolean {
  if (/^spouse-\d+$/.test(nodeId) || /^child-\d+$/.test(nodeId)) return true;
  const m = layout[nodeId];
  if (!isObj(m)) return false;
  if (m.group === 'child') {
    const p = typeof m.parentId === 'string' ? m.parentId : '';
    return p === 'self' || /^spouse-\d+$/.test(p);
  }
  return m.group === 'spouse' && m.spouseId === 'self';
}

/** A person who married into the tree — the only kind whose own ancestry is new information. */
export function isMarriedInNode(nodeId: string, m: LayoutMember | undefined): boolean {
  return /^spouse-\d+$/.test(nodeId) || /-spouse(-\d+)?$/.test(nodeId) || m?.group === 'spouse';
}

/** Direct ancestors of the owner: their children/siblings are already drawn in this tree. */
export function isDirectAncestorNode(nodeId: string, m: LayoutMember | undefined): boolean {
  return (
    /^(parent|gpP|gpM|ancP|ancM)-\d+$/.test(nodeId) ||
    m?.group === 'parent' ||
    m?.group === 'grandparent' ||
    m?.group === 'ancestor'
  );
}

export type ProjectionScope = 'full' | 'descendants' | 'none';

/**
 * How much of a linked person's own tree may be projected onto the shared page.
 *
 * - married-in (spouse): their parents/siblings are a new bloodline → full.
 * - direct ancestors: their children are the owner & siblings → nothing
 *   (projecting would duplicate the owner's own family).
 * - other blood relatives (siblings, children, uncles): only their own
 *   household counts (spouse/children); their parents are already drawn.
 */
export function projectionScope(nodeId: string, m: LayoutMember | undefined): ProjectionScope {
  if (isMarriedInNode(nodeId, m)) return 'full';
  if (isDirectAncestorNode(nodeId, m)) return 'none';
  return 'descendants';
}

export const ANCESTRY_KEY_RE = /^(parent|older|younger|gpP|gpM|unclePo|unclePy|uncleMo|uncleMy|ancP|ancM)-\d+$/;

const FULL_CONFIG_KEYS = ['olderCount', 'youngerCount', 'parentCount', 'spouseCount', 'childCount'];
const DESCENDANT_CONFIG_KEYS = ['spouseCount', 'childCount'];

/** Project a person's own TreeConfig counts, limited by scope. Only positive counts are kept. */
export function projectFamilyConfig(cfg: Record<string, any>, scope: ProjectionScope): Record<string, number> | null {
  if (scope === 'none') return null;
  const keys = scope === 'full' ? FULL_CONFIG_KEYS : DESCENDANT_CONFIG_KEYS;
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = cfg?.[k];
    if (typeof v === 'number' && v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// ─── Client write sanitising ──────────────────────────────────

export interface NodeUserRef { nodeId: string; userId: string }

export interface SanitizeResult {
  members: LayoutMembers;
  /** New link wishes that must be confirmed by the target account. */
  linkRequests: NodeUserRef[];
  /** Pending wishes the owner withdrew (or whose node was deleted). */
  cancelledRequests: NodeUserRef[];
  /** Approved links the owner removed (or whose node was deleted). */
  unlinked: NodeUserRef[];
  errors: string[];
}

/**
 * Apply the authority rules to a layout coming from the client:
 *
 * - server-controlled fields keep their stored values;
 * - `linkedUserId` can never be set directly — a new value becomes a
 *   `pendingLinkUserId` that the target must approve;
 * - moving an already-linked person to another node (e.g. index shift after a
 *   deletion) keeps the approved link;
 * - an account may appear on at most one node per tree, and the owner can
 *   only be `self`.
 */
export function sanitizeLayoutMembers(
  oldMembers: LayoutMembers,
  incoming: LayoutMembers,
  ownerId: string,
): SanitizeResult {
  const res: SanitizeResult = { members: {}, linkRequests: [], cancelledRequests: [], unlinked: [], errors: [] };

  const oldLinkedAt = new Map<string, string>();
  const oldPendingAt = new Map<string, string>();
  for (const [id, m] of Object.entries(oldMembers)) {
    if (!isObj(m)) continue;
    if (m.linkedUserId) oldLinkedAt.set(m.linkedUserId, id);
    if (m.pendingLinkUserId) oldPendingAt.set(m.pendingLinkUserId, id);
  }
  /** True when `uid` left its old node in this save, so it may legitimately move. */
  const leftOldNode = (uid: string, oldNodeId: string | undefined, field: string) =>
    !!oldNodeId && (!isObj(incoming[oldNodeId]) || incoming[oldNodeId][field] !== uid);

  const keptLinks = new Set<string>();
  const keptPending = new Set<string>();

  for (const [id, raw] of Object.entries(incoming)) {
    if (!isObj(raw)) {
      res.members[id] = raw;
      continue;
    }
    const prev = isObj(oldMembers[id]) ? oldMembers[id] : {};
    const next: LayoutMember = { ...raw };

    for (const f of SERVER_CONTROLLED_FIELDS) {
      if (prev[f] === undefined) delete next[f];
      else next[f] = prev[f];
    }

    const prevLinked: string | null = prev.linkedUserId ?? null;
    const prevPending: string | null = prev.pendingLinkUserId ?? null;
    const wantLinked: string | null = raw.linkedUserId ?? null;
    let requested: string | null = null;

    if (wantLinked === prevLinked) {
      next.linkedUserId = prevLinked;
    } else if (!wantLinked) {
      next.linkedUserId = null;
      for (const f of SERVER_CONTROLLED_FIELDS) delete next[f];
    } else if (leftOldNode(wantLinked, oldLinkedAt.get(wantLinked), 'linkedUserId')) {
      // Approved link moved to another node: carry the approval with it.
      const from = oldMembers[oldLinkedAt.get(wantLinked)!];
      next.linkedUserId = wantLinked;
      for (const f of SERVER_CONTROLLED_FIELDS) {
        if (from[f] === undefined) delete next[f];
        else next[f] = from[f];
      }
    } else {
      next.linkedUserId = prevLinked;
      requested = wantLinked;
    }
    if (next.linkedUserId) keptLinks.add(next.linkedUserId);

    if (!requested) {
      if (raw.pendingLinkUserId === undefined) requested = prevPending;
      else requested = raw.pendingLinkUserId || null;
    }
    if (requested && requested === next.linkedUserId) requested = null;

    if (requested) {
      if (requested === ownerId && id !== 'self') {
        res.errors.push(`Anda tidak dapat menautkan akun Anda sendiri ke lingkaran "${id}"`);
        requested = null;
      }
    }
    next.pendingLinkUserId = requested;
    if (requested) {
      keptPending.add(requested);
      const movedPending = requested !== prevPending && leftOldNode(requested, oldPendingAt.get(requested), 'pendingLinkUserId');
      if (requested !== prevPending && !movedPending) res.linkRequests.push({ nodeId: id, userId: requested });
    }
    if (next.pendingLinkUserId == null) delete next.pendingLinkUserId;

    res.members[id] = next;
  }

  for (const [uid, nodeId] of oldLinkedAt) {
    if (!keptLinks.has(uid)) res.unlinked.push({ nodeId, userId: uid });
  }
  for (const [uid, nodeId] of oldPendingAt) {
    if (!keptPending.has(uid)) res.cancelledRequests.push({ nodeId, userId: uid });
  }

  const seen = new Map<string, string>();
  for (const [id, m] of Object.entries(res.members)) {
    if (!isObj(m)) continue;
    for (const uid of new Set([m.linkedUserId, m.pendingLinkUserId, m.claimedByUserId].filter(Boolean))) {
      if (uid === ownerId && id !== 'self') {
        res.errors.push(`Akun pemilik pohon hanya boleh berada di lingkaran "self" (ditemukan di "${id}")`);
      }
      const other = seen.get(uid);
      if (other && other !== id) {
        res.errors.push(`Satu akun hanya boleh ditautkan ke satu lingkaran (bentrok: "${other}" dan "${id}")`);
      }
      seen.set(uid, id);
    }
  }

  return res;
}

/** Remove fields a non-owner (slice writer) may never set on the shared layout. */
export function stripIdentityFields(patch: LayoutMember, existing: LayoutMember | undefined): LayoutMember {
  const next: LayoutMember = { ...patch };
  for (const f of IDENTITY_FIELDS) {
    if (existing?.[f] === undefined) delete next[f];
    else next[f] = existing[f];
  }
  return next;
}

/** True when any protected profile field differs between the stored and incoming node. */
export function protectedFieldsChanged(prev: LayoutMember, next: LayoutMember): boolean {
  return PROTECTED_PROFILE_FIELDS.some((f) => (prev?.[f] ?? null) !== (next?.[f] ?? null));
}

/** Restore protected profile fields from the stored node. */
export function revertProtectedFields(prev: LayoutMember, next: LayoutMember): LayoutMember {
  const out = { ...next };
  for (const f of PROTECTED_PROFILE_FIELDS) {
    if (prev?.[f] === undefined) delete out[f];
    else out[f] = prev[f];
  }
  return out;
}

// ─── Connection requests ──────────────────────────────────────

/** A tree with no configuration and no circles besides `self` may be seeded. */
export function isLayoutEmpty(config: unknown, members: unknown): boolean {
  const cfg = isObj(config) ? config : {};
  const mem = isObj(members) ? members : {};
  return !cfg.configured && Object.keys(mem).every((k) => k === 'self');
}

/** Display-only copy of a member: never carries account links to third parties. */
function displayCopy(m: LayoutMember | undefined): LayoutMember | null {
  if (!isObj(m) || !m.name) return null;
  const out: LayoutMember = {};
  for (const f of ['name', 'gender', 'alive', 'photo', 'publicName'] as const) {
    if (m[f] !== undefined && m[f] !== null && m[f] !== '') out[f] = m[f];
  }
  return out;
}

function indexedEntries(members: LayoutMembers, prefix: string, count: number): LayoutMember[] {
  const out: LayoutMember[] = [];
  for (let i = 0; i < count; i++) out.push(members[`${prefix}-${i}`] ?? {});
  return out;
}

export interface ConnectedLayoutInput {
  /** Requester's role relative to the accepter ("Saya adalah {relationship} Anda"). */
  relationship: string;
  inviterUserId: string;
  inviterConfig: Record<string, any>;
  inviterMembers: LayoutMembers;
  accepter: { id: string; name: string; avatar: string | null };
  defaultConfig?: Record<string, any>;
}

export interface ConnectedLayout {
  config: Record<string, any>;
  members: LayoutMembers;
  /** Accepter should join the inviter's household (spouse, or unmarried child). */
  joinsInviterHousehold: boolean;
  /** Node id in the inviter's tree the accepter corresponds to, if known. */
  inviterSideNodeId: string | null;
}

/**
 * Seed an EMPTY accepter tree from an accepted connection request.
 *
 * `relationship` is the inviter's role towards the accepter (the request form
 * asks "Anda adalah apa bagi X?"), so e.g. `ayah` means the inviter is the
 * accepter's father. Keys follow the 0-based convention used by the web
 * explorer. Returns null for relationships that cannot be placed without
 * guessing (cucu, paman-bibi, keponakan) — the user adds those manually.
 */
export function buildConnectedLayout(input: ConnectedLayoutInput): ConnectedLayout | null {
  const { relationship, inviterUserId, inviterConfig: ic, inviterMembers: im, accepter } = input;
  const inviterSelf = im.self ?? {};
  const inviterNode: LayoutMember = {
    name: inviterSelf.name || 'Anggota Keluarga',
    gender: inviterSelf.gender || '',
    alive: inviterSelf.alive !== false,
    photo: inviterSelf.photo || null,
    linkedUserId: inviterUserId,
    verified: true,
  };

  const config: Record<string, any> = {
    ...(input.defaultConfig ?? {}),
    configured: true,
    mainFamilyName: '',
    extFamilyName: '',
    spouseCount: 1,
    childCount: 0,
    parentCount: 2,
    olderCount: 0,
    youngerCount: 0,
    simbahP: 2,
    simbahM: 2,
  };
  const members: LayoutMembers = {
    self: { name: accepter.name || 'Saya', gender: '', alive: true, photo: accepter.avatar || null, verified: true },
  };

  /** The inviter's node that is linked to the accepter, if the inviter already drew them. */
  const findAccepterIn = (prefix: string, count: number): number =>
    indexedEntries(im, prefix, count).findIndex((m) => m?.linkedUserId === accepter.id);

  let joinsInviterHousehold = false;
  let inviterSideNodeId: string | null = null;

  switch (relationship) {
    case 'anak': {
      // Inviter is the accepter's child. Inviter's siblings are the accepter's other children.
      const older = indexedEntries(im, 'older', Number(ic.olderCount ?? 0)).map(displayCopy);
      const younger = indexedEntries(im, 'younger', Number(ic.youngerCount ?? 0)).map(displayCopy);
      const kids = [...older, inviterNode, ...younger];
      kids.forEach((k, i) => { if (k) members[`child-${i}`] = k; });
      config.childCount = kids.length;
      inviterSideNodeId = null;
      break;
    }
    case 'pasangan': {
      // Inviter is the accepter's spouse: same household, same children.
      members['spouse-0'] = inviterNode;
      const childCount = Number(ic.childCount ?? 0);
      indexedEntries(im, 'child', childCount).forEach((c, i) => {
        const copy = displayCopy(c);
        if (copy) members[`child-${i}`] = copy;
      });
      config.childCount = childCount;
      const idx = findAccepterIn('spouse', Number(ic.spouseCount ?? 0));
      inviterSideNodeId = idx >= 0 ? `spouse-${idx}` : 'spouse-0';
      joinsInviterHousehold = true;
      break;
    }
    case 'ayah':
    case 'ibu':
    case 'orangtua': {
      // Inviter is the accepter's parent.
      const isMother = relationship === 'ibu';
      members[isMother ? 'parent-1' : 'parent-0'] = inviterNode;
      const otherParent = displayCopy(im['spouse-0']);
      if (otherParent) members[isMother ? 'parent-0' : 'parent-1'] = otherParent;
      // Inviter's parents are the accepter's grandparents on that side.
      const gpPrefix = isMother ? 'gpM' : 'gpP';
      indexedEntries(im, 'parent', Number(ic.parentCount ?? 0)).forEach((p, i) => {
        const copy = displayCopy(p);
        if (copy) members[`${gpPrefix}-${i}`] = copy;
      });
      // Siblings can only be ordered if the inviter already drew the accepter as a child.
      const childCount = Number(ic.childCount ?? 0);
      const me = findAccepterIn('child', childCount);
      if (me >= 0) {
        const kids = indexedEntries(im, 'child', childCount);
        kids.slice(0, me).map(displayCopy).forEach((k, i) => { if (k) members[`older-${i}`] = k; });
        kids.slice(me + 1).map(displayCopy).forEach((k, i) => { if (k) members[`younger-${i}`] = k; });
        config.olderCount = me;
        config.youngerCount = childCount - me - 1;
        inviterSideNodeId = `child-${me}`;
      } else {
        inviterSideNodeId = null;
      }
      joinsInviterHousehold = true;
      break;
    }
    case 'saudara': {
      // Inviter is the accepter's sibling: shared parents & grandparents.
      indexedEntries(im, 'parent', Number(ic.parentCount ?? 0)).forEach((p, i) => {
        const copy = displayCopy(p);
        if (copy) members[`parent-${i}`] = copy;
      });
      for (const prefix of ['gpP', 'gpM']) {
        for (let i = 0; i < 4; i++) {
          const copy = displayCopy(im[`${prefix}-${i}`]);
          if (copy) members[`${prefix}-${i}`] = copy;
        }
      }
      if (ic.parentCount) config.parentCount = Number(ic.parentCount);
      config.simbahP = Number(ic.simbahP ?? 2);
      config.simbahM = Number(ic.simbahM ?? 2);

      // Order is only known if the inviter already drew the accepter as a sibling.
      const olderCount = Number(ic.olderCount ?? 0);
      const youngerCount = Number(ic.youngerCount ?? 0);
      const siblings: LayoutMember[] = [
        ...indexedEntries(im, 'older', olderCount),
        { __inviter: true },
        ...indexedEntries(im, 'younger', youngerCount),
      ];
      const me = siblings.findIndex((s) => s?.linkedUserId === accepter.id);
      if (me >= 0) {
        const toNode = (s: LayoutMember) => (s.__inviter ? inviterNode : displayCopy(s));
        siblings.slice(0, me).map(toNode).forEach((s, i) => { if (s) members[`older-${i}`] = s; });
        siblings.slice(me + 1).map(toNode).forEach((s, i) => { if (s) members[`younger-${i}`] = s; });
        config.olderCount = me;
        config.youngerCount = siblings.length - me - 1;
        inviterSideNodeId = me < olderCount ? `older-${me}` : `younger-${me - olderCount - 1}`;
      } else {
        members['older-0'] = inviterNode;
        config.olderCount = 1;
        inviterSideNodeId = null;
      }
      break;
    }
    case 'kakek-nenek': {
      // Inviter is a grandparent; side unknown → paternal by default (editable).
      members[inviterNode.gender === 'P' ? 'gpP-1' : 'gpP-0'] = inviterNode;
      break;
    }
    default:
      return null;
  }

  return { config, members, joinsInviterHousehold, inviterSideNodeId };
}
