'use client';

import { useApi } from '@/lib/hooks';
import { Trophy, Award, Star, TrendingUp } from 'lucide-react';

export default function GamificationPage() {
  const { data: balance } = useApi<any>('/gamification/points/balance');
  const { data: history } = useApi<any>('/gamification/points/history?limit=10');
  const { data: leaderboard } = useApi<any[]>('/gamification/leaderboard?limit=10');
  const { data: badges } = useApi<any[]>('/gamification/badges');
  const { data: myBadges } = useApi<any[]>('/gamification/badges/me');

  const myBadgeIds = new Set((myBadges || []).map((b: any) => b.badgeId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gamifikasi</h1>
        <p className="text-slate-500 mt-1">Poin, badge, dan peringkat Anda</p>
      </div>

      {/* Points balance */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
            <Star size={24} />
          </div>
          <div>
            <p className="text-sm opacity-90">Total Poin</p>
            <p className="text-3xl font-bold">{balance?.balance ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Leaderboard
          </h2>
          {!leaderboard?.length ? (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry: any, i: number) => (
                <div
                  key={entry.userId || i}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-100 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {entry.user?.name || entry.name || 'User'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">
                    {entry._sum?.amount ?? entry.totalPoints ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Award size={20} />
            Badge
          </h2>
          {!badges?.length ? (
            <p className="text-sm text-slate-500 py-4 text-center">Belum ada badge</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badges.map((badge: any) => {
                const earned = myBadgeIds.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-lg border text-center ${
                      earned
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="text-2xl mb-2">{badge.icon || '🏅'}</div>
                    <p className="text-sm font-medium text-slate-900">{badge.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{badge.description}</p>
                    {earned && (
                      <span className="inline-block mt-2 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        Diperoleh
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Point History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Riwayat Poin</h2>
        {!history?.points?.length ? (
          <p className="text-sm text-slate-500 py-4 text-center">Belum ada riwayat</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.points.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.description || p.type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${p.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {p.amount >= 0 ? '+' : ''}{p.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
