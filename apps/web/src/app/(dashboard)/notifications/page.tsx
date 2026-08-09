'use client';

import { useApi, useAuthApi } from '@/lib/hooks';
import { treeApi } from '@/lib/tree';
import { Bell, CheckCheck, Trash2, Settings, UserPlus, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useState } from 'react';

export default function NotificationsPage() {
  const { data, loading, refetch } = useApi<any>('/notifications?limit=50');
  const { request } = useAuthApi();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleMarkRead = async (id: string) => {
    try {
      await request(`/notifications/${id}/read`, { method: 'PUT' });
      refetch();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await request('/notifications/read-all', { method: 'PUT' });
      refetch();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await request(`/notifications/${id}`, { method: 'DELETE' });
      refetch();
    } catch {}
  };

  const notifications = data?.notifications ?? [];

  const handleAcceptConnection = async (token: string, notifId: string) => {
    setActionLoading(notifId);
    try {
      await treeApi.acceptInvitation(token);
      await request(`/notifications/${notifId}/read`, { method: 'PUT' });
      refetch();
    } catch (e: any) {
      alert(e.message || 'Gagal menerima koneksi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConnection = async (notifId: string) => {
    setActionLoading(notifId);
    try {
      await request(`/notifications/${notifId}/read`, { method: 'PUT' });
      refetch();
    } catch {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifikasi</h1>
          <p className="text-slate-500 dark:text-white/50 mt-1">
            {data?.total ?? 0} notifikasi total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/notifications/settings"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/5 rounded-lg transition-colors font-medium"
          >
            <Settings size={16} />
            Pengaturan
          </a>
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 rounded-lg transition-colors font-medium"
            >
              <CheckCheck size={16} />
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      ) : !notifications.length ? (
        <div className="text-center py-16 bg-white dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/10">
          <Bell size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Tidak ada notifikasi</h3>
          <p className="text-slate-500 dark:text-white/50 mt-1">Anda akan mendapat notifikasi di sini</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 ${!n.isRead ? 'bg-blue-50/50 dark:bg-blue-500/[0.08]' : ''}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                !n.isRead ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-white/5'
              }`}>
                <Bell size={16} className={!n.isRead ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-white/30'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {n.type === 'TREE_INVITATION' && (
                        <UserPlus size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
                      )}
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-white/60 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 dark:text-white/30 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: localeId,
                      })}
                    </p>
                    {/* Accept/Reject buttons for connection request notifications */}
                    {n.type === 'TREE_INVITATION' && n.data?.token && !n.isRead && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleAcceptConnection(n.data.token, n.id)}
                          disabled={actionLoading === n.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === n.id ? 'Memproses...' : (<><Check size={13} /> Terima</>)}
                        </button>
                        <button
                          onClick={() => handleRejectConnection(n.id)}
                          disabled={actionLoading === n.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X size={13} /> Tolak
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 text-slate-400 dark:text-white/30 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        title="Tandai dibaca"
                      >
                        <CheckCheck size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="p-1.5 text-slate-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
