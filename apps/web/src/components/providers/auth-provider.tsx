'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { auth, getTokens, saveTokens, saveUser, getUser, clearAuth } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles?: string[];
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
    } catch {
      clearAuth();
      setUser(null);
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
