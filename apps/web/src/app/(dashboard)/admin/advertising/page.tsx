'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { getTokens } from '@/lib/auth';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit,
  Image as ImageIcon,
  Wand2,
  LayoutGrid,
  DollarSign,
  Eye,
  X,
  Check,
  Calendar,
  Link2,
  Loader2,
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

// ─── Types ──────────────────────────────────────────────────

interface AdSpot {
  id: string;
  key: string;
  label: string;
  description?: string;
  page: string;
  position: string;
  aspectRatio: string;
  maxSlots: number;
  isActive: boolean;
  assignments?: any[];
}

interface AdBanner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  aspectRatio: string;
  isAiGenerated: boolean;
  aiPrompt?: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

interface AdAssignment {
  id: string;
  spotId: string;
  bannerId: string;
  startDate: string;
  endDate?: string;
  rate?: number;
  discountRole?: string;
  isActive: boolean;
  spot?: AdSpot;
  banner?: AdBanner;
}

interface Stats {
  totals: {
    spots: number;
    banners: number;
    assignments: number;
    activeAssignments: number;
    totalRevenue: number;
  };
  spots: any[];
}

// ─── Main Page ──────────────────────────────────────────────

export default function AdminAdvertisingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const [tab, setTab] = useState<'dashboard' | 'builder' | 'manager'>('dashboard');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  if (!isAdmin) return null;

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
    { id: 'builder' as const, label: 'Ads Builder', icon: Wand2 },
    { id: 'manager' as const, label: 'Ads Manager', icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Advertising</h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Kelola spot iklan, banner, dan assignment</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'builder' && <BuilderTab />}
      {tab === 'manager' && <ManagerTab />}
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [spots, setSpots] = useState<AdSpot[]>([]);
  const [showSpotForm, setShowSpotForm] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest('/admin/ads/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpots = useCallback(async () => {
    try {
      const data = await apiRequest('/admin/ads/spots');
      setSpots(data);
    } catch (err) {
      console.error('Failed to load spots:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadSpots();
  }, [loadStats, loadSpots]);

  if (loading) return <div className="text-slate-500 dark:text-white/50 text-sm">Loading...</div>;

  const statCards = [
    { label: 'Total Spot', value: stats?.totals.spots ?? 0, icon: LayoutGrid, color: 'text-blue-500' },
    { label: 'Total Banner', value: stats?.totals.banners ?? 0, icon: ImageIcon, color: 'text-emerald-500' },
    { label: 'Active Assignments', value: stats?.totals.activeAssignments ?? 0, icon: Check, color: 'text-amber-500' },
    { label: 'Total Revenue', value: `Rp ${(stats?.totals.totalRevenue ?? 0).toLocaleString('id-ID')}`, icon: DollarSign, color: 'text-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={18} className={s.color} />
              <span className="text-xs text-slate-500 dark:text-white/50">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Spots list */}
      <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="font-semibold text-slate-900 dark:text-white">Ad Spots</h2>
          <button
            onClick={() => setShowSpotForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus size={14} /> Tambah Spot
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {spots.length === 0 ? (
            <p className="p-4 text-sm text-slate-400 dark:text-white/40">Belum ada spot. Buat spot pertama Anda.</p>
          ) : (
            spots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">{spot.key}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${spot.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/40'}`}>
                      {spot.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                    {spot.label} — {spot.page} / {spot.position} — {spot.aspectRatio}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-white/40">{spot.assignments?.length || 0} banner</span>
                  <button
                    onClick={() => { if (confirm('Hapus spot ini?')) { apiRequest(`/admin/ads/spots/${spot.id}`, { method: 'DELETE' }).then(() => loadSpots()); } }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showSpotForm && (
        <SpotFormModal
          onClose={() => setShowSpotForm(false)}
          onSaved={() => { setShowSpotForm(false); loadSpots(); }}
        />
      )}
    </div>
  );
}

// ─── Spot Form Modal ────────────────────────────────────────

function SpotFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ key: '', label: '', description: '', page: 'dashboard', position: 'default', aspectRatio: '1:1', maxSlots: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/admin/ads/spots', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tambah Ad Spot</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Key (unique)</label>
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="mis. dash-in" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Label</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="mis. Dashboard Info Banner" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Page</label>
              <input value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Position</label>
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Aspect Ratio</label>
              <select value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })} className={inputCls}>
                <option value="1:1">1:1</option>
                <option value="3:1">3:1</option>
                <option value="1:2">1:2</option>
                <option value="1:3">1:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Max Slots</label>
              <input type="number" min={1} value={form.maxSlots} onChange={(e) => setForm({ ...form, maxSlots: parseInt(e.target.value) || 1 })} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ads Builder Tab ────────────────────────────────────────

function BuilderTab() {
  const [prompt, setPrompt] = useState('');
  const [includeText, setIncludeText] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [fontFamily, setFontFamily] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [error, setError] = useState('');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerLink, setBannerLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError('');
    setResult(null);
    setSavedMsg('');
    try {
      const data = await apiRequest('/admin/ads/ai-generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, includeText, textContent, fontFamily, colorScheme, aspectRatio, style }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Gagal generate gambar');
    }
    setGenerating(false);
  };

  const handleSaveBanner = async () => {
    if (!result) return;
    setSaving(true);
    setSavedMsg('');
    try {
      await apiRequest('/admin/ads/banners', {
        method: 'POST',
        body: JSON.stringify({
          title: bannerTitle || 'AI Generated Banner',
          imageUrl: result.imageUrl,
          linkUrl: bannerLink || undefined,
          aspectRatio,
          isAiGenerated: true,
          aiPrompt: result.prompt,
        }),
      });
      setSavedMsg('Banner berhasil disimpan!');
      setBannerTitle('');
      setBannerLink('');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan banner');
    }
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — Controls */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-purple-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">AI Image Generator</h2>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Prompt Deskripsi</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="mis. Banner promosi reuni keluarga dengan latar hijau tropis"
              rows={3}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Aspect Ratio</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={inputCls}>
                <option value="1:1">1:1 (Square)</option>
                <option value="3:1">3:1 (Wide Banner)</option>
                <option value="1:2">1:2 (Tall)</option>
                <option value="1:3">1:3 (Very Tall)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Style</label>
              <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="mis. minimalis, flat" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncludeText(!includeText)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${includeText ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/60'}`}
            >
              {includeText ? <Check size={14} /> : <Plus size={14} />}
              Sertakan Teks
            </button>
          </div>

          {includeText && (
            <div className="space-y-3 pl-3 border-l-2 border-blue-200 dark:border-blue-500/30">
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Teks pada Banner</label>
                <input value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="mis. Reuni Keluarga Besar 2026" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Font</label>
                  <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className={inputCls}>
                    <option value="">Default</option>
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="handwriting">Handwriting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Color Scheme</label>
                  <input value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} placeholder="mis. green & gold" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Wand2 size={16} /> Generate Image</>}
          </button>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        {/* Save as banner */}
        {result && (
          <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10 p-5 space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Simpan sebagai Banner</h3>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Judul Banner</label>
              <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="mis. Banner Reuni 2026" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Link URL (opsional)</label>
              <input value={bannerLink} onChange={(e) => setBannerLink(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
            <button
              onClick={handleSaveBanner}
              disabled={saving}
              className="w-full py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Menyimpan...' : <><Check size={14} /> Simpan Banner</>}
            </button>
            {savedMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{savedMsg}</p>}
          </div>
        )}
      </div>

      {/* Right — Preview */}
      <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10 p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Preview</h2>
        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
              <img src={result.imageUrl} alt="Generated banner" className="w-full" />
            </div>
            <p className="text-xs text-slate-400 dark:text-white/40">Prompt: {result.prompt}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-300 dark:text-white/20">
            <ImageIcon size={48} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ads Manager Tab ────────────────────────────────────────

function ManagerTab() {
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [spots, setSpots] = useState<AdSpot[]>([]);
  const [assignments, setAssignments] = useState<AdAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showBannerForm, setShowBannerForm] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [b, s, a] = await Promise.all([
        apiRequest('/admin/ads/banners'),
        apiRequest('/admin/ads/spots'),
        apiRequest('/admin/ads/assignments'),
      ]);
      setBanners(b);
      setSpots(s);
      setAssignments(a);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <div className="text-slate-500 dark:text-white/50 text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Banners section */}
      <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="font-semibold text-slate-900 dark:text-white">Banner Library</h2>
          <button onClick={() => setShowBannerForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500">
            <Plus size={14} /> Tambah Banner
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {banners.length === 0 ? (
            <p className="col-span-full text-sm text-slate-400 dark:text-white/40">Belum ada banner.</p>
          ) : (
            banners.map((b) => (
              <div key={b.id} className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden group relative">
                <img src={b.imageUrl} alt={b.title} className="w-full h-32 object-cover" />
                <div className="p-2">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{b.title}</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/40">{b.aspectRatio} {b.isAiGenerated && '· AI'}</p>
                </div>
                <button
                  onClick={() => { if (confirm('Hapus banner?')) { apiRequest(`/admin/ads/banners/${b.id}`, { method: 'DELETE' }).then(() => loadAll()); } }}
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignments section */}
      <div className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="font-semibold text-slate-900 dark:text-white">Spot Assignments</h2>
          <button onClick={() => setShowAssignForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500" disabled={banners.length === 0 || spots.length === 0}>
            <Plus size={14} /> Assign Banner
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {assignments.length === 0 ? (
            <p className="p-4 text-sm text-slate-400 dark:text-white/40">Belum ada assignment.</p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {a.banner && <img src={a.banner.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{a.banner?.title || 'Unknown'}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">
                      {a.spot?.label || a.spotId} — {a.spot?.key}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/40'}`}>
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {a.endDate && (
                        <span className="text-[10px] text-slate-400 dark:text-white/40 flex items-center gap-0.5">
                          <Calendar size={10} /> until {new Date(a.endDate).toLocaleDateString('id-ID')}
                        </span>
                      )}
                      {a.rate && (
                        <span className="text-[10px] text-slate-400 dark:text-white/40 flex items-center gap-0.5">
                          <DollarSign size={10} /> Rp {Number(a.rate).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { apiRequest(`/admin/ads/assignments/${a.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !a.isActive }) }).then(() => loadAll()); }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${a.isActive ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}
                  >
                    {a.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => { if (confirm('Hapus assignment?')) { apiRequest(`/admin/ads/assignments/${a.id}`, { method: 'DELETE' }).then(() => loadAll()); } }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAssignForm && (
        <AssignFormModal
          spots={spots}
          banners={banners}
          onClose={() => setShowAssignForm(false)}
          onSaved={() => { setShowAssignForm(false); loadAll(); }}
        />
      )}

      {showBannerForm && (
        <BannerFormModal
          onClose={() => setShowBannerForm(false)}
          onSaved={() => { setShowBannerForm(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ─── Assign Form Modal ──────────────────────────────────────

function AssignFormModal({ spots, banners, onClose, onSaved }: { spots: AdSpot[]; banners: AdBanner[]; onClose: () => void; onSaved: () => void }) {
  const [spotId, setSpotId] = useState(spots[0]?.id || '');
  const [bannerId, setBannerId] = useState(banners[0]?.id || '');
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState('');
  const [discountRole, setDiscountRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/admin/ads/assignments', {
        method: 'POST',
        body: JSON.stringify({
          spotId,
          bannerId,
          endDate: endDate || undefined,
          rate: rate ? parseFloat(rate) : undefined,
          discountRole: discountRole || undefined,
        }),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Assign Banner ke Spot</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Spot</label>
            <select value={spotId} onChange={(e) => setSpotId(e.target.value)} className={inputCls}>
              {spots.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.key})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Banner</label>
            <select value={bannerId} onChange={(e) => setBannerId(e.target.value)} className={inputCls}>
              {banners.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">End Date (opsional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Rate (Rp)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Discount Role (opsional)</label>
            <input value={discountRole} onChange={(e) => setDiscountRole(e.target.value)} placeholder="mis. member" className={inputCls} />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Banner Form Modal (manual upload) ──────────────────────

function BannerFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  const handleSave = async () => {
    if (!title || !imageUrl) { setError('Judul dan URL gambar wajib diisi'); return; }
    setSaving(true);
    setError('');
    try {
      await apiRequest('/admin/ads/banners', {
        method: 'POST',
        body: JSON.stringify({ title, imageUrl, linkUrl: linkUrl || undefined, aspectRatio }),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tambah Banner (Manual)</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Judul</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Banner Promosi" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Image URL</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Link URL (opsional)</label>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Aspect Ratio</label>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={inputCls}>
              <option value="1:1">1:1</option>
              <option value="3:1">3:1</option>
              <option value="1:2">1:2</option>
              <option value="1:3">1:3</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
