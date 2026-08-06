'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { auth, getTokens, saveTokens, saveUser, getUser, clearAuth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function tryRefreshToken(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
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
  }
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles?: string[];
  status?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await auth.getProfile(tokens.accessToken);
      setUser(profile);
      saveUser(profile);
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        // Try refreshing the token before kicking the user out
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          try {
            const newTokens = getTokens();
            const profile = await auth.getProfile(newTokens!.accessToken);
            setUser(profile);
            saveUser(profile);
            return;
          } catch {
            // fall through to clearAuth
          }
        }
        clearAuth();
        setUser(null);
      }
      // Network/server errors: keep cached user, don't kick out
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getUser();
    if (cached) setUser(cached);
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await auth.login({ email, password });
    saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    saveUser(res.user);
    setUser(res.user);
  };

  const logout = async () => {
    const tokens = getTokens();
    if (tokens) {
      try {
        await auth.logout(tokens.accessToken, tokens.refreshToken);
      } catch {}
    }
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
