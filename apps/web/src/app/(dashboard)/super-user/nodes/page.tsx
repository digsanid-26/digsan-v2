'use client';

import { useState, useEffect } from 'react';
import { Network, Mail, Phone, Crown, Loader2, Users, Trees, Search } from 'lucide-react';
import { useAuthApi } from '@/lib/hooks';
import { getUser } from '@/lib/auth';

interface TreeNode {
  id: string;
  name: string;
  slug: string | null;
  memberCount: number;
  activeCount: number;
}

interface MemberNode {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  familyRole: string | null;
  isCreator: boolean;
  accountStatus: string;
  treeName: string;
  treeSlug: string | null;
  hasAccount: boolean;
  lastLoginAt: string | null;
}

interface NodesResponse {
  trees: TreeNode[];
  members: MemberNode[];
}

export default function SuperUserNodesPage() {
  const { request } = useAuthApi();
  const [data, setData] = useState<NodesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTree, setFilterTree] = useState('all');

  useEffect(() => {
    const user = getUser();
    if (!user?.roles?.includes('super_user')) {
      setError('Akses ditolak. Halaman ini hanya untuk super_user.');
      setLoading(false);
      return;
    }
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const res = await request<NodesResponse>('/trees/super-user/nodes');
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = data?.members.filter((m) => {
    const matchSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchTree = filterTree === 'all' || m.treeName === filterTree;
    return matchSearch && matchTree;
  }) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
          <Network size={24} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daftar Node Super User</h1>
          <p className="text-sm text-slate-500 dark:text-white/50">Semua anggota dari pohon keluarga yang Anda buat</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Trees size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Total Pohon</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.trees.length ?? 0}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-blue-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Total Node</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.members.length ?? 0}</p>
        </div>
        <div className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={16} className="text-amber-500" />
            <span className="text-xs text-slate-500 dark:text-white/50">Akun Aktif</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {data?.members.filter((m) => m.hasAccount).length ?? 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterTree}
          onChange={(e) => setFilterTree(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Semua Pohon</option>
          {data?.trees.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Pohon</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Kontak</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Role</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Login Terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 dark:text-white/40">
                  Tidak ada node ditemukan
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{m.name}</span>
                      {m.isCreator && (
                        <Crown size={12} className="text-amber-500" />
                      )}
                    </div>
                    {m.familyRole && (
                      <span className="text-xs text-slate-400 dark:text-white/40">{m.familyRole}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.treeSlug ? (
                      <a href={`/family/${m.treeSlug}`} className="text-blue-500 hover:underline">{m.treeName}</a>
                    ) : (
                      <span className="text-slate-600 dark:text-white/60">{m.treeName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.email ? (
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-white/60">
                        <Mail size={12} /> {m.email}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-white/30">-</span>
                    )}
                    {m.phone && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-white/60 mt-0.5">
                        <Phone size={12} /> {m.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 dark:text-white/60">
                      {m.gender === 'male' ? 'Laki-laki' : m.gender === 'female' ? 'Perempuan' : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.hasAccount ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        {m.accountStatus}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50">
                        Belum ada akun
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-white/50">
                    {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
