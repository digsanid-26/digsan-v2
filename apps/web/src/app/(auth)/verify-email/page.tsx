'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-5xl animate-pulse">⏳</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan.');
      return;
    }

    auth
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verifikasi gagal');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
          {status === 'loading' && (
            <>
              <div className="text-5xl mb-4 animate-pulse">⏳</div>
              <h2 className="text-xl font-bold text-white">Memverifikasi email...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-2">Berhasil!</h2>
              <p className="text-slate-300 mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Masuk ke Akun
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-white mb-2">Verifikasi Gagal</h2>
              <p className="text-slate-300 mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Kembali ke Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
