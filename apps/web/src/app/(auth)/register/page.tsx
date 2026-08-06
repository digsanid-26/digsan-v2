'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { savePendingClaim } from '@/lib/tree';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#05050f]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

type RegisterTab = 'email' | 'whatsapp';

function RegisterForm() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<RegisterTab>('email');
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    phone: '',
    isWhatsapp: false,
  });
  const [waForm, setWaForm] = useState({
    phone: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const slug = searchParams?.get('tree');
    const nodeId = searchParams?.get('node');
    if (slug && nodeId) savePendingClaim({ slug, nodeId });
  }, [searchParams]);

  const redirectParam = searchParams?.get('redirect');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.register({
        email: form.email,
        name: form.name,
        password: form.password,
        phone: form.phone || undefined,
        isWhatsapp: form.isWhatsapp,
      });
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsappSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (waForm.password !== waForm.confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.register({
        email: `${waForm.phone}@wa.digsan.id`,
        name: waForm.name,
        password: waForm.password,
        phone: waForm.phone,
        isWhatsapp: true,
      });
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#05050f] p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white dark:bg-white/[0.02] rounded-2xl p-8 border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Cek Email Anda</h2>
            <p className="text-slate-500 dark:text-white/50 mb-6">{success}</p>
            <Link
              href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Ke Halaman Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: Hero panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%233b82f6" fill-opacity="0.15"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/40" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <Link href="/" className="inline-flex">
            <Image src="/logo-white.svg" alt="Digsan" width={160} height={50} priority className="h-12 w-auto" />
          </Link>

          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
              Mulai Perjalanan Silsilah Anda
            </h1>
            <p className="text-slate-300 mt-4 text-lg leading-relaxed">
              Daftar sekarang dan bangun silsilah keluarga digital Anda.
              Hubungkan generasi, lestarikan warisan keluarga.
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

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Digsan.id — Silsilah Keluarga Digital
          </p>
        </div>
      </div>

      {/* ─── RIGHT: Form panel ────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50 dark:bg-[#05050f]">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex justify-center">
              <Image src="/logo-white.svg" alt="Digsan" width={120} height={38} priority className="h-10 w-auto" />
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
            Buat Akun Baru
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
            Pilih metode registrasi Anda
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-lg mb-6">
            <button
              onClick={() => { setTab('email'); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === 'email'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
              }`}
            >
              Email
            </button>
            <button
              onClick={() => { setTab('whatsapp'); setError(''); }}
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

          {/* Email registration form */}
          {tab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama lengkap"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ulangi password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">
                  No. Telepon <span className="text-slate-400 dark:text-white/30">(opsional)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="6281234567890"
                />
              </div>

              {form.phone && (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isWhatsapp}
                    onChange={(e) => setForm({ ...form, isWhatsapp: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  Nomor ini aktif di WhatsApp
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition mt-2"
              >
                {loading ? 'Memproses...' : 'Daftar'}
              </button>
            </form>
          )}

          {/* WhatsApp registration form */}
          {tab === 'whatsapp' && (
            <form onSubmit={handleWhatsappSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={waForm.name}
                  onChange={(e) => setWaForm({ ...waForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Nama lengkap"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={waForm.phone}
                  onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="6281234567890"
                />
                <p className="text-xs text-slate-400 dark:text-white/40 mt-1.5">
                  Masukkan nomor dengan kode negara (contoh: 62...)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={waForm.password}
                  onChange={(e) => setWaForm({ ...waForm, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1.5">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={waForm.confirmPassword}
                  onChange={(e) => setWaForm({ ...waForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ulangi password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-semibold rounded-lg transition mt-2"
              >
                {loading ? 'Memproses...' : 'Daftar dengan WhatsApp'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 dark:text-white/50 mt-6">
            Sudah punya akun?{' '}
            <Link href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'} className="text-blue-500 dark:text-blue-400 hover:underline font-medium">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
  }
