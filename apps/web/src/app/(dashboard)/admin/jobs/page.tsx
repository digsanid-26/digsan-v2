'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import {
  Plus, Pencil, Trash2, X, Loader2, Search, ChevronDown, ChevronRight,
  FolderTree, Layers, Package, Save,
} from 'lucide-react';

type Tab = 'categories' | 'subcategories' | 'services';

export default function AdminJobsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [tab, setTab] = useState<Tab>('categories');
  const { request } = useAuthApi();

  if (!isAdmin) return null;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manajemen Katalog Kerja</h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Kelola kategori, sub-kategori, dan layanan Digsan Kerja</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={FolderTree} label="Kategori" />
        <TabButton active={tab === 'subcategories'} onClick={() => setTab('subcategories')} icon={Layers} label="Sub-Kategori" />
        <TabButton active={tab === 'services'} onClick={() => setTab('services')} icon={Package} label="Layanan" />
      </div>

      {tab === 'categories' && <CategoriesManager request={request} />}
      {tab === 'subcategories' && <SubCategoriesManager request={request} />}
      {tab === 'services' && <ServicesManager request={request} />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

// ─── CATEGORIES ─────────────────────────────────────────────

function CategoriesManager({ request }: any) {
  const { data, loading, refetch } = useApi<any>('/admin/jobs/categories');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = (data || []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await request(`/admin/jobs/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await request('/admin/jobs/categories', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setEditing(null);
      setCreating(false);
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus kategori "${name}"? Sub-kategori harus dihapus terlebih dahulu.`)) return;
    try {
      await request(`/admin/jobs/categories/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kategori..."
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderTree} text="Belum ada kategori" />
      ) : (
        <div className="space-y-2">
          {filtered.map((cat: any) => (
            <div key={cat.id} className="rounded-xl border bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {cat.subCategories?.length > 0 && (
                    <button onClick={() => toggleExpand(cat.id)} className="text-slate-400 hover:text-slate-600">
                      {expanded.has(cat.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{cat.name}</p>
                    <p className="text-xs text-slate-400 dark:text-white/40">/{cat.slug} · {cat.subCategories?.length || 0} sub-kategori</p>
                  </div>
                  {cat.isActive === false && (
                    <span className="text-xs text-red-500">Nonaktif</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditing(cat); setCreating(false); }} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expanded.has(cat.id) && cat.subCategories?.length > 0 && (
                <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] p-3 space-y-1">
                  {cat.subCategories.map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between py-1.5 px-3 text-sm">
                      <span className="text-slate-700 dark:text-white/70">{sub.name}</span>
                      <span className="text-xs text-slate-400">{sub._count?.services || 0} layanan</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, saving, onSave, onClose }: any) {
  const [name, setName] = useState(category?.name || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [description, setDescription] = useState(category?.description || '');
  const [icon, setIcon] = useState(category?.icon || '');
  const [order, setOrder] = useState(category?.order ?? 0);
  const [isActive, setIsActive] = useState(category?.isActive !== false);

  return (
    <Modal title={category ? 'Edit Kategori' : 'Tambah Kategori'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="contoh: kebersihan-rumah" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </Field>
        <Field label="Icon (opsional)">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass} placeholder="home, wrench, scissors..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urutan">
            <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-600 dark:text-white/60">Aktif</span>
            </label>
          </Field>
        </div>
      </div>
      <ModalActions saving={saving} onSave={() => onSave({ name, slug, description, icon, order, isActive })} onClose={onClose} />
    </Modal>
  );
}

// ─── SUB-CATEGORIES ─────────────────────────────────────────

function SubCategoriesManager({ request }: any) {
  const { data: categoriesData } = useApi<any>('/admin/jobs/categories');
  const categories = categoriesData || [];

  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const queryString = `/admin/jobs/sub-categories${categoryFilter ? `?categoryId=${categoryFilter}` : ''}`;
  const { data, loading, refetch } = useApi<any>(queryString);

  const filtered = (data || []).filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editing?.id) {
        const { categoryId, ...update } = formData;
        await request(`/admin/jobs/sub-categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(update),
        });
      } else {
        await request('/admin/jobs/sub-categories', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setEditing(null);
      setCreating(false);
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus sub-kategori "${name}"? Layanan harus dihapus terlebih dahulu.`)) return;
    try {
      await request(`/admin/jobs/sub-categories/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari sub-kategori..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Tambah Sub-Kategori
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Layers} text="Belum ada sub-kategori" />
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Kategori</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Layanan</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((sub: any) => (
                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{sub.name}</p>
                    <p className="text-xs text-slate-400 dark:text-white/40">/{sub.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/60">{sub.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/60">{sub._count?.services || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(sub); setCreating(false); }} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(sub.id, sub.name)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SubCategoryModal
          subCategory={editing}
          categories={categories}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function SubCategoryModal({ subCategory, categories, saving, onSave, onClose }: any) {
  const [categoryId, setCategoryId] = useState(subCategory?.categoryId || '');
  const [name, setName] = useState(subCategory?.name || '');
  const [slug, setSlug] = useState(subCategory?.slug || '');
  const [description, setDescription] = useState(subCategory?.description || '');
  const [icon, setIcon] = useState(subCategory?.icon || '');
  const [order, setOrder] = useState(subCategory?.order ?? 0);
  const [isActive, setIsActive] = useState(subCategory?.isActive !== false);

  return (
    <Modal title={subCategory ? 'Edit Sub-Kategori' : 'Tambah Sub-Kategori'} onClose={onClose}>
      <div className="space-y-3">
        {!subCategory && (
          <Field label="Kategori">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Pilih kategori...</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="contoh: cuci-ac" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </Field>
        <Field label="Icon (opsional)">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urutan">
            <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-600 dark:text-white/60">Aktif</span>
            </label>
          </Field>
        </div>
      </div>
      <ModalActions saving={saving} onSave={() => onSave({ categoryId, name, slug, description, icon, order, isActive })} onClose={onClose} />
    </Modal>
  );
}

// ─── SERVICES ───────────────────────────────────────────────

function ServicesManager({ request }: any) {
  const { data: subCatsData } = useApi<any>('/admin/jobs/sub-categories');
  const subCats = subCatsData || [];

  const [subFilter, setSubFilter] = useState('');
  const [search, setSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  let queryString = '/admin/jobs/services';
  const params: string[] = [];
  if (subFilter) params.push(`subCategoryId=${subFilter}`);
  if (featuredOnly) params.push(`featured=true`);
  if (params.length) queryString += '?' + params.join('&');
  const { data, loading, refetch } = useApi<any>(queryString);

  const filtered = (data || []).filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editing?.id) {
        const { subCategoryId, ...update } = formData;
        await request(`/admin/jobs/services/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(update),
        });
      } else {
        await request('/admin/jobs/services', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setEditing(null);
      setCreating(false);
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus layanan "${name}"?`)) return;
    try {
      await request(`/admin/jobs/services/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
            />
          </div>
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          >
            <option value="">Semua Sub-Kategori</option>
            {subCats.map((s: any) => (
              <option key={s.id} value={s.id}>{s.category?.name} › {s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/60">
            <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} className="rounded" />
            Featured
          </label>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Tambah Layanan
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} text="Belum ada layanan" />
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Layanan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Kategori</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60">Harga</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((svc: any) => (
                <tr key={svc.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{svc.name}</p>
                    <p className="text-xs text-slate-400 dark:text-white/40">/{svc.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-white/60">
                    {svc.subCategory?.category?.name} › {svc.subCategory?.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-blue-600 dark:text-blue-400">Rp {Number(svc.basePrice).toLocaleString('id-ID')}</p>
                    <p className="text-xs text-slate-400">{svc.priceUnit}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {svc.isFeatured && (
                        <span className="inline-flex w-fit px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Featured</span>
                      )}
                      {svc.isActive === false && (
                        <span className="inline-flex w-fit px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">Nonaktif</span>
                      )}
                      {svc.isActive !== false && !svc.isFeatured && (
                        <span className="text-xs text-slate-400">Aktif</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(svc); setCreating(false); }} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(svc.id, svc.name)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ServiceModal
          service={editing}
          subCategories={subCats}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ServiceModal({ service, subCategories, saving, onSave, onClose }: any) {
  const [subCategoryId, setSubCategoryId] = useState(service?.subCategoryId || '');
  const [name, setName] = useState(service?.name || '');
  const [slug, setSlug] = useState(service?.slug || '');
  const [description, setDescription] = useState(service?.description || '');
  const [basePrice, setBasePrice] = useState(service?.basePrice ?? 0);
  const [priceUnit, setPriceUnit] = useState(service?.priceUnit || 'per jam');
  const [duration, setDuration] = useState(service?.duration ?? 0);
  const [order, setOrder] = useState(service?.order ?? 0);
  const [isFeatured, setIsFeatured] = useState(service?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(service?.isActive !== false);

  return (
    <Modal title={service ? 'Edit Layanan' : 'Tambah Layanan'} onClose={onClose}>
      <div className="space-y-3">
        {!service && (
          <Field label="Sub-Kategori">
            <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} className={inputClass}>
              <option value="">Pilih sub-kategori...</option>
              {subCategories.map((s: any) => (
                <option key={s.id} value={s.id}>{s.category?.name} › {s.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nama Layanan">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="contoh: cuci-ac-1pk" />
        </Field>
        <Field label="Deskripsi">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga Dasar">
            <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Satuan Harga">
            <input value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={inputClass} placeholder="per jam, per unit..." />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durasi (jam)">
            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Urutan">
            <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-600 dark:text-white/60">Featured</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-600 dark:text-white/60">Aktif</span>
          </label>
        </div>
      </div>
      <ModalActions saving={saving} onSave={() => onSave({ subCategoryId, name, slug, description, basePrice, priceUnit, duration, order, isFeatured, isActive })} onClose={onClose} />
    </Modal>
  );
}

// ─── SHARED COMPONENTS ──────────────────────────────────────

const inputClass = "w-full px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white";

function Field({ label, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-white/40 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 bg-white border-slate-200 dark:bg-[#1a1a1a] dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ saving, onSave, onClose }: any) {
  return (
    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10">
        Batal
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Simpan
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="rounded-xl border p-12 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
      <Icon size={40} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
      <p className="text-sm text-slate-400 dark:text-white/40">{text}</p>
    </div>
  );
}
