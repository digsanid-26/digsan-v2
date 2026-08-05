'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Briefcase, Heart, Check, Camera, MapPin, GraduationCap, Cake, Loader2 } from 'lucide-react';
import { useAuthApi } from '@/lib/hooks';
import { useTheme } from '@/app/components/ThemeProvider';

const JOBS = [
  'Wiraswasta', 'PNS', 'Karyawan Swasta', 'Guru/Dosen', 'Dokter/Bidan/Perawat',
  'Pensiunan', 'Pelajar/Mahasiswa', 'Ibu Rumah Tangga', 'Lainnya',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function UserProfileModal({ open, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { request } = useAuthApi();

  const [form, setForm] = useState({
    fullName: '',
    bio: '',
    occupation: '',
    hobbies: '',
    birthDate: '',
    birthPlace: '',
    education: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    request('/users/me').then((data: any) => {
      setForm({
        fullName: data.name || '',
        bio: data.bio || '',
        occupation: data.occupation || '',
        hobbies: data.hobbies || '',
        birthDate: data.birthDate ? new Date(data.birthDate).toISOString().split('T')[0] : '',
        birthPlace: data.birthPlace || '',
        education: data.education || '',
      });
      setPhoto(data.avatar || null);
      setEmail(data.email || '');
    }).catch((e: any) => {
      setError(e.message || 'Gagal memuat profil');
    }).finally(() => setLoading(false));
  }, [open]);

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleSave = async () => {
    setSaving(true);
    setError('');
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
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0a0e1a] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Profil Detail</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : (
            <>
              {/* Photo */}
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/15 shrink-0">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="foto profil" className="w-full h-full object-cover" />
                  ) : <User size={36} className="text-slate-400 dark:text-white/40" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Foto Profil</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">JPG atau PNG, maksimal 2MB.</p>
                </div>
              </div>

              {/* Basic Info */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Dasar</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Nama Lengkap</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                      <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        className={`${inputCls} pl-10`} placeholder="Nama lengkap" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                      <input value={email} readOnly className={`${inputCls} pl-10 opacity-60 cursor-not-allowed`} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Personal Info */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Pribadi</h3>
                <div className="grid gap-4 sm:grid-cols-2">
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
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Tambahan</h3>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Sekilas Info (Bio)</label>
                  <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3} placeholder="Ceritakan sedikit tentang diri Anda..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 resize-none dark:bg-white/5 dark:border-white/15 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Pekerjaan</label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                    <select value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                      className={`${inputCls} pl-10 appearance-none cursor-pointer dark:[color-scheme:dark]`}>
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

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-white/10 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg dark:text-white/60 dark:hover:bg-white/10">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
