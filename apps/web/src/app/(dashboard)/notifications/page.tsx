'use client';

import { useApi, useAuthApi } from '@/lib/hooks';
import { Bell, CheckCheck, Trash2, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function NotificationsPage() {
  const { data, loading, refetch } = useApi<any>('/notifications?limit=50');
  const { request } = useAuthApi();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifikasi</h1>
          <p className="text-slate-500 mt-1">
            {data?.total ?? 0} notifikasi total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/notifications/settings"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
          >
            <Settings size={16} />
            Pengaturan
          </a>
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              <CheckCheck size={16} />
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !notifications.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Bell size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Tidak ada notifikasi</h3>
          <p className="text-slate-500 mt-1">Anda akan mendapat notifikasi di sini</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 ${!n.isRead ? 'bg-blue-50/50' : ''}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                !n.isRead ? 'bg-blue-100' : 'bg-slate-100'
              }`}>
                <Bell size={16} className={!n.isRead ? 'text-blue-600' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: localeId,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                        title="Tandai dibaca"
                      >
                        <CheckCheck size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
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
