'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { jobApi, JobCategory } from '@/lib/job';
import { getTokens } from '@/lib/auth';
import {
  HardHat, ArrowLeft, Loader2, Plus, X, CheckCircle, Info,
} from 'lucide-react';
import Link from 'next/link';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LABELS: Record<string, string> = {
  Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis',
  Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu',
};

export default function RegisterWorkerPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [bio, setBio] = useState('');
  const [intro, setIntro] = useState('');
  const [location, setLocation] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // Skills
  const [skills, setSkills] = useState<{ subCategoryId: string; pricingType: string; rate: string; canProvideEquipment: boolean; equipmentList: string }[]>([]);

  // Schedules
  const [schedules, setSchedules] = useState<{ dayOfWeek: string; startTime: string; endTime: string; enabled: boolean }[]>(
    DAYS.map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '17:00', enabled: false })),
  );

  // Service areas
  const [areas, setAreas] = useState<string[]>(['']);

  useEffect(() => {
    jobApi
      .getCategories()
      .then((data) => setCategories(data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const allSubCategories = categories.flatMap((c) =>
    (c.subCategories || []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      categoryName: c.name,
    })),
  );

  const addSkill = () => {
    setSkills([...skills, { subCategoryId: '', pricingType: 'PER_JAM', rate: '', canProvideEquipment: false, equipmentList: '' }]);
  };

  const removeSkill = (idx: number) => {
    setSkills(skills.filter((_, i) => i !== idx));
  };

  const updateSkill = (idx: number, field: string, value: any) => {
    setSkills(skills.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (skills.length === 0) {
      setError('Tambahkan minimal 1 keahlian');
      return;
    }
    if (skills.some((s) => !s.subCategoryId || !s.rate)) {
      setError('Lengkapi semua keahlian (sub-kategori dan tarif)');
      return;
    }

    const tokens = getTokens();
    if (!tokens) {
      router.push('/login');
      return;
    }

    setSubmitting(true);
    try {
      const validSchedules = schedules
        .filter((s) => s.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      const validAreas = areas.filter((a) => a.trim());

      await jobApi.registerWorker(tokens.accessToken, {
        gender: gender || undefined,
        age: age ? Number(age) : undefined,
        whatsappNumber: whatsappNumber || undefined,
        bio: bio || undefined,
        intro: intro || undefined,
        location: location || undefined,
        fullAddress: fullAddress || undefined,
        bankName: bankName || undefined,
        bankAccount: bankAccount || undefined,
        bankAccountName: bankAccountName || undefined,
        skills: skills.map((s) => ({
          subCategoryId: s.subCategoryId,
          pricingType: s.pricingType,
          rate: Number(s.rate),
          canProvideEquipment: s.canProvideEquipment,
          equipmentList: s.equipmentList || undefined,
        })),
        workSchedules: validSchedules.length > 0 ? validSchedules : undefined,
        serviceAreas: validAreas.length > 0 ? validAreas.map((areaName) => ({ areaName })) : undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar sebagai pekerja');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="rounded-2xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
            Profil pekerja Anda telah dibuat. Admin akan memverifikasi pendaftaran Anda sebelum akun pekerja aktif.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/kerja" className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">
              Kembali ke Beranda
            </Link>
            <Link href="/kerja/workers" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
              Lihat Pekerja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/kerja" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70 mb-3">
          <ArrowLeft size={16} /> Kembali ke Digsan Kerja
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500 text-white">
            <HardHat size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jadi Pekerja</h1>
            <p className="text-sm text-slate-500 dark:text-white/40">Daftarkan diri Anda sebagai pekerja di Digsan Kerja</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border p-4 flex items-start gap-3 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20">
        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Setelah mendaftar, profil Anda akan diverifikasi oleh admin. Anda akan menerima notifikasi setelah disetujui.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border p-4 text-sm text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Section title="Informasi Pribadi">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis Kelamin">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                <option value="">Pilih...</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </Field>
            <Field label="Usia">
              <input type="number" min={17} max={70} value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} placeholder="25" />
            </Field>
          </div>
          <Field label="Nomor WhatsApp">
            <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={inputClass} placeholder="081234567890" />
          </Field>
          <Field label="Perkenalan Singkat">
            <input value={intro} onChange={(e) => setIntro(e.target.value)} className={inputClass} placeholder="Tukang AC berpengalaman 5 tahun" />
          </Field>
          <Field label="Bio">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={inputClass} placeholder="Ceritakan pengalaman dan keahlian Anda..." />
          </Field>
        </Section>

        {/* Location */}
        <Section title="Lokasi">
          <Field label="Kota / Daerah">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="Jakarta Selatan" />
          </Field>
          <Field label="Alamat Lengkap">
            <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} rows={2} className={inputClass} placeholder="Jl. Contoh No. 123, RT/RW, Kelurahan, Kecamatan" />
          </Field>
        </Section>

        {/* Skills */}
        <Section title="Keahlian" subtitle="Pilih sub-kategori yang Anda kuasai beserta tarif">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-3 bg-slate-50 border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-white/40">Keahlian #{idx + 1}</span>
                    <button type="button" onClick={() => removeSkill(idx)} className="text-red-500 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                  <Field label="Sub-Kategori">
                    <select value={skill.subCategoryId} onChange={(e) => updateSkill(idx, 'subCategoryId', e.target.value)} className={inputClass}>
                      <option value="">Pilih kategori...</option>
                      {allSubCategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.categoryName} › {sub.name}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipe Tarif">
                      <select value={skill.pricingType} onChange={(e) => updateSkill(idx, 'pricingType', e.target.value)} className={inputClass}>
                        <option value="PER_JAM">Per Jam</option>
                        <option value="PER_PROJECT">Per Project</option>
                      </select>
                    </Field>
                    <Field label="Tarif (Rp)">
                      <input type="number" value={skill.rate} onChange={(e) => updateSkill(idx, 'rate', e.target.value)} className={inputClass} placeholder="50000" />
                    </Field>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={skill.canProvideEquipment} onChange={(e) => updateSkill(idx, 'canProvideEquipment', e.target.checked)} className="rounded" />
                      <span className="text-sm text-slate-600 dark:text-white/60">Saya bisa membawa peralatan sendiri</span>
                    </label>
                    {skill.canProvideEquipment && (
                      <Field label="Daftar Peralatan">
                        <input value={skill.equipmentList} onChange={(e) => updateSkill(idx, 'equipmentList', e.target.value)} className={inputClass} placeholder="Tang, obeng, multimeter..." />
                      </Field>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSkill}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center dark:border-white/10 dark:text-white/40 dark:hover:border-blue-500/50 dark:hover:text-blue-400"
              >
                <Plus size={16} /> Tambah Keahlian
              </button>
            </div>
          )}
        </Section>

        {/* Work Schedule */}
        <Section title="Jadwal Kerja" subtitle="Pilih hari dan jam Anda tersedia">
          <div className="space-y-2">
            {schedules.map((sched, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-28 shrink-0">
                  <input
                    type="checkbox"
                    checked={sched.enabled}
                    onChange={(e) => setSchedules(schedules.map((s, i) => (i === idx ? { ...s, enabled: e.target.checked } : s)))}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-600 dark:text-white/60">{DAY_LABELS[sched.dayOfWeek]}</span>
                </label>
                {sched.enabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="time" value={sched.startTime} onChange={(e) => setSchedules(schedules.map((s, i) => (i === idx ? { ...s, startTime: e.target.value } : s)))} className={inputClass} />
                    <span className="text-slate-400 text-sm">—</span>
                    <input type="time" value={sched.endTime} onChange={(e) => setSchedules(schedules.map((s, i) => (i === idx ? { ...s, endTime: e.target.value } : s)))} className={inputClass} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Service Areas */}
        <Section title="Area Layanan" subtitle="Daerah yang Anda layani">
          <div className="space-y-2">
            {areas.map((area, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={area}
                  onChange={(e) => setAreas(areas.map((a, i) => (i === idx ? e.target.value : a)))}
                  className={inputClass}
                  placeholder="Contoh: Jakarta Selatan, Depok, Tangerang..."
                />
                {areas.length > 1 && (
                  <button type="button" onClick={() => setAreas(areas.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAreas([...areas, ''])}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus size={14} /> Tambah Area
            </button>
          </div>
        </Section>

        {/* Bank Info */}
        <Section title="Informasi Bank" subtitle="Untuk pembayaran hasil kerja">
          <Field label="Nama Bank">
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} placeholder="BCA / Mandiri / BNI..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nomor Rekening">
              <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={inputClass} placeholder="1234567890" />
            </Field>
            <Field label="Atas Nama">
              <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} placeholder="Nama sesuai rekening" />
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/kerja" className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <HardHat size={16} />}
            Daftar sebagai Pekerja
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white";

function Field({ label, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-white/40 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, subtitle, children }: any) {
  return (
    <div className="rounded-xl border p-5 space-y-3 bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
