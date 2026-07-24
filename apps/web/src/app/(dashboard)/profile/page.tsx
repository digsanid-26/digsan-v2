'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUser } from '@/lib/auth';
import { useTheme } from '@/app/components/ThemeProvider';
import { useAuthApi } from '@/lib/hooks';
import { User, Mail, Lock, Eye, EyeOff, Briefcase, Heart, Check, Camera, MapPin, GraduationCap, Cake } from 'lucide-react';

const JOBS = [
  'Wiraswasta', 'PNS', 'Karyawan Swasta', 'Guru/Dosen', 'Dokter/Bidan/Perawat',
  'Pensiunan', 'Pelajar/Mahasiswa', 'Ibu Rumah Tangga', 'Lainnya',
];

export default function ProfilePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { request } = useAuthApi();
  const [user, setUser] = useState<{ id: string; name: string; email: string; avatar: string | null } | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    password: '',
    bio: '',
    occupation: '',
    hobbies: '',
    birthDate: '',
    birthPlace: '',
    education: '',
  });

  const [photo, setPhoto] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUser(u);
      setForm((f) => ({ ...f, fullName: u.name, username: u.email.split('@')[0] }));
      setPhoto(u.avatar);
    }
    // Fetch full profile from API
    request('/users/me').then((data: any) => {
      setForm((f) => ({
        ...f,
        fullName: data.name || f.fullName,
        bio: data.bio || '',
        occupation: data.occupation || '',
        hobbies: data.hobbies || '',
        birthDate: data.birthDate ? new Date(data.birthDate).toISOString().split('T')[0] : '',
        birthPlace: data.birthPlace || '',
        education: data.education || '',
      }));
      if (data.avatar) setPhoto(data.avatar);
    }).catch(() => {});
  }, []);

  // Profile completeness calculation
  const completeness = useCallback(() => {
    const fields = [form.fullName, form.bio, form.occupation, form.hobbies, form.birthDate, form.birthPlace, form.education, photo];
    const filled = fields.filter((v) => v && String(v).trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [form, photo]);

  const pct = completeness();

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      await request('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.fullName,
          bio: form.bio,
          occupation: form.occupation,
          hobbies: form.hobbies,
          birthDate: form.birthDate || undefined,
          birthPlace: form.birthPlace,
          education: form.education,
        }),
      });
      setSavedMsg('Profil berhasil disimpan');
    } catch (err: any) {
      setSavedMsg(err.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
          Profil Saya
        </h1>
        <p className="text-slate-500 dark:text-white/50 mt-1 text-sm">Kelola informasi akun dan profil Anda.</p>
      </div>

      {/* Lengkapi Profil progress */}
      <div className={`rounded-2xl border p-5 ${pct < 100 ? 'border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-900 dark:text-white">Kelengkapan Profil</p>
          <span className={`text-sm font-bold ${pct < 100 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all ${pct < 100 ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 dark:text-white/50">
          {pct < 100
            ? 'Melengkapi profil 100% bisa memberikan poin pengabdian sebesar 20 poin.'
            : 'Profil Anda sudah lengkap! Poin pengabdian +20.'}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Photo */}
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/15 shrink-0">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="foto profil" className="w-full h-full object-cover" />
            ) : <User size={40} className="text-slate-400 dark:text-white/40" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Foto Profil</p>
            <p className="text-xs text-slate-500 dark:text-white/50 mb-3">JPG atau PNG, maksimal 2MB.</p>
            <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10">
              <Camera size={16} />Ganti Foto
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <section className="rounded-2xl border p-6 space-y-5
          bg-white border-slate-200 shadow-sm
          dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Dasar</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className={`${inputCls} pl-10`} placeholder="Nama lengkap Anda" required />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className={`${inputCls} pl-10`} placeholder="@username" required />
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input value={user?.email || ''} readOnly
                  className={`${inputCls} pl-10 opacity-60 cursor-not-allowed`} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Password Baru</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${inputCls} pl-10 pr-10`} placeholder="Biarkan kosong jika tidak ingin mengubah" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/60">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Info */}
        <section className="rounded-2xl border p-6 space-y-5
          bg-white border-slate-200 shadow-sm
          dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Pribadi</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Tempat Lahir</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                  className={`${inputCls} pl-10`} placeholder="Tempat lahir" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Tanggal Lahir</label>
              <div className="relative">
                <Cake size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className={`${inputCls} pl-10`} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Pendidikan Terakhir</label>
            <div className="relative">
              <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
              <input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })}
                className={`${inputCls} pl-10`} placeholder="Misal: S1 Teknik Informatika" />
            </div>
          </div>
        </section>

        {/* Additional Info */}
        <section className="rounded-2xl border p-6 space-y-5
          bg-white border-slate-200 shadow-sm
          dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Tambahan</h2>

          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Sekilas Info</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3} placeholder="Ceritakan sedikit tentang diri Anda..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 resize-none dark:bg-white/5 dark:border-white/15 dark:text-white" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Pekerjaan</label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
              <select value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                className={`${inputCls} pl-10 appearance-none cursor-pointer`}>
                <option value="">Pilih pekerjaan</option>
                {JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Hobi / Kegemaran</label>
            <div className="relative">
              <Heart size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
              <input value={form.hobbies} onChange={(e) => setForm({ ...form, hobbies: e.target.value })}
                className={`${inputCls} pl-10`} placeholder="Misal: membaca, memasak, traveling..." />
            </div>
          </div>
        </section>

        {savedMsg && (
          <p className={`text-sm text-center ${savedMsg.includes('Gagal') ? 'text-red-500' : 'text-emerald-500'}`}>{savedMsg}</p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
