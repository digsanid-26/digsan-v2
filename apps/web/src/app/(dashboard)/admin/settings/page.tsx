'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Settings, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import EmailConfigCard from './EmailConfigCard';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const { data: settings, loading, refetch } = useApi<any[]>('/admin/settings');
  const { request } = useAuthApi();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      settings.forEach((s: any) => { vals[s.id] = s.value; });
      setEditValues(vals);
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

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
        <p className="text-slate-500 mt-1">Konfigurasi platform</p>
      </div>

      <EmailConfigCard />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !settings?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Settings size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Belum ada pengaturan</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {settings.map((s: any) => (
            <div key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{s.label || s.key}</p>
                  {s.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  )}
                  <div className="mt-2">
                    {s.type === 'boolean' ? (
                      <select
                        value={editValues[s.id] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [s.id]: e.target.value })}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="true">Ya</option>
                        <option value="false">Tidak</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editValues[s.id] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [s.id]: e.target.value })}
                        className="w-full max-w-md px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                  {s.category}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                  {s.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
