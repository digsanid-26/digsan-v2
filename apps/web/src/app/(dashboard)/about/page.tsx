'use client';

import { TreePine, Users, Heart, ShieldCheck, MessageSquare, Trophy } from 'lucide-react';

const features = [
  { icon: TreePine, color: 'text-emerald-500', title: 'Silsilah Keluarga', desc: 'Bangun dan jelajahi pohon keluarga lintas generasi dengan visual interaktif.' },
  { icon: MessageSquare, color: 'text-blue-500', title: 'Ruang Obrolan', desc: 'Tetap terhubung dengan anggota keluarga melalui percakapan pribadi maupun grup.' },
  { icon: Heart, color: 'text-rose-500', title: 'Album Kenangan', desc: 'Simpan dan bagikan momen berharga keluarga dalam satu tempat aman.' },
  { icon: Trophy, color: 'text-amber-500', title: 'Gamifikasi', desc: 'Kumpulkan poin dan lencana saat aktif merawat silsilah keluarga.' },
  { icon: ShieldCheck, color: 'text-indigo-500', title: 'Privasi Terjaga', desc: 'Data keluarga Anda terenkripsi dan hanya dapat diakses oleh yang berwenang.' },
  { icon: Users, color: 'text-teal-500', title: 'Kolaborasi', desc: 'Undang kerabat untuk melengkapi data dan cerita keluarga bersama.' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Hero */}
      <section className="text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4
          bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white/80">
          Tentang Digsan
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}>
          Platform Keluarga Indonesia
        </h1>
        <p className="text-slate-500 dark:text-white/60 mt-4 max-w-2xl mx-auto leading-relaxed">
          Digsan membantu keluarga Indonesia menjaga hubungan, merawat silsilah, dan mewariskan
          kenangan dari satu generasi ke generasi berikutnya melalui satu platform yang aman dan modern.
        </p>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border p-5 transition-colors
            bg-white border-slate-200 shadow-sm
            dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4
              bg-slate-100 dark:bg-white/5">
              <f.icon size={20} className={f.color} />
            </span>
            <h3 className="font-semibold text-slate-900 dark:text-white">{f.title}</h3>
            <p className="text-sm text-slate-500 dark:text-white/55 mt-1.5 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Stats */}
      <section className="rounded-2xl border p-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center
        bg-white border-slate-200 shadow-sm
        dark:bg-white/[0.03] dark:border-white/10 dark:shadow-none">
        {[
          { v: '12.500+', l: 'Keluarga' },
          { v: '85.000+', l: 'Anggota' },
          { v: '240.000+', l: 'Kenangan' },
          { v: '99,9%', l: 'Uptime' },
        ].map((s) => (
          <div key={s.l}>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.v}</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1 uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-sm text-slate-400 dark:text-white/40">
        Digsan &copy; {new Date().getFullYear()} — Dibuat dengan &hearts; untuk keluarga Indonesia.
      </p>
    </div>
  );
}
