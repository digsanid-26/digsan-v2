'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { User, ArrowLeft, Loader2, BadgeCheck, CalendarDays, MapPin, Briefcase, GraduationCap, Heart, Newspaper, Activity } from 'lucide-react';
import { publicTreeApi } from '@/lib/tree';
import type { PublicProfile } from '@/lib/tree';

export default function PublicProfilePage() {
  const params = useParams<{ slug: string; username: string }>();
  const slug = params?.slug as string;
  const username = params?.username as string;

  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !username) return;
    let cancelled = false;
    setLoading(true);
    publicTreeApi
      .getProfile(slug, username)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Gagal memuat profil'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, username]);

  const joined = data?.profile.joinedAt
    ? new Date(data.profile.joinedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    : null;

  const birthDate = data?.profile.birthDate
    ? new Date(data.profile.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#05050f' }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Link href="/">
          <Image src="/logo-white.svg" alt="Digsan" width={110} height={28} priority className="h-7 w-auto" />
        </Link>
        <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">Masuk</Link>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/50">
          <Loader2 className="animate-spin mr-2" size={20} /> Memuat profil…
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <User size={40} className="text-white/25 mb-3" />
          <h1 className="text-white text-lg font-semibold mb-1">Profil tidak ditemukan</h1>
          <p className="text-white/40 text-sm mb-5">{error}</p>
          <Link href={`/family/${slug}`} className="text-blue-400 hover:underline text-sm">Kembali ke keluarga</Link>
        </div>
      ) : data ? (
        <main className="flex-1 px-4 py-8">
          <Link
            href={`/family/${slug}`}
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6"
          >
            <ArrowLeft size={15} /> {data.family.name}
          </Link>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: ID Card + Profile Details + CTA */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-blue-600/30 to-purple-600/30" />
                <div className="px-6 pb-6 -mt-12">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#05050f] bg-slate-700 flex items-center justify-center">
                    {data.profile.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.profile.avatar} alt={data.profile.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-white/60" />
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">{data.profile.name}</h1>
                    {data.profile.isOwner && <BadgeCheck size={20} className="text-blue-400" aria-label="Pemilik keluarga" />}
                  </div>
                  {data.profile.username && <p className="text-white/40 text-sm">@{data.profile.username}</p>}

                  {data.profile.bio && <p className="text-white/70 text-sm mt-4 leading-relaxed">{data.profile.bio}</p>}

                  <div className="mt-5 flex flex-wrap gap-4 text-white/50 text-sm">
                    {joined && (
                      <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> Bergabung {joined}</span>
                    )}
                    <Link href={`/family/${slug}`} className="inline-flex items-center gap-1.5 text-blue-400 hover:underline">
                      Bagian dari keluarga {data.family.name}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-white">Detail Profil</h2>
                {birthDate && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <CalendarDays size={16} className="text-white/40" />
                    <span>{birthDate}{data.profile.birthPlace ? `, ${data.profile.birthPlace}` : ''}</span>
                  </div>
                )}
                {!birthDate && data.profile.birthPlace && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <MapPin size={16} className="text-white/40" />
                    <span>{data.profile.birthPlace}</span>
                  </div>
                )}
                {data.profile.occupation && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <Briefcase size={16} className="text-white/40" />
                    <span>{data.profile.occupation}</span>
                  </div>
                )}
                {data.profile.education && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <GraduationCap size={16} className="text-white/40" />
                    <span>{data.profile.education}</span>
                  </div>
                )}
                {data.profile.hobbies && (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <Heart size={16} className="text-white/40" />
                    <span>{data.profile.hobbies}</span>
                  </div>
                )}
                {!birthDate && !data.profile.birthPlace && !data.profile.occupation && !data.profile.education && !data.profile.hobbies && (
                  <p className="text-white/30 text-xs">Belum ada detail profil dilengkapi.</p>
                )}
              </div>

              {/* Join CTA */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <h2 className="text-white font-semibold mb-1">Ingin terhubung?</h2>
                <p className="text-white/45 text-sm mb-4">Gabung digsan.id untuk melengkapi silsilah dan menjaga ikatan keluarga.</p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Bergabung sekarang
                </Link>
              </div>
            </div>

            {/* Column 2: Activity (dummy) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-white/50" />
                <h2 className="text-sm font-semibold text-white">Aktivitas Publik</h2>
              </div>
              {[
                { icon: '🌳', text: 'Memperbarui silsilah keluarga', time: '2 jam lalu' },
                { icon: '🎂', text: 'Mengucapkan selamat ulang tahun untuk Nenek Sari', time: '5 jam lalu' },
                { icon: '📸', text: 'Menambahkan foto keluarga baru', time: '1 hari lalu' },
                { icon: '💬', text: 'Mengirim pesan ke grup keluarga', time: '2 hari lalu' },
                { icon: '🏆', text: 'Mendapatkan badge "Kontributor Keluarga"', time: '3 hari lalu' },
              ].map((act, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3">
                  <span className="text-xl">{act.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 leading-snug">{act.text}</p>
                    <p className="text-xs text-white/30 mt-1">{act.time}</p>
                  </div>
                </div>
              ))}
              <p className="text-center text-white/20 text-xs pt-2">Aktivitas akan tersedia segera</p>
            </div>

            {/* Column 3: News & Trends (dummy) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper size={18} className="text-white/50" />
                <h2 className="text-sm font-semibold text-white">Berita & Tren</h2>
              </div>
              {[
                { tag: 'Tren', title: 'Reuni keluarga besar semakin populer di 2026', time: 'Hari ini' },
                { tag: 'Tips', title: 'Cara menjaga silsilah keluarga tetap aktual', time: '2 hari lalu' },
                { tag: 'Berita', title: 'Digsan.id meluncurkan fitur Keluarga Besar', time: '1 minggu lalu' },
                { tag: 'Tren', title: '5 tradisi keluarga yang mulai dihidupkan kembali', time: '1 minggu lalu' },
              ].map((news, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">{news.tag}</span>
                    <span className="text-xs text-white/30">{news.time}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-snug">{news.title}</p>
                </div>
              ))}
              <p className="text-center text-white/20 text-xs pt-2">Berita akan tersedia segera</p>
            </div>
          </div>
        </main>
      ) : null}

      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>
    </div>
  );
}
