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

export const treeApi = {
  getLayout: <C = unknown, M = unknown>() =>
    authRequest<TreeLayout<C, M>>('/trees/layout'),

  saveLayout: <C = unknown, M = unknown>(payload: { config?: C; members?: M }) =>
    authRequest<TreeLayout<C, M>>('/trees/layout', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
