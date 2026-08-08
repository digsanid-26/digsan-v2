'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useApi } from '@/lib/hooks';
import FamilyTreeVisual from '@/app/components/FamilyTreeVisual';
import {
  TreePine,
  MessageSquare,
  CalendarDays,
  Info,
  Trophy,
  Star,
  Flame,
  Award,
  TrendingUp,
  Play,
  HelpCircle,
  MessageCircle,
  Zap,
  Gift,
  Users,
  LogIn,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';

// ─── Status box component ───────────────────────────────────

function StatusBox({
  label,
  description,
  active,
  icon: Icon,
}: {
  label: string;
  description: string;
  active?: boolean;
  icon: any;
}) {
  return (
    <div className="rounded-xl border p-4 flex items-start gap-3 transition-colors
      bg-white border-slate-200
      dark:bg-white/[0.02] dark:border-white/10"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0
        ${active ? 'bg-emerald-500' : 'bg-slate-800'}`}>
        <Icon size={20} className={active ? 'text-white' : 'text-slate-500'} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{label}</h3>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
            ${active
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-400'}`}>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />}
            {active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ─── How-to article link ────────────────────────────────────

const howToArticles = [
  { title: 'Cara membuat silsilah keluarga', href: '/about' },
  { title: 'Menambahkan anggota keluarga baru', href: '/about' },
  { title: 'Mengundang kerabat ke family tree', href: '/about' },
  { title: 'Pengaturan privasi & profil', href: '/about' },
  { title: 'Memahami sistem poin & badge', href: '/gamification' },
];

// ─── Point type icons ───────────────────────────────────────

const pointTypeIcons: Record<string, any> = {
  login: LogIn,
  aktivitas: Zap,
  network: Users,
  referral: Gift,
  pengabdian: Award,
  default: Star,
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: balance } = useApi<any>('/gamification/points/balance');
  const { data: historyData } = useApi<any>('/gamification/points/history?limit=10');
  const { data: myBadges } = useApi<any[]>('/gamification/badges/me');

  const totalPoin = balance?.balance ?? 0;
  const pointHistory: any[] = historyData?.points ?? [];
  const badgeCount = (myBadges ?? []).length;

  // Group points by type for the breakdown
  const pointBreakdown: Record<string, number> = {};
  for (const p of pointHistory) {
    pointBreakdown[p.type] = (pointBreakdown[p.type] || 0) + p.amount;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Selamat datang, {user?.name?.split(' ')[0] || 'Keluarga'}
        </h1>
        <p className="text-slate-500 dark:text-white/50 mt-1 text-sm">
          Berikut ringkasan aktivitas keluarga Anda hari ini.
        </p>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Column 1: App Status ─── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            App Status
          </h2>

          {/* Tree — Active */}
          <div className="rounded-xl border p-4 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TreePine size={18} className="text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">TREE</h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  Active
                </span>
              </div>
              <Link href="/tree" className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
                Kelola
              </Link>
            </div>
            <div className="relative mx-auto" style={{ width: 260, height: 200 }}>
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <div style={{ transform: 'scale(0.35)' }}>
                  <FamilyTreeVisual compact />
                </div>
              </div>
            </div>
          </div>

          {/* Chat — Active */}
          <Link href="/chat" className="block">
            <StatusBox
              label="Aplikasi Chat"
              description="Chat real-time dengan kerabat dan keluarga"
              active
              icon={MessageCircle}
            />
          </Link>

          {/* Kerja — Active */}
          <Link href="/kerja" className="block">
            <StatusBox
              label="Aplikasi Kerja"
              description="Marketplace jasa & pekerja untuk keluarga"
              active
              icon={Briefcase}
            />
          </Link>

          {/* Doa Leluhur — Inactive */}
          <StatusBox
            label="Doa Leluhur"
            description="Kumpulan doa dan zikir untuk keluarga"
            icon={Flame}
          />

          {/* Digsan Membercard — Inactive */}
          <StatusBox
            label="Digsan Membercard"
            description="Kartu keanggotaan digital Digsan"
            icon={Award}
          />

          {/* MMBC Membership — Inactive */}
          <StatusBox
            label="MMBC Membership"
            description="Keanggotaan MMBC (Medja Business Community)"
            icon={Trophy}
          />
        </div>

        {/* ─── Column 2: How To ─── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            How To
          </h2>

          <div className="rounded-xl border p-4 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed mb-3">
              Pelajari cara memaksimalkan fitur Digsan untuk keluarga Anda.
            </p>
            {/* YouTube placeholder */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 mb-4">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-white/30">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                    <Play size={20} className="ml-0.5" />
                  </div>
                  <span className="text-xs">Video panduan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Article list */}
          <div className="rounded-xl border p-4 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <ul className="space-y-2.5">
              {howToArticles.map((a, i) => (
                <li key={i}>
                  <Link href={a.href}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/70 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    <Info size={14} className="text-slate-400 dark:text-white/30 shrink-0" />
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA block */}
          <div className="rounded-xl border p-4 flex flex-col items-center text-center gap-3 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <HelpCircle size={24} className="text-blue-500" />
            <p className="text-sm font-medium text-slate-800 dark:text-white/90">Butuh bantuan?</p>
            <Link href="/kontak"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Konsultasikan
            </Link>
          </div>
        </div>

        {/* ─── Column 3: Poin & Aktivitas ─── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            Poin & Aktivitas
          </h2>

          {/* Total poin card */}
          <div className="rounded-xl border p-4 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center
                bg-gradient-to-br from-amber-400 to-orange-500"
              >
                <div className="w-14 h-14 rounded-full flex flex-col items-center justify-center
                  bg-white dark:bg-[#0b0b1a]"
                >
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{totalPoin}</span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 dark:text-white/40">Poin</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-white/40">Total Poin</p>
                <Link href="/gamification" className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
                  Detail lengkap
                </Link>
              </div>
            </div>

            {/* Point type breakdown */}
            {Object.keys(pointBreakdown).length > 0 ? (
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40">Tipe Poin</p>
                {Object.entries(pointBreakdown).map(([type, amount]) => {
                  const Icon = pointTypeIcons[type] || pointTypeIcons.default;
                  return (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-white/60 capitalize">
                        <Icon size={14} className="text-amber-500" /> {type}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-white/90">+{amount}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-white/40 text-center py-3 mb-4">
                Belum ada poin yang diperoleh
              </p>
            )}

            {/* Quick stats */}
            <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-100 dark:border-white/5">
              <span className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                <Award size={14} className="text-indigo-500" /> Lencana
              </span>
              <span className="font-semibold text-slate-800 dark:text-white/90">{badgeCount}</span>
            </div>
          </div>

          {/* Aktivitas history */}
          <div className="rounded-xl border p-4 transition-colors
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              Aktivitas
            </h3>
            {pointHistory.length > 0 ? (
              <ul className="space-y-3">
                {pointHistory.slice(0, 8).map((p: any, i: number) => {
                  const Icon = pointTypeIcons[p.type] || pointTypeIcons.default;
                  return (
                    <li key={p.id || i} className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0
                        bg-slate-100 dark:bg-white/5"
                      >
                        <Icon size={15} className="text-amber-500" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-white/80 leading-snug">
                          +{p.amount} poin {p.type}
                          {p.reason && <span className="text-slate-400 dark:text-white/40"> — {p.reason}</span>}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                          {formatTimeAgo(p.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 dark:text-white/40 text-center py-6">
                Belum ada aktivitas tercatet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
