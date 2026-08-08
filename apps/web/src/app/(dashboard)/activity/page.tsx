'use client';

import { UserPlus, Heart, Image as ImageIcon, MessageSquare, CalendarDays, TreePine, Trophy, Briefcase, Star, CheckCircle, Wrench } from 'lucide-react';

const groups = [
  {
    date: 'Hari Ini',
    items: [
      { icon: UserPlus, color: 'text-blue-500', title: 'Ayah menambahkan anggota keluarga baru', meta: 'Silsilah Keluarga Besar', time: '5 menit lalu' },
      { icon: CheckCircle, color: 'text-emerald-500', title: 'Pekerja "Budi Santoso" menyelesaikan order #JK-2401 (Cuci AC 1PK)', meta: 'Digsan Kerja', time: '32 menit lalu' },
      { icon: Briefcase, color: 'text-blue-600', title: 'Pesanan baru #JK-2402: Tukang ledeng untuk perbaikan kran dapur', meta: 'Digsan Kerja', time: '1 jam lalu' },
      { icon: Heart, color: 'text-rose-500', title: 'Kakak menyukai foto kenangan Lebaran', meta: 'Album Kenangan', time: '1 jam lalu' },
      { icon: ImageIcon, color: 'text-emerald-500', title: 'Ibu mengunggah 3 foto baru', meta: 'Album Kenangan', time: '3 jam lalu' },
      { icon: Star, color: 'text-amber-500', title: 'Ibu memberikan ulasan bintang 5 untuk jasa "Bersih Rumah"', meta: 'Digsan Kerja', time: '4 jam lalu' },
    ],
  },
  {
    date: 'Kemarin',
    items: [
      { icon: MessageSquare, color: 'text-indigo-500', title: 'Adik mengomentari silsilah keluarga', meta: 'Silsilah Keluarga', time: 'Kemarin, 20:14' },
      { icon: Wrench, color: 'text-orange-500', title: 'Pekerja "Ahmad Yani" memulai pengerjaan order #JK-2398 (Servis Kipas Angin)', meta: 'Digsan Kerja', time: 'Kemarin, 16:45' },
      { icon: Trophy, color: 'text-amber-500', title: 'Anda memperoleh lencana "Perekat Keluarga"', meta: 'Gamifikasi', time: 'Kemarin, 18:02' },
      { icon: Briefcase, color: 'text-blue-600', title: 'Admin menugaskan pekerja "Siti Aminah" untuk order #JK-2395', meta: 'Digsan Kerja', time: 'Kemarin, 14:20' },
      { icon: CalendarDays, color: 'text-orange-500', title: 'Pengingat ulang tahun Nenek ditambahkan', meta: 'Acara Keluarga', time: 'Kemarin, 09:30' },
    ],
  },
  {
    date: 'Minggu Ini',
    items: [
      { icon: TreePine, color: 'text-teal-500', title: 'Cabang keluarga baru ditambahkan', meta: 'Silsilah Keluarga', time: '2 hari lalu' },
      { icon: CheckCircle, color: 'text-emerald-500', title: 'Order #JK-2390 (Tukang Listrik) selesai dengan rating 4.8', meta: 'Digsan Kerja', time: '2 hari lalu' },
      { icon: UserPlus, color: 'text-blue-500', title: 'Paman bergabung ke keluarga', meta: 'Anggota', time: '4 hari lalu' },
      { icon: Briefcase, color: 'text-blue-600', title: 'Pekerja baru "Dewi Lestari" mendaftar sebagai tukang cuci', meta: 'Digsan Kerja', time: '5 hari lalu' },
    ],
  },
];

export default function ActivityPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
          Aktivitas
        </h1>
        <p className="text-slate-500 dark:text-white/50 mt-1 text-sm">Semua aktivitas keluarga Anda dalam satu lini masa.</p>
      </div>

      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-3">{g.date}</h2>
          <div className="rounded-2xl border overflow-hidden
            bg-white border-slate-200 shadow-sm
            dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
            {g.items.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 ${i > 0 ? 'border-t border-slate-100 dark:border-white/[0.06]' : ''}`}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/5">
                  <a.icon size={16} className={a.color} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-white/85 leading-snug">{a.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-blue-500 dark:text-blue-400">{a.meta}</span>
                    <span className="text-slate-300 dark:text-white/20">•</span>
                    <span className="text-xs text-slate-400 dark:text-white/40">{a.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
