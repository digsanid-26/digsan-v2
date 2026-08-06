'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, saveTokens, saveUser } from '@/lib/auth';
import { treeApi, getPendingClaim, clearPendingClaim } from '@/lib/tree';

type LoginTab = 'email' | 'whatsapp';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [tab, setTab] = useState<LoginTab>('email');
  const [form, setForm] = useState({ email: '', password: '' });
  const [waForm, setWaForm] = useState({ phone: '', otp: '' });
  const [waStep, setWaStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleLoginSuccess = (res: any) => {
    saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    saveUser(res.user);

    const pending = getPendingClaim();
    if (pending) {
      try {
        treeApi.claimNode(pending.slug, pending.nodeId);
      } catch {
      } finally {
        clearPendingClaim();
      }
      router.push(`/family/${pending.slug}`);
      return;
    }

    const roles = res.user?.roles || [];
    if (redirect) {
      router.push(redirect);
    } else if (roles.includes('super_admin') || roles.includes('admin')) {
      router.push('/admin');
    } else {
      router.push('/');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auth.login(form);
      handleLoginSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await auth.sendWhatsappOtp(waForm.phone);
      setInfo(res.message);
      setWaStep('otp');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auth.verifyWhatsappLogin(waForm.phone, waForm.otp);
      handleLoginSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Verifikasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: Hero panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%233b82f6" fill-opacity="0.15"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/40" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="inline-flex">
            <Image src="/logo-white.svg" alt="Digsan" width={160} height={50} priority className="h-12 w-auto" />
          </Link>

          {/* Hero content */}
          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
              Silsilah Keluarga Digital
            </h1>
            <p className="text-slate-300 mt-4 text-lg leading-relaxed">
              Bangun, kelola, dan bagikan silsilah keluarga Anda dengan mudah.
              Hubungkan generasi, lestarikan warisan.
            </p>
            <div className="flex items-center gap-4 mt-8">
              <div className="flex -space-x-2">
                {['from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-amber-400 to-orange-500', 'from-purple-400 to-purple-600'].map((g, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full bg-gradient-to-br ${g} border-2 border-slate-900`} />
                ))}
              </div>
              <p className="text-sm text-slate-400">Bergabung dengan keluarga lainnya</p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Digsan.id — Silsilah Keluarga Digital
          </p>
        </div>
      </div>

      {/* ─── RIGHT: Form panel ────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50 dark:bg-[#05050f]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex justify-center">
              <Image src="/logo-white.svg" alt="Digsan" width={120} height={38} priority className="h-10 w-auto" />
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
            Masuk
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
            Pilih metode login Anda
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-lg mb-6">
            <button
              onClick={() => { setTab('email'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === 'email'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
              }`}
            >
              Email
            </button>
            <button
              onClick={() => { setTab('whatsapp'); setError(''); setInfo(''); setWaStep('phone'); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === 'whatsapp'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
              }`}
            >
              WhatsApp
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg p-3 mb-4">
              {info}
            </div>
          )}

          {/* Email form */}
          {tab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
                  Lupa password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>
          )}

          {/* WhatsApp form */}
          {tab === 'whatsapp' && (
            <form onSubmit={waStep === 'phone' ? handleSendOtp : handleVerifyOtp} className="space-y-5">
              {waStep === 'phone' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={waForm.phone}
                    onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6281234567890"
                  />
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-1.5">
                    Masukkan nomor dengan kode negara (contoh: 62...)
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">
                    Kode OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={waForm.otp}
                    onChange={(e) => setWaForm({ ...waForm, otp: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                    placeholder="000000"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-1.5">
                    Masukkan 6 digit kode yang dikirim ke WhatsApp Anda
                  </p>
                  <button
                    type="button"
                    onClick={() => { setWaStep('phone'); setWaForm({ ...waForm, otp: '' }); setInfo(''); }}
                    className="text-sm text-blue-500 dark:text-blue-400 hover:underline mt-2"
                  >
                    Ubah nomor
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-semibold rounded-lg transition"
              >
                {loading ? 'Memproses...' : waStep === 'phone' ? 'Kirim Kode OTP' : 'Verifikasi & Masuk'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-50 dark:bg-[#05050f] text-slate-400 dark:text-white/40">atau</span>
            </div>
          </div>

          {/* Google OAuth */}
          <a
            href={`${API_URL}/auth/google`}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-white transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Masuk dengan Google
          </a>

          <p className="text-center text-sm text-slate-500 dark:text-white/50 mt-6">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-500 dark:text-blue-400 hover:underline font-medium">
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#05050f]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
