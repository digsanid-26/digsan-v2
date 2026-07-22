'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, MessageCircle, Save, BarChart3, ToggleLeft, ToggleRight } from 'lucide-react';
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
  { value: 'IN_APP', label: 'In-App', icon: Bell },
  { value: 'PUSH', label: 'Push', icon: Smartphone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
];

type Setting = { id: string; type: string; channel: string; enabled: boolean };

export default function AdminNotificationsPage() {
  const { data: settingsData, loading, refetch: refetchSettings } = useApi<Setting[]>('/admin/notifications/settings');
  const { data: stats, refetch: refetchStats } = useApi<any>('/admin/notifications/stats');
  const { request } = useAuthApi();
  const [settings, setSettings] = useState<Record<string, { channel: string; enabled: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settingsData) return;
    const map: Record<string, { channel: string; enabled: boolean }> = {};
    for (const s of settingsData) {
      map[s.type] = { channel: s.channel, enabled: s.enabled };
    }
    setSettings(map);
  }, [settingsData]);

  const toggleType = (type: string) => {
    const current = settings[type];
    const newEnabled = current ? !current.enabled : false;
    setSettings((prev) => ({
      ...prev,
      [type]: { channel: current?.channel || 'IN_APP', enabled: newEnabled },
    }));
    setSaved(false);
  };

  const setChannel = (type: string, channel: string) => {
    const current = settings[type];
    setSettings((prev) => ({
      ...prev,
      [type]: { channel, enabled: current?.enabled ?? true },
    }));
    setSaved(false);
  };

  const handleSave = async (type: string) => {
    setSaving(true);
    try {
      const s = settings[type];
      await request('/admin/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ type, channel: s?.channel || 'IN_APP', enabled: s?.enabled ?? true }),
      });
      setSaved(true);
      refetchSettings();
    } catch {}
    finally { setSaving(false); }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const type of NOTIF_TYPES.map((t) => t.value)) {
        const s = settings[type];
        await request('/admin/notifications/settings', {
          method: 'PUT',
          body: JSON.stringify({ type, channel: s?.channel || 'IN_APP', enabled: s?.enabled ?? true }),
        });
      }
      setSaved(true);
      refetchSettings();
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Konfigurasi Notifikasi</h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Kelola jenis notifikasi dan kanal pengiriman</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Bell size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.total ?? 0}</p>
              <p className="text-sm text-slate-500 dark:text-white/40">Total Notifikasi</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
              <BarChart3 size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.unread ?? 0}</p>
              <p className="text-sm text-slate-500 dark:text-white/40">Belum Dibaca</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <ToggleRight size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {NOTIF_TYPES.filter((t) => settings[t.value]?.enabled ?? true).length}
              </p>
              <p className="text-sm text-slate-500 dark:text-white/40">Jenis Aktif</p>
            </div>
          </div>
        </div>
      </div>

      {/* By Type Breakdown */}
      {stats?.byType && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Distribusi per Jenis</h3>
          <div className="space-y-2">
            {stats.byType.map((item: any) => (
              <div key={item.type} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-white/60 w-40 truncate">{item.type}</span>
                <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (item.count / stats.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-white/40 w-12 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Table */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">Jenis Notifikasi</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">Kanal Default</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">Status</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {NOTIF_TYPES.map((t) => {
                const s = settings[t.value];
                const enabled = s?.enabled ?? true;
                return (
                  <tr key={t.value} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{t.label}</td>
                    <td className="px-4 py-3">
                      <select
                        value={s?.channel || 'IN_APP'}
                        onChange={(e) => setChannel(t.value, e.target.value)}
                        className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-white/5 text-slate-700 dark:text-white/70"
                      >
                        {CHANNELS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleType(t.value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleSave(t.value)}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">Pengaturan tersimpan!</span>}
      </div>
    </div>
  );
}
