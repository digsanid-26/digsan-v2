'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { User, ArrowLeft, Loader2, BadgeCheck, CalendarDays } from 'lucide-react';
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
        <main className="flex-1 flex flex-col items-center px-4 py-10">
          <Link
            href={`/family/${slug}`}
            className="self-start max-w-lg w-full mx-auto inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6"
          >
            <ArrowLeft size={15} /> {data.family.name}
          </Link>

          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
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

          <div className="w-full max-w-lg mt-6 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
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
        </main>
      ) : null}

      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>
    </div>
  );
}
