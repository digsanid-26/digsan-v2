'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { TreePine, Search, ChevronLeft, ChevronRight, Link2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminTreesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hasSlug, setHasSlug] = useState('');
  const { data, loading } = useApi<any>(`/admin/trees?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}${hasSlug ? `&hasSlug=${hasSlug}` : ''}`);

  if (!isAdmin) return null;

  const trees = data?.trees ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.digsan.id';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Family Trees</h1>
        <p className="text-slate-500 mt-1">{total} tree terdaftar</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama tree, slug, atau email owner..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <select
          value={hasSlug}
          onChange={(e) => { setHasSlug(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua</option>
          <option value="yes">Punya Slug</option>
          <option value="no">Belum Ada Slug</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : trees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <TreePine size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Belum ada family tree</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tree</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Owner</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Members</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trees.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.name || '(tanpa nama)'}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{t.owner?.name || '-'}</div>
                      <div className="text-xs text-slate-400">{t.owner?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {t.slug ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 size={14} className="text-emerald-500" />
                          <span className="font-mono text-emerald-600">{t.slug}</span>
                          <a
                            href={`${origin}/family/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">belum dibuat</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.owner?.username ? (
                        <span className="font-mono text-emerald-600">{t.owner.username}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">belum ada</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{t.memberCount}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
