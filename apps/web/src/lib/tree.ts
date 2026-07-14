import { getTokens } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface TreeLayout<C = unknown, M = unknown> {
  treeId: string;
  config: C | null;
  members: M | null;
  updatedAt: string;
}

async function authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message || `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REJECTED' | 'REVOKED';

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

export const treeApi = {
  getLayout: <C = unknown, M = unknown>() =>
    authRequest<TreeLayout<C, M>>('/trees/layout'),

  saveLayout: <C = unknown, M = unknown>(payload: { config?: C; members?: M }) =>
    authRequest<TreeLayout<C, M>>('/trees/layout', {
      method: 'PUT',
      body: JSON.stringify(payload),
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
