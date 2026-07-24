'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Search, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading, refetch } = useApi<any>(`/admin/users?page=${page}&limit=20${search ? `&search=${search}` : ''}`);
  const { request } = useAuthApi();

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await request(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const [editUser, setEditUser] = useState<any>(null);
  const [roleToggles, setRoleToggles] = useState<Record<string, boolean>>({});
  const [savingRole, setSavingRole] = useState(false);

  const ADDON_ROLES = ['worker', 'admin', 'super_admin', 'super_user'];

  const openEditModal = (u: any) => {
    setEditUser(u);
    const toggles: Record<string, boolean> = {};
    for (const r of ADDON_ROLES) {
      toggles[r] = (u.roles || []).includes(r);
    }
    setRoleToggles(toggles);
  };

  const closeEditModal = () => {
    setEditUser(null);
    setRoleToggles({});
  };

  const handleSaveRole = async () => {
    if (!editUser) return;
    setSavingRole(true);
    try {
      const currentRoles = editUser.roles || [];
      for (const r of ADDON_ROLES) {
        const has = currentRoles.includes(r);
        const want = roleToggles[r];
        if (want && !has) {
          await request(`/admin/users/${editUser.id}/roles`, {
            method: 'POST',
            body: JSON.stringify({ roleName: r }),
          });
        } else if (!want && has) {
          await request(`/admin/users/${editUser.id}/roles/${r}`, { method: 'DELETE' });
        }
      }
      refetch();
      closeEditModal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingRole(false);
    }
  };

  if (!isAdmin) return null;

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen User</h1>
        <p className="text-slate-500 mt-1">{total} user terdaftar</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Terdaftar</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((role: string) => (
                          <span
                            key={role}
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                              role === 'admin' ? 'bg-blue-100 text-blue-700' :
                              role === 'super_user' ? 'bg-amber-100 text-amber-700' :
                              role === 'worker' ? 'bg-teal-100 text-teal-700' :
                              'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {role.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        u.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(u)}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600"
                      >
                        <Pencil size={14} /> Edit
                      </button>
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

      {/* Edit Role Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeEditModal}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Edit Role User</h2>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Nama</p>
                <p className="font-medium text-slate-900">{editUser.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="text-slate-700">{editUser.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role Tambahan</label>
                <p className="text-xs text-slate-400 mb-3">Role <code className="bg-slate-100 px-1 rounded">user</code> selalu aktif. Centang role tambahan:</p>
                <div className="space-y-2">
                  {ADDON_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleToggles[role] || false}
                        onChange={(e) => setRoleToggles((prev) => ({ ...prev, [role]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{role.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Role saat ini: {(editUser.roles || []).join(', ') || 'user'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleStatusChange(editUser.id, editUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                  className="text-xs text-slate-500 hover:text-red-600"
                >
                  {editUser.status === 'ACTIVE' ? 'Suspend' : 'Aktivkan'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSaveRole}
                disabled={savingRole}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {savingRole ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
