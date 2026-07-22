'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, MessageCircle, Save } from 'lucide-react';
import { useApi, useAuthApi } from '@/lib/hooks';

const NOTIF_TYPES = [
  { value: 'TREE_INVITATION', label: 'Undangan Silsilah' },
  { value: 'MEMBER_ADDED', label: 'Anggota Baru' },
  { value: 'BADGE_EARNED', label: 'Badge Diperoleh' },
  { value: 'POINT_RECEIVED', label: 'Poin Diterima' },
  { value: 'SYSTEM', label: 'Sistem' },
  { value: 'ORDER_CREATED', label: 'Pesanan Dibuat' },
  { value: 'ORDER_CONFIRMED', label: 'Pesanan Dikonfirmasi' },
  { value: 'ORDER_COMPLETED', label: 'Pesanan Selesai' },
  { value: 'ORDER_CANCELLED', label: 'Pesanan Dibatalkan' },
  { value: 'PAYMENT_SUCCESS', label: 'Pembayaran Berhasil' },
  { value: 'PAYMENT_FAILED', label: 'Pembayaran Gagal' },
  { value: 'REVIEW_RECEIVED', label: 'Ulasan Diterima' },
];

const CHANNELS = [
  { value: 'IN_APP', label: 'In-App (Bell)', icon: Bell },
  { value: 'PUSH', label: 'Push', icon: Smartphone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
];

type Pref = { id: string; type: string; channel: string; enabled: boolean };

export default function NotificationSettingsPage() {
  const { data, loading, refetch } = useApi<Pref[]>('/notifications/preferences');
  const { request } = useAuthApi();
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const map: Record<string, Record<string, boolean>> = {};
    for (const t of NOTIF_TYPES) {
      map[t.value] = {};
      for (const c of CHANNELS) {
        map[t.value][c.value] = true; // default enabled
      }
    }
    for (const p of data) {
      if (!map[p.type]) map[p.type] = {};
      map[p.type][p.channel] = p.enabled;
    }
    setPrefs(map);
  }, [data]);

  const toggle = (type: string, channel: string) => {
    setPrefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type]?.[channel] },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const type of Object.keys(prefs)) {
        for (const channel of Object.keys(prefs[type])) {
          await request('/notifications/preferences', {
            method: 'PUT',
            body: JSON.stringify({ type, channel, enabled: prefs[type][channel] }),
          });
        }
      }
      setSaved(true);
      refetch();
    } catch {}
    finally { setSaving(false); }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Notifikasi</h1>
        <p className="text-slate-500 mt-1">Pilih notifikasi yang ingin Anda terima per kanal</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Jenis Notifikasi</th>
                {CHANNELS.map((c) => (
                  <th key={c.value} className="px-4 py-3 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <c.icon size={16} className="text-slate-500" />
                      <span className="text-xs font-medium text-slate-600">{c.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {NOTIF_TYPES.map((t) => (
                <tr key={t.value} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.label}</td>
                  {CHANNELS.map((c) => (
                    <td key={c.value} className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggle(t.value, c.value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          prefs[t.value]?.[c.value] ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            prefs[t.value]?.[c.value] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Pengaturan tersimpan!</span>}
      </div>
    </div>
  );
}
