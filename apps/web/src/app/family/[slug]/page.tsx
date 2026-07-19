'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { publicTreeApi } from '@/lib/tree';
import type { PublicFamily } from '@/lib/tree';
import type { TreeConfig, Members, TNode } from '@/app/components/treeTypes';
import { DEFAULT_CONFIG } from '@/app/components/treeTypes';
import { configToGraph, layoutGraph } from '@/app/components/familyGraph';
import PublicTreeCanvas from '@/app/components/PublicTreeCanvas';

export default function PublicFamilyPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug as string;

  const [data, setData] = useState<PublicFamily<Partial<TreeConfig>, Members> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    publicTreeApi
      .getFamily<Partial<TreeConfig>, Members>(slug)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Gagal memuat keluarga'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const config: TreeConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...(data?.config ?? {}) }),
    [data?.config],
  );
  const members: Members = useMemo(() => data?.members ?? {}, [data?.members]);

  const { nodes, lines } = useMemo(() => {
    if (!data?.config) return { nodes: [] as TNode[], lines: [] };
    const selfName = data.owner?.name || members['self']?.name || 'Anda';
    const graph = configToGraph(config, members, selfName);
    return layoutGraph(graph);
  }, [data?.config, config, members]);

  const resolve = (id: string, fallback: string) => {
    const m = members[id];
    const name = id === 'self' ? (m?.name || data?.owner?.name || 'Anda') : (m?.name || fallback);
    const photo = id === 'self' ? (m?.photo || data?.owner?.avatar || null) : (m?.photo || null);
    return { name, photo, alive: m?.alive !== false };
  };

  const onNodeClick = (node: TNode) => {
    // Only the owner (self) currently has a public profile username.
    if (node.id === 'self' && data?.owner?.username) {
      router.push(`/family/${slug}/${data.owner.username}`);
    }
  };

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
          <Loader2 className="animate-spin mr-2" size={20} /> Memuat silsilah…
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Users size={40} className="text-white/25 mb-3" />
          <h1 className="text-white text-lg font-semibold mb-1">Keluarga tidak ditemukan</h1>
          <p className="text-white/40 text-sm mb-5">{error}</p>
          <Link href="/" className="text-blue-400 hover:underline text-sm">Kembali ke beranda</Link>
        </div>
      ) : data ? (
        <main className="flex-1 flex flex-col">
          {/* Family header */}
          <section className="px-6 pt-8 pb-4 text-center max-w-2xl mx-auto">
            <p className="text-blue-400/80 text-xs font-medium uppercase tracking-wider mb-2">Silsilah Keluarga</p>
            <h1
              className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              {data.name}
            </h1>
            {data.description && <p className="text-white/50 text-sm leading-relaxed">{data.description}</p>}
            {data.owner && (
              <div className="mt-4 inline-flex items-center gap-2 text-white/60 text-sm">
                {data.owner.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.owner.avatar} alt={data.owner.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
                ) : null}
                <span>Dikelola oleh {data.owner.name}</span>
                {data.owner.username && (
                  <Link href={`/family/${slug}/${data.owner.username}`} className="inline-flex items-center gap-1 text-blue-400 hover:underline">
                    Lihat profil <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Tree */}
          <section className="flex-1 min-h-[420px] px-2 sm:px-6 pb-8">
            {nodes.length ? (
              <PublicTreeCanvas
                nodes={nodes}
                lines={lines}
                resolve={resolve}
                onNodeClick={onNodeClick}
                className="w-full h-full min-h-[420px]"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-white/40 text-sm">
                Silsilah belum disiapkan.
              </div>
            )}
          </section>

          {/* CTA */}
          <section className="px-6 pb-10 text-center">
            <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-white font-semibold mb-1">Bagian dari keluarga ini?</h2>
              <p className="text-white/45 text-sm mb-4">Gabung untuk melengkapi profil Anda dan menjaga silsilah tetap hidup.</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Bergabung di digsan.id <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        </main>
      ) : null}

      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>
    </div>
  );
}
