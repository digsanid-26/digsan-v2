import { getTokens, saveTokens, clearAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface ConnectedFamily {
  familyName: string;
  slug: string;
  ownerId: string;
  ownerName: string;
}

/** Which shared Family Node the current user belongs to, and which circle is theirs. */
export interface FamilyNodeMembership {
  treeId: string;
  nodeId: string;
  role: string;
  slug: string | null;
  isHead: boolean;
}

export interface TreeLayout<C = unknown, M = unknown> {
  treeId: string;
  slug: string | null;
  owner: { name: string; username: string | null; avatar: string | null } | null;
  config: C | null;
  members: M | null;
  updatedAt: string;
  isTreeOwner?: boolean;
  connectedFamily?: ConnectedFamily | null;
  familyNode?: FamilyNodeMembership | null;
}

let refreshingPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshingPromise) return refreshingPromise;
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
  refreshingPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) { clearAuth(); return false; }
      const body = await res.json().catch(() => ({}));
      const newTokens = (body as any).data ?? body;
      if (newTokens?.accessToken && newTokens?.refreshToken) {
        saveTokens({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
        return true;
      }
      clearAuth();
      return false;
    } catch {
      clearAuth();
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();
  return refreshingPromise;
}

export async function authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const tokens = getTokens();
  if (!tokens?.accessToken) {
    const err = new Error('Tidak terautentikasi') as Error & { status: number };
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));

  // Auto-refresh on 401 and retry once
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newTokens = getTokens();
      const retryRes = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newTokens!.accessToken}`,
          ...options.headers,
        },
      });
      const retryBody = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        const err = new Error((retryBody as { message?: string }).message || `HTTP ${retryRes.status}`) as Error & { status: number };
        err.status = retryRes.status;
        throw err;
      }
      return ((retryBody as { data?: unknown }).data ?? retryBody) as T;
    }
    clearAuth();
  }

  if (!res.ok) {
    const err = new Error((body as { message?: string }).message || `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  // ResponseInterceptor wraps responses as { statusCode, data, timestamp }.
  return ((body as { data?: unknown }).data ?? body) as T;
}

export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REJECTED' | 'REVOKED';

export type NodeClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface NodeClaimItem {
  id: string;
  treeId: string;
  treeName: string;
  treeSlug: string | null;
  nodeId: string;
  nodeName: string;
  nodeRole: string | null;
  nodeGender: string | null;
  status: NodeClaimStatus;
  note: string | null;
  createdAt: string;
  respondedAt: string | null;
  claimant?: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
  };
}

export interface GuardianConsent {
  id: string;
  treeId: string;
  nodeId: string;
  requesterId: string;
  targetUserId: string | null;
  targetEmail: string | null;
  targetPhone: string | null;
  status: ConsentStatus;
  scope: string;
  note: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface FamilyNodeMember {
  id: string;
  name: string;
  gender: string | null;
  photo: string | null;
  email: string | null;
  phone: string | null;
  familyRole: string | null;
  accountStatus: string | null;
  /** Auto-detected core family (head / spouse / children) — permanent member. */
  isCore?: boolean;
  /** 'layout' when derived from the /tree layout, 'record' when a stored row. */
  source?: 'layout' | 'record';
  /** Layout node id when derived from /tree. */
  nodeId?: string;
}

export interface FamilyNodeData {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isPublic: boolean;
  coverImage: string | null;
  familyImage: string | null;
  familyBio: string | null;
  marriageDate: string | null;
  marriageStatus: string | null;
  headName: string | null;
  config: unknown;
  layoutMembers: unknown;
  members: FamilyNodeMember[];
  /** False for connected users — read-only preview mode. */
  canEdit?: boolean;
}

export interface UpdateFamilyNodePayload {
  name: string;
  description: string;
  isPublic: boolean;
  coverImage: string;
  familyImage: string;
  familyBio: string;
  marriageDate: string;
  marriageStatus: 'ONGOING' | 'DIVORCED' | 'WIDOWED' | 'NONE';
  headName: string;
}

export const treeApi = {
  getLayout: <C = unknown, M = unknown>() =>
    authRequest<TreeLayout<C, M>>('/trees/layout'),

  saveLayout: <C = unknown, M = unknown>(payload: { config?: C; members?: M }) =>
    authRequest<TreeLayout<C, M>>('/trees/layout', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  syncLinkedUser: (nodeId: string) =>
    authRequest<{ treeId: string; slug: string; nodeId: string; member: any; synced: any }>(`/trees/sync-linked-user/${nodeId}`, {
      method: 'POST',
    }),

  /** Admin: re-mint slugs for trees whose slug was wiped. */
  recoverSlugs: () =>
    authRequest<{ recovered: number; details: { treeId: string; slug: string }[] }>('/trees/recover-slugs', {
      method: 'POST',
    }),

  /** Write back only the caller's own slice of the shared Family Node layout. */
  saveFamilyNodeSlice: <M = unknown>(members: Record<string, unknown>) =>
    authRequest<{ treeId: string; slug: string | null; nodeId: string; isHead: boolean; members: M }>('/trees/family-node/slice', {
      method: 'PUT',
      body: JSON.stringify({ members }),
    }),

  leaveFamilyNode: () =>
    authRequest<{ message: string }>('/trees/family-node/membership', {
      method: 'DELETE',
    }),

  backfillFamilyNodes: () =>
    authRequest<{ linked: number; heads: number; slugsRetired: number }>('/trees/backfill-family-nodes', {
      method: 'POST',
    }),

  setSlug: (slug?: string) =>
    authRequest<{ slug: string; owner: { name: string; username: string | null; avatar: string | null } | null }>('/trees/slug', {
      method: 'PUT',
      body: JSON.stringify({ slug }),
    }),

  setSlugForTree: (treeId: string, slug?: string) =>
    authRequest<{ slug: string; owner: { name: string; username: string | null; avatar: string | null } | null }>(`/trees/${encodeURIComponent(treeId)}/slug`, {
      method: 'PUT',
      body: JSON.stringify({ slug }),
    }),

  // ─── Guardianship consent ───────────────────────────────────
  getConsents: () => authRequest<GuardianConsent[]>('/trees/consents'),

  getIncomingConsents: () =>
    authRequest<GuardianConsent[]>('/trees/consents/incoming'),

  requestConsent: (payload: {
    nodeId: string;
    targetUserId?: string;
    targetEmail?: string;
    targetPhone?: string;
    note?: string;
  }) =>
    authRequest<GuardianConsent>('/trees/consents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  respondConsent: (consentId: string, grant: boolean) =>
    authRequest<GuardianConsent>(`/trees/consents/${consentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ grant }),
    }),

  revokeConsent: (consentId: string) =>
    authRequest<GuardianConsent>(`/trees/consents/${consentId}`, {
      method: 'DELETE',
    }),

  // ─── Email invitation ───────────────────────────────────────
  inviteByEmail: (payload: { email: string; nodeId?: string; message?: string }) =>
    authRequest<TreeInvitation>('/trees/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Public-tree node claim ("Apakah ini Anda?") ────────────
  claimNode: (slug: string, nodeId: string) =>
    authRequest<{ claimId: string; status: string; message: string }>('/trees/claim', {
      method: 'POST',
      body: JSON.stringify({ slug, nodeId }),
    }),

  // ─── Super User: manage node claims ─────────────────────────
  getPendingClaims: () =>
    authRequest<NodeClaimItem[]>('/trees/super-user/claims'),

  respondToClaim: (claimId: string, approve: boolean) =>
    authRequest<{ claimId: string; status: string; message: string }>(`/trees/super-user/claims/${encodeURIComponent(claimId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ approve }),
    }),

  // ─── User: check own claim statuses ─────────────────────────
  getMyClaims: () =>
    authRequest<NodeClaimItem[]>('/trees/claims/me'),

  // ─── Super User: create early access for a layout node ──────
  createEarlyAccessForNode: (nodeId: string, email: string, password: string, phone?: string) =>
    authRequest<{ message: string; nodeId: string; user: { id: string; email: string; name: string; status: string } }>(`/trees/early-access/${encodeURIComponent(nodeId)}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, phone }),
    }),

  // ─── Accept tree invitation ─────────────────────────────────
  acceptInvitation: (token: string) =>
    authRequest<{ message: string; member: unknown; treeId: string; slug: string }>(`/trees/invitations/${token}/accept`, {
      method: 'POST',
    }),

  // ─── Onboarding: search users & families ────────────────────
  search: (q: string) =>
    authRequest<{
      users: { id: string; name: string; username: string | null; avatar: string | null; email: string; type: 'user' }[];
      families: { id: string; name: string; slug: string | null; userId: string; user: { id: string; name: string; avatar: string | null }; type: 'family' }[];
    }>(`/trees/search?q=${encodeURIComponent(q)}`),

  // ─── Onboarding: pending invitations ────────────────────────
  pendingInvitations: () =>
    authRequest<{
      id: string;
      token: string;
      message: string | null;
      createdAt: string;
      tree: { id: string; name: string; slug: string | null; user: { id: string; name: string; avatar: string | null } };
    }[]>(`/trees/invitations/pending`),

  // ─── Family Node profile ───────────────────────────────────
  getFamilyNode: (treeId: string) =>
    authRequest<FamilyNodeData>(`/trees/family-node/${encodeURIComponent(treeId)}`),

  updateFamilyNode: (treeId: string, payload: Partial<UpdateFamilyNodePayload>) =>
    authRequest<FamilyNodeData>(`/trees/${encodeURIComponent(treeId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export interface TreeInvitation {
  id: string;
  treeId: string;
  email: string | null;
  phone: string | null;
  nodeId: string | null;
  message: string | null;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
}

// ─── Public (unauthenticated) family & profile pages ──────────

export interface PublicFamily<C = unknown, M = unknown> {
  slug: string | null;
  name: string;
  description: string | null;
  coverImage: string | null;
  familyImage: string | null;
  familyBio: string | null;
  marriageDate: string | null;
  marriageStatus: string | null;
  headName: string | null;
  config: C | null;
  members: M | null;
  owner: { name: string; username: string | null; avatar: string | null; bio: string | null } | null;
  updatedAt: string;
}

export interface PublicProfile {
  family: { slug: string | null; name: string };
  profile: {
    name: string;
    username: string | null;
    avatar: string | null;
    bio: string | null;
    isOwner: boolean;
    joinedAt: string;
    birthDate: string | null;
    birthPlace: string | null;
    education: string | null;
    occupation: string | null;
    hobbies: string | null;
  };
}

async function publicRequest<T>(endpoint: string, authToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  const body = await res.json().catch(() => ({}));

  // Auto-refresh on 401/403 if we sent an auth token (it may have expired)
  if ((res.status === 401 || res.status === 403) && authToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newTokens = getTokens();
      const retryRes = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newTokens!.accessToken}`,
        },
      });
      const retryBody = await retryRes.json().catch(() => ({}));
      if (retryRes.ok) {
        return ((retryBody as { data?: unknown }).data ?? retryBody) as T;
      }
    }
  }

  if (!res.ok) {
    const err = new Error((body as { message?: string }).message || `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  // ResponseInterceptor wraps responses as { statusCode, data, timestamp }.
  return ((body as { data?: unknown }).data ?? body) as T;
}

export const publicTreeApi = {
  getFamily: <C = unknown, M = unknown>(slug: string, token?: string, authToken?: string) =>
    publicRequest<PublicFamily<C, M>>(`/public/family/${encodeURIComponent(slug)}${token ? `?t=${token}` : ''}`, authToken),

  getProfile: (slug: string, username: string, token?: string, authToken?: string) =>
    publicRequest<PublicProfile>(`/public/family/${encodeURIComponent(slug)}/${encodeURIComponent(username)}${token ? `?t=${token}` : ''}`, authToken),

  getProfileByUsername: (username: string, token?: string, authToken?: string) =>
    publicRequest<PublicProfile>(`/public/family/profile/${encodeURIComponent(username)}${token ? `?t=${token}` : ''}`, authToken),

  generatePublicLink: async (slug: string, username?: string) => {
    const tokens = getTokens();
    if (!tokens?.accessToken) throw new Error('Not authenticated');
    const res = await fetch(`${API_URL}/trees/public-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
      body: JSON.stringify({ slug, username }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
    return ((body as { data?: unknown }).data ?? body) as { token: string; expiresAt: string; slug: string; username: string | null };
  },
};

// ─── Pending node claim (across register/login redirect) ─────
// When an unauthenticated visitor confirms "Apakah ini Anda?" on a public
// family tree, we remember which node they want to claim, send them to
// register/login, then finish the claim once they have a session.

const PENDING_CLAIM_KEY = 'digsan_pending_claim';

export interface PendingClaim { slug: string; nodeId: string; }

export function savePendingClaim(claim: PendingClaim) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));
}

export function getPendingClaim(): PendingClaim | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PENDING_CLAIM_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearPendingClaim() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PENDING_CLAIM_KEY);
}
