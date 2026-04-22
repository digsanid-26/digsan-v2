'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-white mb-2">Cek Email Anda</h2>
            <p className="text-slate-300 mb-6">
              Jika email terdaftar, kami telah mengirim link untuk reset password.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-white">
            Digsan
          </Link>
          <p className="text-slate-400 mt-2">Lupa Password</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
          <p className="text-slate-300 text-sm mb-6">
            Masukkan email Anda dan kami akan mengirim link untuk reset password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Mengirim...' : 'Kirim Link Reset'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Kembali ke Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
