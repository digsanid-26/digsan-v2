'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { getTokens } from '@/lib/auth';
import {
  Trophy,
  Plus,
  Trash2,
  Edit,
  Gift,
  Settings,
  BarChart3,
  List,
  X,
  Check,
  Clock,
  Package,
  Zap,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const tokens = getTokens();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...options.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any).message || `HTTP ${res.status}`);
  return (json as any).data ?? json;
}

export default function AdminGamificationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const [tab, setTab] = useState<'config' | 'rules' | 'stats' | 'rewards'>('config');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy size={28} className="text-amber-500 dark:text-amber-400" />
          Gamification Admin
        </h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Kelola tipe poin, statistik, reward, dan redeem</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.06]">
        <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={Settings} label="Konfigurasi" />
        <TabButton active={tab === 'rules'} onClick={() => setTab('rules')} icon={Zap} label="Role Poin" />
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={BarChart3} label="Stat & Logs" />
        <TabButton active={tab === 'rewards'} onClick={() => setTab('rewards')} icon={Gift} label="Reward & Redeem" />
      </div>

      {tab === 'config' && <ConfigTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'rewards' && <RewardsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

// ─── CONFIG TAB ────────────────────────────────────────────────

function ConfigTab() {
  const [pointTypes, setPointTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', label: '', description: '', icon: '', color: '#3b82f6' });
  const [error, setError] = useState('');

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/admin/gamification/point-types');
      setPointTypes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await apiRequest(`/admin/gamification/point-types/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ label: form.label, description: form.description, icon: form.icon, color: form.color }),
        });
      } else {
        await apiRequest('/admin/gamification/point-types', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', label: '', description: '', icon: '', color: '#3b82f6' });
      fetchTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (pt: any) => {
    setEditing(pt);
    setForm({ name: pt.name, label: pt.label, description: pt.description || '', icon: pt.icon || '', color: pt.color || '#3b82f6' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus tipe poin ini?')) return;
    try {
      await apiRequest(`/admin/gamification/point-types/${id}`, { method: 'DELETE' });
      fetchTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (pt: any) => {
    try {
      await apiRequest(`/admin/gamification/point-types/${pt.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !pt.isActive }),
      });
      fetchTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg p-3">{error}</div>}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tipe Poin</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: '', label: '', description: '', icon: '', color: '#3b82f6' }); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} /> Tambah Tipe
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Nama (slug)</label>
              <input
                type="text" required disabled={!!editing}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white disabled:bg-slate-50 dark:disabled:bg-white/[0.02]"
                placeholder="pengabdian"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Label</label>
              <input
                type="text" required
                value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                placeholder="Poin Pengabdian"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Deskripsi</label>
              <input
                type="text"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                placeholder="Deskripsi singkat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Icon (nama lucide)</label>
              <input
                type="text"
                value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white"
                placeholder="heart"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Warna</label>
              <input
                type="color"
                value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-10 border border-slate-300 dark:border-white/10 rounded-lg cursor-pointer bg-white dark:bg-white/5"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              {editing ? 'Update' : 'Simpan'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">
              Batal
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" /></div>
      ) : pointTypes.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-8 text-center text-slate-500 dark:text-white/40">
          Belum ada tipe poin. Klik "Tambah Tipe" untuk membuat.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pointTypes.map((pt) => (
            <div key={pt.id} className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (pt.color || '#3b82f6') + '20' }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: pt.color || '#3b82f6' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{pt.label}</h3>
                    <p className="text-xs text-slate-400 dark:text-white/30">{pt.name}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${pt.isActive ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30'}`}>
                  {pt.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              {pt.description && <p className="text-sm text-slate-500 dark:text-white/40 mt-3">{pt.description}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleEdit(pt)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit size={14} /> Edit
                </button>
                <button onClick={() => toggleActive(pt)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg">
                  {pt.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => handleDelete(pt.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RULES TAB (Role Poin) ──────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ label: '', description: '', pointType: '', amount: 0, isEnabled: true, streakDays: null as number | null, bonusAmount: null as number | null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/admin/gamification/rules');
      setRules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const startEdit = (rule: any) => {
    setEditing(rule);
    setEditForm({
      label: rule.label || '',
      description: rule.description || '',
      pointType: rule.pointType || '',
      amount: rule.amount || 0,
      isEnabled: rule.isEnabled ?? true,
      streakDays: rule.streakDays ?? null,
      bonusAmount: rule.bonusAmount ?? null,
    });
  };

  const saveRule = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/admin/gamification/rules/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setEditing(null);
      loadRules();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (rule: any) => {
    try {
      await apiRequest(`/admin/gamification/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
      loadRules();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-center py-8 text-slate-400">Memuat...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/50 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Tipe Poin</th>
              <th className="text-center px-4 py-3 font-medium">Jumlah</th>
              <th className="text-center px-4 py-3 font-medium">Streak Bonus</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">{rule.label}</div>
                  {rule.description && <div className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{rule.description}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">{rule.pointType}</span>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{rule.amount}</td>
                <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-white/50">
                  {rule.streakDays && rule.bonusAmount ? `${rule.bonusAmount} poin / ${rule.streakDays} hari` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleEnabled(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${rule.isEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: rule.isEnabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(rule)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Edit size={13} />Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Role: {editing.label}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={18} /></button>
            </div>

            {error && <div className="text-sm text-rose-500">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Label</label>
                <input
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Deskripsi</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Tipe Poin</label>
                <input
                  value={editForm.pointType}
                  onChange={(e) => setEditForm({ ...editForm, pointType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Jumlah Poin</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                />
              </div>
              {editing.key === 'streak_5_day' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Hari Streak</label>
                    <input
                      type="number"
                      value={editForm.streakDays ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, streakDays: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Bonus Poin</label>
                    <input
                      type="number"
                      value={editForm.bonusAmount ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, bonusAmount: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/70">
                <input
                  type="checkbox"
                  checked={editForm.isEnabled}
                  onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
                  className="rounded border-slate-300 dark:border-white/20"
                />
                Aktif
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveRule}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STATS & LOGS TAB ──────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, topData, logsData] = await Promise.all([
        apiRequest('/admin/gamification/stats'),
        apiRequest('/admin/gamification/top-users?limit=10'),
        apiRequest(`/admin/gamification/logs?page=${logPage}&limit=20${filterType ? `&type=${filterType}` : ''}`),
      ]);
      setStats(statsData);
      setTopUsers(topData);
      setLogs(logsData.points);
      setLogTotal(logsData.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [logPage, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !stats) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBox label="Total Poin Diberikan" value={stats?.totalPointsAwarded ?? 0} color="bg-amber-500" icon={Trophy} />
        <StatBox label="User dengan Poin" value={stats?.totalUsersWithPoints ?? 0} color="bg-blue-500" icon={List} />
        <StatBox label="Tipe Poin Aktif" value={stats?.pointTypeStats?.length ?? 0} color="bg-emerald-500" icon={BarChart3} />
      </div>

      {/* Point Type Stats */}
      {stats?.pointTypeStats?.length > 0 && (
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Statistik per Tipe Poin</h3>
          <div className="space-y-3">
            {stats.pointTypeStats.map((s: any) => (
              <div key={s.type} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/[0.06] last:border-0">
                <div>
                  <span className="font-medium text-slate-700 dark:text-white/80">{s.type}</span>
                  <span className="text-xs text-slate-400 dark:text-white/30 ml-2">{s.transactionCount} transaksi</span>
                </div>
                <span className="font-bold text-amber-600">{s.totalAmount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 Users */}
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Top 10 Member</h3>
        <div className="space-y-2">
          {topUsers.map((u) => (
            <div key={u.userId} className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-white/60">
                {u.rank}
              </div>
              {u.avatar ? (
                <img src={u.avatar} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  {u.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.name}</div>
                <div className="text-xs text-slate-400 dark:text-white/30 truncate">{u.email}</div>
              </div>
              <span className="font-bold text-amber-600">{u.totalPoints.toLocaleString()}</span>
            </div>
          ))}
          {topUsers.length === 0 && <p className="text-sm text-slate-400 dark:text-white/30 text-center py-4">Belum ada data</p>}
        </div>
      </div>

      {/* Point Logs */}
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">History Poin</h3>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setLogPage(1); }}
            className="px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          >
            <option value="">Semua tipe</option>
            {stats?.pointTypeStats?.map((s: any) => <option key={s.type} value={s.type}>{s.type}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 dark:text-white/30 border-b border-slate-100 dark:border-white/[0.06]">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Tipe</th>
                <th className="pb-2 pr-4">Jumlah</th>
                <th className="pb-2 pr-4">Alasan</th>
                <th className="pb-2">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 dark:border-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedLog(log)}>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-slate-700 dark:text-white/80">{log.user?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-400 dark:text-white/30">{log.user?.email}</div>
                  </td>
                  <td className="py-2 pr-4"><span className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-xs dark:text-white/60">{log.type}</span></td>
                  <td className={`py-2 pr-4 font-bold ${log.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {log.amount >= 0 ? '+' : ''}{log.amount}
                  </td>
                  <td className="py-2 pr-4 text-slate-500 dark:text-white/40 max-w-xs truncate">{log.reason || '-'}</td>
                  <td className="py-2 text-xs text-slate-400 dark:text-white/30">{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logTotal > 20 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500 dark:text-white/40">{logTotal} total, halaman {logPage}</span>
            <div className="flex gap-2">
              <button
                disabled={logPage <= 1}
                onClick={() => setLogPage(logPage - 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/10 rounded-lg disabled:opacity-50 dark:text-white/60"
              >
                Sebelumnya
              </button>
              <button
                disabled={logPage * 20 >= logTotal}
                onClick={() => setLogPage(logPage + 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/10 rounded-lg disabled:opacity-50 dark:text-white/60"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal onClose={() => setSelectedLog(null)} title="Detail Poin">
          <div className="space-y-3">
            <DetailRow label="User" value={`${selectedLog.user?.name} (${selectedLog.user?.email})`} />
            <DetailRow label="Tipe" value={selectedLog.type} />
            <DetailRow label="Jumlah" value={String(selectedLog.amount)} />
            <DetailRow label="Alasan" value={selectedLog.reason || '-'} />
            <DetailRow label="Waktu" value={new Date(selectedLog.createdAt).toLocaleString('id-ID')} />
            {selectedLog.metadata && (
              <div>
                <div className="text-xs text-slate-400 dark:text-white/30 mb-1">Metadata</div>
                <pre className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 text-xs overflow-x-auto text-slate-700 dark:text-white/60">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REWARDS & REDEEM TAB ──────────────────────────────────────

function RewardsTab() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [redeemRequests, setRedeemRequests] = useState<any[]>([]);
  const [redeemTotal, setRedeemTotal] = useState(0);
  const [redeemPage, setRedeemPage] = useState(1);
  const [redeemFilter, setRedeemFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null);
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', icon: '', pointCost: 100, stock: undefined as number | undefined });
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardsData, redeemData] = await Promise.all([
        apiRequest('/admin/gamification/rewards'),
        apiRequest(`/admin/gamification/redeem?page=${redeemPage}&limit=20${redeemFilter ? `&status=${redeemFilter}` : ''}`),
      ]);
      setRewards(rewardsData);
      setRedeemRequests(redeemData.requests);
      setRedeemTotal(redeemData.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [redeemPage, redeemFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRewardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: any = { name: rewardForm.name, description: rewardForm.description, icon: rewardForm.icon, pointCost: rewardForm.pointCost };
      if (rewardForm.stock !== undefined) body.stock = rewardForm.stock;
      if (editingReward) {
        await apiRequest(`/admin/gamification/rewards/${editingReward.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiRequest('/admin/gamification/rewards', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowRewardForm(false);
      setEditingReward(null);
      setRewardForm({ name: '', description: '', icon: '', pointCost: 100, stock: undefined });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditReward = (r: any) => {
    setEditingReward(r);
    setRewardForm({ name: r.name, description: r.description || '', icon: r.icon || '', pointCost: r.pointCost, stock: r.stock });
    setShowRewardForm(true);
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm('Hapus reward ini?')) return;
    try {
      await apiRequest(`/admin/gamification/rewards/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRedeemStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/admin/gamification/redeem/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && rewards.length === 0) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg p-3">{error}</div>}

      {/* Rewards Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Gift size={20} /> Daftar Reward</h2>
          <button
            onClick={() => { setShowRewardForm(!showRewardForm); setEditingReward(null); setRewardForm({ name: '', description: '', icon: '', pointCost: 100, stock: undefined }); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            <Plus size={16} /> Tambah Reward
          </button>
        </div>

        {showRewardForm && (
          <form onSubmit={handleRewardSubmit} className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5 space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Nama Reward</label>
                <input type="text" required value={rewardForm.name} onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white" placeholder="Voucher 50rb" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Biaya Poin</label>
                <input type="number" required min={1} value={rewardForm.pointCost} onChange={(e) => setRewardForm({ ...rewardForm, pointCost: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Deskripsi</label>
                <input type="text" value={rewardForm.description} onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white" placeholder="Deskripsi reward" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Stok (opsional)</label>
                <input type="number" min={0} value={rewardForm.stock ?? ''} onChange={(e) => setRewardForm({ ...rewardForm, stock: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white" placeholder="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-1">Icon (nama lucide)</label>
                <input type="text" value={rewardForm.icon} onChange={(e) => setRewardForm({ ...rewardForm, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white" placeholder="gift" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
                {editingReward ? 'Update' : 'Simpan'}
              </button>
              <button type="button" onClick={() => { setShowRewardForm(false); setEditingReward(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((r) => (
            <div key={r.id} className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                    <Gift size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{r.name}</h3>
                    <p className="text-xs text-slate-400 dark:text-white/30">{r.pointCost} poin</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${r.isActive ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30'}`}>
                  {r.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              {r.description && <p className="text-sm text-slate-500 dark:text-white/40 mt-3">{r.description}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 dark:text-white/30">
                {r.stock !== null && <span className="flex items-center gap-1"><Package size={12} /> Stok: {r.stock ?? '∞'}</span>}
                <span>{r._count?.redeemRequests || 0} redeem</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleEditReward(r)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit size={14} /> Edit
                </button>
                <button onClick={() => handleDeleteReward(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          ))}
          {rewards.length === 0 && !showRewardForm && (
            <div className="col-span-full bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-8 text-center text-slate-500 dark:text-white/40">
              Belum ada reward. Klik "Tambah Reward" untuk membuat.
            </div>
          )}
        </div>
      </div>

      {/* Redeem Requests Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Clock size={20} /> Permintaan Redeem</h2>
          <select
            value={redeemFilter}
            onChange={(e) => { setRedeemFilter(e.target.value); setRedeemPage(1); }}
            className="px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white"
          >
            <option value="">Semua status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 dark:text-white/30 border-b border-slate-100 dark:border-white/[0.06]">
                <th className="p-3">User</th>
                <th className="p-3">Reward</th>
                <th className="p-3">Status</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {redeemRequests.map((req) => (
                <tr key={req.id} className="border-b border-slate-50 dark:border-white/[0.03]">
                  <td className="p-3">
                    <div className="font-medium text-slate-700 dark:text-white/80">{req.user?.name}</div>
                    <div className="text-xs text-slate-400 dark:text-white/30">{req.user?.email}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-700 dark:text-white/80">{req.reward?.name}</div>
                    <div className="text-xs text-slate-400 dark:text-white/30">{req.reward?.pointCost} poin</div>
                  </td>
                  <td className="p-3"><StatusBadge status={req.status} /></td>
                  <td className="p-3 text-xs text-slate-400 dark:text-white/30">{new Date(req.createdAt).toLocaleString('id-ID')}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {req.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleRedeemStatus(req.id, 'APPROVED')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve">
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleRedeemStatus(req.id, 'REJECTED')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject">
                            <X size={16} />
                          </button>
                        </>
                      )}
                      {req.status === 'APPROVED' && (
                        <button onClick={() => handleRedeemStatus(req.id, 'FULFILLED')} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                          Fulfilled
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {redeemRequests.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 dark:text-white/30">Belum ada permintaan redeem</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {redeemTotal > 20 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500 dark:text-white/40">{redeemTotal} total, halaman {redeemPage}</span>
            <div className="flex gap-2">
              <button disabled={redeemPage <= 1} onClick={() => setRedeemPage(redeemPage - 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/10 rounded-lg disabled:opacity-50 dark:text-white/60">Sebelumnya</button>
              <button disabled={redeemPage * 20 >= redeemTotal} onClick={() => setRedeemPage(redeemPage + 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-white/10 rounded-lg disabled:opacity-50 dark:text-white/60">Berikutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ─────────────────────────────────────────

function StatBox({ label, value, color, icon: Icon }: any) {
  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-white/40">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value.toLocaleString()}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-600',
    APPROVED: 'bg-blue-50 text-blue-600',
    REJECTED: 'bg-red-50 text-red-600',
    FULFILLED: 'bg-green-50 text-green-600',
    CANCELLED: 'bg-slate-100 text-slate-400',
  };
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status] || colors.PENDING}`}>{status}</span>;
}

function Modal({ onClose, title, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-slate-400 dark:text-white/30">{label}</span>
      <span className="text-sm font-medium text-slate-700 dark:text-white/80 text-right">{value}</span>
    </div>
  );
}
