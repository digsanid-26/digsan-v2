'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/lib/hooks';
import { LayoutDashboard, TreePine, MessageSquare, Trophy, Bell } from 'lucide-react';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, href, color }: any) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value ?? '—'}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: trees } = useApi('/trees');
  const { data: rooms } = useApi('/chat/rooms');
  const { data: points } = useApi('/gamification/points/balance');
  const { data: notifs } = useApi('/notifications?limit=5');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Selamat datang kembali, <span className="font-medium text-slate-700">{user?.name}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pohon Keluarga"
          value={Array.isArray(trees) ? trees.length : 0}
          icon={TreePine}
          href="/tree"
          color="bg-emerald-500"
        />
        <StatCard
          label="Chat Rooms"
          value={Array.isArray(rooms) ? rooms.length : 0}
          icon={MessageSquare}
          href="/chat"
          color="bg-blue-500"
        />
        <StatCard
          label="Poin"
          value={points?.balance ?? 0}
          icon={Trophy}
          href="/gamification"
          color="bg-amber-500"
        />
        <StatCard
          label="Notifikasi"
          value={notifs?.total ?? 0}
          icon={Bell}
          href="/notifications"
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/tree"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700"
          >
            <TreePine size={24} />
            <span className="text-sm font-medium">Buat Silsilah</span>
          </Link>
          <Link
            href="/chat"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-blue-700"
          >
            <MessageSquare size={24} />
            <span className="text-sm font-medium">Mulai Chat</span>
          </Link>
          <Link
            href="/gamification"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
          >
            <Trophy size={24} />
            <span className="text-sm font-medium">Leaderboard</span>
          </Link>
          <Link
            href="/notifications"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700"
          >
            <Bell size={24} />
            <span className="text-sm font-medium">Notifikasi</span>
          </Link>
        </div>
      </div>

      {/* Recent Notifications */}
      {notifs?.notifications?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Notifikasi Terbaru</h2>
            <Link href="/notifications" className="text-sm text-blue-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-3">
            {notifs.notifications.slice(0, 5).map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${n.isRead ? 'bg-white' : 'bg-blue-50'}`}
              >
                <Bell size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-500 truncate">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
