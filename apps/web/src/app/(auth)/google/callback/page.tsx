'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveTokens, saveUser } from '@/lib/auth';

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userParam = searchParams.get('user');

    if (accessToken && refreshToken) {
      saveTokens({ accessToken, refreshToken });

      if (userParam) {
        try {
          const user = JSON.parse(userParam);
          saveUser(user);
        } catch {}
      }

      router.replace('/');
    } else {
      router.replace('/login?error=google_login_failed');
    }
  }, [router, searchParams]);

  return null;
}

const Spinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
      <p className="text-slate-300 text-lg">Memproses login Google...</p>
    </div>
  </div>
);

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GoogleCallbackInner />
      <Spinner />
    </Suspense>
  );
}
