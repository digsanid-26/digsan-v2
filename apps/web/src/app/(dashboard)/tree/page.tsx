'use client';

import { useState } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { TreePine, Plus, Users, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function TreeListPage() {
  const { data: trees, loading, refetch } = useApi<any[]>('/trees');
  const { request } = useAuthApi();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await request('/trees', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      setName('');
      setDescription('');
      setShowCreate(false);
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pohon keluarga ini?')) return;
    try {
      await request(`/trees/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pohon Keluarga</h1>
          <p className="text-slate-500 mt-1">Kelola silsilah keluarga Anda</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Buat Baru
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Buat Pohon Keluarga Baru</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Keluarga Budi"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {creating ? 'Membuat...' : 'Buat'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Tree list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !trees?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <TreePine size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Belum ada pohon keluarga</h3>
          <p className="text-slate-500 mt-1">Buat pohon keluarga pertama Anda</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trees.map((tree: any) => (
            <div key={tree.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TreePine size={20} className="text-emerald-600" />
                </div>
                <button
                  onClick={() => handleDelete(tree.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="font-semibold text-slate-900">{tree.name}</h3>
              {tree.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{tree.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {tree._count?.members ?? tree.members?.length ?? 0} anggota
                </span>
              </div>
              <Link
                href={`/tree/${tree.id}`}
                className="flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Eye size={14} />
                Lihat Detail
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
