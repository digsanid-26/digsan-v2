'use client';

import { useParams } from 'next/navigation';
import { useApi, useAuthApi } from '@/lib/hooks';
import { TreePine, UserPlus, ArrowLeft, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function TreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tree, loading, refetch } = useApi<any>(`/trees/${id}`);
  const { data: members, refetch: refetchMembers } = useApi<any>(`/trees/${id}/members`);
  const { request } = useAuthApi();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', gender: 'MALE', birthDate: '' });
  const [adding, setAdding] = useState(false);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await request(`/trees/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          birthDate: form.birthDate || undefined,
        }),
      });
      setForm({ firstName: '', lastName: '', gender: 'MALE', birthDate: '' });
      setShowAdd(false);
      refetchMembers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Hapus anggota ini?')) return;
    try {
      await request(`/trees/${id}/members/${memberId}`, { method: 'DELETE' });
      refetchMembers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Pohon keluarga tidak ditemukan</p>
        <Link href="/tree" className="text-blue-600 hover:underline mt-2 inline-block">
          Kembali
        </Link>
      </div>
    );
  }

  const memberList = Array.isArray(members) ? members : members?.members ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tree" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{tree.name}</h1>
          {tree.description && <p className="text-slate-500 mt-1">{tree.description}</p>}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <UserPlus size={16} />
          Tambah Anggota
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <form onSubmit={handleAddMember} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Tambah Anggota</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Depan</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Belakang</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="MALE">Laki-laki</option>
                <option value="FEMALE">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lahir</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {adding ? 'Menambahkan...' : 'Tambah'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Members */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Users size={20} />
          Anggota ({memberList.length})
        </h2>
        {!memberList.length ? (
          <p className="text-slate-500 text-sm py-4 text-center">Belum ada anggota</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {memberList.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                    m.gender === 'MALE' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                  }`}>
                    {(m.firstName || '?')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {m.firstName} {m.lastName || ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'}
                      {m.birthDate && ` · ${new Date(m.birthDate).toLocaleDateString('id-ID')}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteMember(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
