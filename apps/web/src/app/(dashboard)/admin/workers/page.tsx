'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminWorkersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi<any>(`/admin/workers?page=${page}&limit=20`);
  const { request } = useAuthApi();

  const handleApprove = async (userId: string) => {
    try {
      await request(`/admin/workers/${userId}/approve`, { method: 'PATCH' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await request(`/admin/workers/${userId}/reject`, { method: 'PATCH' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!isAdmin) return null;

  const workers = data?.workers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Worker</h1>
        <p className="text-slate-500 mt-1">Verifikasi dan kelola worker</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !workers.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Briefcase size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Belum ada worker</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Rating</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{w.user?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{w.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        w.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                        w.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {w.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {w.rating ? `${w.rating.toFixed(1)} / 5` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {w.verificationStatus === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.userId)}
                              className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(w.userId)}
                              className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
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
