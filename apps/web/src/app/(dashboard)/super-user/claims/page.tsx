'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2, Check, X, Mail, Phone, Clock, User as UserIcon, Trees } from 'lucide-react';
import { useAuthApi } from '@/lib/hooks';
import { getUser } from '@/lib/auth';
import type { NodeClaimItem } from '@/lib/tree';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const ROLE_LABELS: Record<string, string> = {
  self: 'Diri Sendiri', spouse: 'Pasangan', parent: 'Orang Tua',
  grandparent: 'Kakek/Nenek', ancestor: 'Leluhur', kakak: 'Kakak',
  adik: 'Adik', child: 'Anak', uncle: 'Paman/Bibi',
};

export default function SuperUserClaimsPage() {
  const { request } = useAuthApi();
  const [claims, setClaims] = useState<NodeClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [acting, setActing] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<NodeClaimItem[]>('/trees/super-user/claims');
      setClaims(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const user = getUser();
    if (!user?.roles?.includes('super_user')) {
      setError('Akses ditolak. Halaman ini hanya untuk super_user.');
      setLoading(false);
      return;
    }
    loadClaims();
  }, [loadClaims]);

  const handleRespond = async (claimId: string, approve: boolean) => {
    setActing(claimId);
    try {
      await request(`/trees/super-user/claims/${claimId}`, {
        method: 'PATCH',
        body: JSON.stringify({ approve }),
      });
      await loadClaims();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  };

  const filtered = claims.filter((c) => filter === 'all' || c.status.toLowerCase() === filter);
  const pendingCount = claims.filter((c) => c.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <ClipboardCheck size={24} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Klaim Node</h1>
          <p className="text-sm text-slate-500 dark:text-white/50">
            Tinjau dan setujui klaim atas node keluarga Anda
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck size={16} className="text-amber-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Total Klaim</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{claims.length}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-orange-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Menunggu</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingCount}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Check size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Disetujui</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {claims.filter((c) => c.status === 'APPROVED').length}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-white/60 dark:border-white/10 dark:hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'Semua' : STATUS_LABELS[f.toUpperCase()]}
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-slate-200 dark:border-white/10">
          <ClipboardCheck size={40} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-slate-400 dark:text-white/40">Tidak ada klaim ditemukan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <div
              key={claim.id}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Claimant info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {claim.claimant?.avatar ? (
                    <img
                      src={claim.claimant.avatar}
                      alt={claim.claimant.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon size={18} className="text-slate-400 dark:text-white/40" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {claim.claimant?.name ?? 'Unknown'}
                    </p>
                    {claim.claimant?.email && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-white/50">
                        <Mail size={11} /> {claim.claimant.email}
                      </div>
                    )}
                    {claim.claimant?.phone && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-white/50">
                        <Phone size={11} /> {claim.claimant.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Node info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {claim.nodeName}
                    </span>
                    {claim.nodeRole && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60">
                        {ROLE_LABELS[claim.nodeRole] ?? claim.nodeRole}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50 mt-0.5">
                    <Trees size={11} />
                    {claim.treeSlug ? (
                      <a href={`/family/${claim.treeSlug}`} className="hover:underline text-blue-500">
                        {claim.treeName}
                      </a>
                    ) : (
                      <span>{claim.treeName}</span>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[claim.status]}`}>
                    {STATUS_LABELS[claim.status]}
                  </span>
                  {claim.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(claim.id, true)}
                        disabled={acting === claim.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {acting === claim.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Setujui
                      </button>
                      <button
                        onClick={() => handleRespond(claim.id, false)}
                        disabled={acting === claim.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        <X size={14} />
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-white/40">
                Diklaim pada {new Date(claim.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {claim.respondedAt && (
                  <span className="ml-2">
                    · Ditanggapi {new Date(claim.respondedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
