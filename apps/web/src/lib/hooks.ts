'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTokens } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface UseApiOptions {
  immediate?: boolean;
}

export function useApi<T = any>(endpoint: string, options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = getTokens();
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setData(json.data ?? json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (options?.immediate !== false) {
      fetchData();
    }
  }, [fetchData, options?.immediate]);

  return { data, loading, error, refetch: fetchData };
}

export function useAuthApi() {
  const tokens = getTokens();

  const request = useCallback(
    async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          ...options.headers,
        },
        ...options,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      return json.data ?? json;
    },
    [tokens],
  );

  return { request };
}
