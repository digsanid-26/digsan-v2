'use client';

import { useAuth } from '@/components/providers/auth-provider';
import FamilyTreeVisual from '@/app/components/FamilyTreeVisual';
import {
  TreePine,
  UserPlus,
  Heart,
  MessageSquare,
  Image as ImageIcon,
  CalendarDays,
  Info,
  Gift,
  Megaphone,
  Trophy,
  Star,
  Flame,
  Award,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// ─── Dummy data ─────────────────────────────────────────────

const activities = [
  { icon: UserPlus, color: 'text-blue-500', title: 'Ayah menambahkan anggota keluarga baru', time: '5 menit lalu' },
  { icon: Heart, color: 'text-rose-500', title: 'Kakak menyukai foto kenangan Lebaran', time: '1 jam lalu' },
  { icon: ImageIcon, color: 'text-emerald-500', title: 'Ibu mengunggah 3 foto baru', time: '3 jam lalu' },
  { icon: MessageSquare, color: 'text-indigo-500', title: 'Adik mengomentari silsilah keluarga', time: 'Kemarin' },
  { icon: CalendarDays, color: 'text-amber-500', title: 'Pengingat: Ulang tahun Nenek besok', time: 'Kemarin' },
  { icon: TreePine, color: 'text-teal-500', title: 'Cabang keluarga baru ditambahkan', time: '2 hari lalu' },
];

const infoItems = [
  { icon: Gift, color: 'text-rose-500', title: 'Ulang Tahun Terdekat', desc: 'Nenek Sari — 13 Juli 2026' },
  { icon: CalendarDays, color: 'text-blue-500', title: 'Acara Keluarga', desc: 'Reuni Besar — 20 Juli 2026' },
  { icon: Megaphone, color: 'text-amber-500', title: 'Pengumuman', desc: 'Fitur album foto keluarga kini tersedia!' },
  { icon: Info, color: 'text-emerald-500', title: 'Tips', desc: 'Lengkapi profil untuk poin bonus.' },
];

const badges = [
  { icon: TreePine, label: 'Perintis Silsilah', color: 'bg-emerald-500' },
  { icon: Heart, label: 'Penjaga Kenangan', color: 'bg-rose-500' },
  { icon: MessageSquare, label: 'Perekat Keluarga', color: 'bg-indigo-500' },
];

// ─── Reusable Card ──────────────────────────────────────────

function Card({ title, icon: Icon, iconColor, action, children }: any) {
  return (
    <section className="rounded-2xl border p-5 flex flex-col transition-colors
      bg-white border-slate-200 shadow-sm
      dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className={iconColor} />}
          <h2 className="text-base font-semibold text-slate-900 dark:text-white"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

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

      {/* 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Column 1 — Family Tree */}
        <Card
          title="Silsilah Keluarga"
          icon={TreePine}
          iconColor="text-emerald-500"
          action={
            <Link href="/tree" className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
              Kelola
            </Link>
          }
        >
          <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <div style={{ transform: 'scale(0.4)' }}>
                <FamilyTreeVisual compact />
              </div>
            </div>
          </div>
        </Card>

        {/* Column 2 — Recent Activity */}
        <Card
          title="Aktivitas Terbaru"
          icon={Flame}
          iconColor="text-orange-500"
        >
          <ul className="space-y-3">
            {activities.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  bg-slate-100 dark:bg-white/5"
                >
                  <a.icon size={15} className={a.color} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 dark:text-white/80 leading-snug">{a.title}</p>
                  <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Column 3 — Information */}
        <Card
          title="Informasi"
          icon={Info}
          iconColor="text-blue-500"
        >
          <ul className="space-y-3">
            {infoItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-xl
                bg-slate-50 dark:bg-white/[0.03]"
              >
                <item.icon size={17} className={`${item.color} mt-0.5 shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white/90">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Column 4 — Gamification */}
        <Card
          title="Skor & Gamifikasi"
          icon={Trophy}
          iconColor="text-amber-500"
          action={
            <Link href="/gamification" className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
              Detail
            </Link>
          }
        >
          {/* Score ring */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center
              bg-gradient-to-br from-amber-400 to-orange-500"
            >
              <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center
                bg-white dark:bg-[#0b0b1a]"
              >
                <span className="text-2xl font-bold text-slate-900 dark:text-white">1.250</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40">Poin</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-sm">
              <Star size={15} className="text-amber-500 fill-amber-500" />
              <span className="font-semibold text-slate-800 dark:text-white/90">Level 7</span>
              <span className="text-slate-400 dark:text-white/40">— Sesepuh</span>
            </div>
          </div>

          {/* Stats rows */}
          <div className="space-y-2.5 mb-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                <TrendingUp size={14} className="text-emerald-500" /> Peringkat
              </span>
              <span className="font-semibold text-slate-800 dark:text-white/90">#3 dari 48</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                <Flame size={14} className="text-orange-500" /> Streak
              </span>
              <span className="font-semibold text-slate-800 dark:text-white/90">12 hari</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                <Award size={14} className="text-indigo-500" /> Lencana
              </span>
              <span className="font-semibold text-slate-800 dark:text-white/90">{badges.length}</span>
            </div>
          </div>

          {/* Badges */}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2">Lencana</p>
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <span
                  key={i}
                  title={b.label}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${b.color}`}
                >
                  <b.icon size={16} />
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
