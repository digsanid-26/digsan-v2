'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTokens } from '@/lib/auth';
import { treeApi } from '@/lib/tree';

function InviteInner({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const tokens = getTokens();

    if (!tokens?.accessToken) {
      setStatus('login');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await treeApi.acceptInvitation(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(res.message || 'Undangan diterima');
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.message || 'Gagal menerima undangan');
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  if (status === 'login') {
    const returnUrl = `/invite/${token}`;
    const loginUrl = `/login?redirect=${encodeURIComponent(returnUrl)}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-flex justify-center mb-8">
            <Image src="/logo-white.svg" alt="Digsan" width={140} height={44} priority className="h-11 w-auto" />
          </Link>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-3">Login Diperlukan</h2>
            <p className="text-slate-300 text-sm mb-6">
              Anda harus login terlebih dahulu untuk menerima undangan silsilah keluarga.
            </p>
            <Link
              href={loginUrl}
              className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Masuk Sekarang
            </Link>
            <p className="text-slate-400 text-xs mt-4">
              Belum punya akun?{' '}
              <Link href={`/register?redirect=${encodeURIComponent(returnUrl)}`} className="text-blue-400 hover:text-blue-300">
                Daftar
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex justify-center mb-8">
          <Image src="/logo-white.svg" alt="Digsan" width={140} height={44} priority className="h-11 w-auto" />
        </Link>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-slate-300 text-lg">Memproses undangan...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Undangan Diterima!</h2>
              <p className="text-slate-300 text-sm mb-6">{message}</p>
              <Link
                href="/tree"
                className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Lihat Silsilah Keluarga
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Gagal</h2>
              <p className="text-slate-300 text-sm mb-6">{message}</p>
              <Link
                href="/"
                className="inline-block w-full py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition"
              >
                Kembali ke Beranda
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto"></div>
        </div>
      }
    >
      <InvitePageInner params={params} />
    </Suspense>
  );
}

async function InvitePageInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteInner token={token} />;
}
