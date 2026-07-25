'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Settings, Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import EmailConfigCard from './EmailConfigCard';

const FEATURE_LIST = [
  {
    key: 'feature_chat_keluarga',
    label: 'Chat Keluarga',
    description: 'Sistem percakapan antar anggota keluarga dari yang private antar anggota keluarga, antar anggota keluarga dalam keluarga besar, lintas keluarga besar, hingga keluarga simbah dan buyut, dengan pengaturan privasi dan allow/disallow, block dan unblock, show dan disable.',
  },
  {
    key: 'feature_digital_membercard',
    label: 'Digital Membercard',
    description: 'Multifungsi dengan foto profil, nomor keanggotaan, nama lengkap, alamat, qrcode yang bila discan mengarah ke profil public user tersebut atau untuk transaksi tukar poin antar anggota (bila fitur telah tersedia).',
  },
  {
    key: 'feature_mmbc_membership',
    label: 'MMBC Membership',
    description: 'Diberikan gratis kepada anggota yang telah memiliki KTP dan smartphone. MMBC Tour & Travel adalah platform layanan digital yang memungkinkan Anda memesan tiket pesawat, hotel, kereta api, hingga mengurus pembayaran tagihan (PLN, PDAM, pulsa) dan transfer uang dalam satu aplikasi.',
  },
  {
    key: 'feature_doa_almarhum',
    label: 'Doa Almarhum',
    description: 'Susunan nama-nama keluarga yang telah almarhum (nama almarhum binti orangtua) dari yang terdekat hingga yang terjauh, yang bisa diatur kedalamannya melalui filter yang komprehensif, bisa di atur font-size, ketebalan, perataan sebelum dicetak/download dalam bentuk print, jpg, maupun pdf. Otomatis aktif ketika lebih dari 5 Family tree terhubung.',
  },
  {
    key: 'feature_personal_channel',
    label: 'Personal Channel',
    description: 'Personal Branding seperti Youtube channel namun lebih luas tidak terbatas hanya video, namun juga blog/artikel, update status, upload gambar/galeri, atau share lainnya. Fitur pengembangan halaman profil user.',
  },
  {
    key: 'feature_arisan_keluarga',
    label: 'Arisan Keluarga',
    description: 'Fasilitas membuat arisan yang bisa diaktifkan ketika sebuah koneksi telah menghubungkan lebih dari 50 orang dengan user aktif mencapai 70% lebih.',
  },
  {
    key: 'feature_koperasi_keluarga',
    label: 'Koperasi Keluarga',
    description: 'Fasilitas upgrade keanggotaan yang akan aktif dalam bentuk penawaran kepada user yang telah ber-ktp atau memiliki pekerjaan.',
  },
  {
    key: 'feature_digsan_komunitas',
    label: 'Digsan Komunitas',
    description: 'Memadukan kesenangan bersosial media seperti berbagi momen/status, kegiatan, kabar-kabar, informasi, dsb beserta interaksinya seperti like, reaction, share, comment kepada keluarga / lintas keluarga / umum.',
  },
  {
    key: 'feature_digsan_usaha',
    label: 'Digsan Usaha',
    description: 'Fasilitas mempromosikan atau membangun usaha dan memunculkan dalam bentuk listing dan landingpage profil usaha milik sendiri dengan konten yang dapat diedit.',
  },
  {
    key: 'feature_digsan_kerja',
    label: 'Digsan Kerja',
    description: 'Marketplace jasa dan kerja Keluarga. Fasilitas menawarkan jasa diri sesuai keahlian, definisi pekerjaan, dan waktu kerja yang bisa ditentukan sendiri.',
  },
];

type Tab = 'platform' | 'fasilitas';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [tab, setTab] = useState<Tab>('platform');
  const { data: settings, loading, refetch } = useApi<any[]>('/admin/settings');
  const { request } = useAuthApi();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [featureLoading, setFeatureLoading] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      settings.forEach((s: any) => { vals[s.id] = s.value; });
      setEditValues(vals);

      const fStates: Record<string, boolean> = {};
      FEATURE_LIST.forEach((f) => {
        const existing = settings.find((s: any) => s.key === f.key);
        fStates[f.key] = existing ? existing.value === 'true' : false;
      });
      setFeatureStates(fStates);
    }
  }, [settings]);

  const handleSave = async (setting: any) => {
    setSaving(setting.id);
    try {
      await request(`/admin/settings/${setting.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: editValues[setting.id] }),
      });
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleFeatureToggle = async (featureKey: string, label: string, description: string) => {
    const newValue = !featureStates[featureKey];
    setFeatureStates((prev) => ({ ...prev, [featureKey]: newValue }));
    setFeatureLoading(featureKey);
    try {
      await request(`/admin/settings/${featureKey}/upsert`, {
        method: 'PUT',
        body: JSON.stringify({
          value: String(newValue),
          label,
          category: 'features',
          type: 'boolean',
          description,
        }),
      });
      refetch();
    } catch (err: any) {
      setFeatureStates((prev) => ({ ...prev, [featureKey]: !newValue }));
      alert(err.message);
    } finally {
      setFeatureLoading(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pengaturan Sistem</h1>
        <p className="text-slate-500 dark:text-white/50 mt-1">Konfigurasi platform</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setTab('platform')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'platform'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70'
          }`}
        >
          Konfigurasi Platform
        </button>
        <button
          onClick={() => setTab('fasilitas')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'fasilitas'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70'
          }`}
        >
          Konfigurasi Fasilitas
        </button>
      </div>

      {tab === 'platform' && (
        <>
          <EmailConfigCard />

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !settings?.length ? (
            <div className="text-center py-16 bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <Settings size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">Belum ada pengaturan</h3>
            </div>
          ) : (
            <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] divide-y divide-slate-100 dark:divide-white/[0.04]">
              {settings.map((s: any) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{s.label || s.key}</p>
                      {s.description && (
                        <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">{s.description}</p>
                      )}
                      <div className="mt-2">
                        {s.type === 'boolean' ? (
                          <select
                            value={editValues[s.id] || ''}
                            onChange={(e) => setEditValues({ ...editValues, [s.id]: e.target.value })}
                            className="px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                          >
                            <option value="true">Ya</option>
                            <option value="false">Tidak</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editValues[s.id] || ''}
                            onChange={(e) => setEditValues({ ...editValues, [s.id]: e.target.value })}
                            className="w-full max-w-md px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                          />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSave(s)}
                      disabled={saving === s.id || editValues[s.id] === s.value}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-medium transition-colors shrink-0"
                    >
                      <Save size={14} />
                      {saving === s.id ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-500 dark:text-white/50">
                      {s.category}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-500 dark:text-white/50">
                      {s.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'fasilitas' && (
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] divide-y divide-slate-100 dark:divide-white/[0.04]">
          {FEATURE_LIST.map((feature) => {
            const enabled = featureStates[feature.key] || false;
            const isLoading = featureLoading === feature.key;
            return (
              <div key={feature.key} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{feature.label}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 leading-relaxed">{feature.description}</p>
                </div>
                <button
                  onClick={() => handleFeatureToggle(feature.key, feature.label, feature.description)}
                  disabled={isLoading}
                  className="flex items-center gap-2 shrink-0 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={28} className="animate-spin text-slate-400" />
                  ) : enabled ? (
                    <>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs">Aktif</span>
                      <ToggleRight size={28} className="text-emerald-600 dark:text-emerald-400" />
                    </>
                  ) : (
                    <>
                      <span className="text-slate-400 dark:text-white/40 text-xs">Nonaktif</span>
                      <ToggleLeft size={28} className="text-slate-300 dark:text-white/30" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
