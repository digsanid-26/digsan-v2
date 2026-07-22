'use client';

import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { Shield, Users, TreePine, Briefcase, DollarSign, Settings, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const { data: stats, loading } = useApi<any>('/admin/dashboard');

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-slate-500 mt-1">Kelola platform Digsan</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={Users} color="bg-blue-500" />
            <StatCard label="Family Trees" value={stats?.totalTrees ?? 0} icon={TreePine} color="bg-emerald-500" />
            <StatCard label="Total Orders" value={stats?.totalOrders ?? 0} icon={Briefcase} color="bg-amber-500" />
            <StatCard label="Workers" value={stats?.totalWorkers ?? 0} icon={Shield} color="bg-purple-500" />
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <Users size={24} className="text-blue-600 mb-3" />
              <h3 className="font-semibold text-slate-900">Manajemen User</h3>
              <p className="text-sm text-slate-500 mt-1">Kelola akun pengguna</p>
            </Link>
            <Link
              href="/admin/trees"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <TreePine size={24} className="text-emerald-600 mb-3" />
              <h3 className="font-semibold text-slate-900">Family Trees</h3>
              <p className="text-sm text-slate-500 mt-1">Cek slug & silsilah keluarga</p>
            </Link>
            <Link
              href="/admin/workers"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <Briefcase size={24} className="text-emerald-600 mb-3" />
              <h3 className="font-semibold text-slate-900">Manajemen Worker</h3>
              <p className="text-sm text-slate-500 mt-1">Verifikasi dan kelola worker</p>
            </Link>
            <Link
              href="/admin/gamification"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <Trophy size={24} className="text-amber-500 mb-3" />
              <h3 className="font-semibold text-slate-900">Gamification</h3>
              <p className="text-sm text-slate-500 mt-1">Kelola poin, reward & redeem</p>
            </Link>
            <Link
              href="/admin/settings"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <Settings size={24} className="text-slate-600 mb-3" />
              <h3 className="font-semibold text-slate-900">Pengaturan</h3>
              <p className="text-sm text-slate-500 mt-1">Konfigurasi sistem</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}
