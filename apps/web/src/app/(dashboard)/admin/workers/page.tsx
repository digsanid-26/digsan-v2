'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Briefcase, CheckCircle, XCircle, Ban, Search, Star, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminWorkersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const queryString = `page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const { data, loading, refetch } = useApi<any>(`/admin/workers?${queryString}`);
  const { request } = useAuthApi();

  const handleStatusChange = async (workerId: string, status: string) => {
    setActionLoading(workerId);
    try {
      await request(`/admin/workers/${workerId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ providerStatus: status }),
      });
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) return null;

  const workers = data?.workers ?? [];
  const total = data?.total ?? 0;

  const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    SUSPENDED: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/50',
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manajemen Pekerja</h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Verifikasi dan kelola pekerja Digsan Kerja</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama pekerja..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      <p className="text-xs text-slate-400 dark:text-white/40">{total} pekerja</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : !workers.length ? (
        <div className="text-center py-16 rounded-xl border bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <Briefcase size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Belum ada pekerja</h3>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Pekerja</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Keahlian</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Rating</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Pekerjaan</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {workers.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-200 dark:bg-white/10 overflow-hidden">
                          {w.profilePhoto ? (
                            <img src={w.profilePhoto} alt={w.user?.name} className="w-full h-full object-cover" />
                          ) : (
                            <Briefcase size={16} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{w.user?.name || 'N/A'}</p>
                          <p className="text-xs text-slate-500 dark:text-white/40">{w.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.skills?.slice(0, 2).map((s: any) => (
                          <span key={s.id} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            {s.subCategory?.name}
                          </span>
                        ))}
                        {w.skills?.length > 2 && (
                          <span className="text-[10px] text-slate-400">+{w.skills.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[w.providerStatus] || STATUS_STYLES.PENDING}`}>
                        {w.providerStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-white/60">
                      {w.rating ? (
                        <span className="flex items-center gap-1">
                          <Star size={12} className="text-amber-500" fill="currentColor" />
                          {Number(w.rating).toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-white/60">
                      {w.totalJobs ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actionLoading === w.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                        {w.providerStatus === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(w.id, 'APPROVED')}
                              disabled={actionLoading === w.id}
                              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleStatusChange(w.id, 'REJECTED')}
                              disabled={actionLoading === w.id}
                              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        {w.providerStatus === 'APPROVED' && (
                          <button
                            onClick={() => handleStatusChange(w.id, 'SUSPENDED')}
                            disabled={actionLoading === w.id}
                            className="flex items-center gap-1 text-xs text-slate-600 dark:text-white/50 hover:underline disabled:opacity-50"
                          >
                            <Ban size={14} /> Suspend
                          </button>
                        )}
                        {w.providerStatus === 'REJECTED' && (
                          <button
                            onClick={() => handleStatusChange(w.id, 'APPROVED')}
                            disabled={actionLoading === w.id}
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                        )}
                        {w.providerStatus === 'SUSPENDED' && (
                          <button
                            onClick={() => handleStatusChange(w.id, 'APPROVED')}
                            disabled={actionLoading === w.id}
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            <CheckCircle size={14} /> Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
