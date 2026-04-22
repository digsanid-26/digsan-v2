const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function api<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const authApi = {
  login: (data: { email: string; password: string }) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  register: (data: { email: string; name: string; password: string; phone?: string; isWhatsapp?: boolean }) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  verifyEmail: (token: string) =>
    api(`/auth/verify-email?token=${token}`),

  verifyWhatsapp: (userId: string, otp: string) =>
    api('/auth/verify-whatsapp', { method: 'POST', body: JSON.stringify({ userId, otp }) }),

  refreshToken: (refreshToken: string) =>
    api('/auth/refresh-token', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
};
