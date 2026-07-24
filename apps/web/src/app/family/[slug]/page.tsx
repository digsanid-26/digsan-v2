'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Users, ArrowRight, Loader2, X } from 'lucide-react';
import { publicTreeApi, treeApi, savePendingClaim } from '@/lib/tree';
import type { PublicFamily } from '@/lib/tree';
import { getTokens, getUser } from '@/lib/auth';
import type { TreeConfig, Members, TNode, Poly } from '@/app/components/treeTypes';
import { DEFAULT_CONFIG } from '@/app/components/treeTypes';
import PublicTreeCanvas from '@/app/components/PublicTreeCanvas';
import AppHeader from '@/app/components/AppHeader';
import { ThemeProvider } from '@/app/components/ThemeProvider';
import { AuthProvider } from '@/components/providers/auth-provider';

// Local layout helpers for main family + both sets of parents + Keluarga Besar
const spreadX = (count: number, gap: number, cx: number): number[] => {
  if (count <= 0) return [];
  const total = (count - 1) * gap;
  return Array.from({ length: count }, (_, i) => cx - total / 2 + i * gap);
};
function connectDown(lines: Poly[], midX: number, parentY: number, childXs: number[], childY: number) {
  if (childXs.length === 0) return;
  const trunkY = (parentY + childY) / 2;
  lines.push({ points: [[midX, parentY], [midX, trunkY]] });
  const xs = [...childXs, midX];
  lines.push({ points: [[Math.min(...xs), trunkY], [Math.max(...xs), trunkY]] });
  for (const cx of childXs) lines.push({ points: [[cx, trunkY], [cx, childY]] });
}

export default function PublicFamilyPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug as string;

  const [data, setData] = useState<PublicFamily<Partial<TreeConfig>, Members> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [claimNode, setClaimNode] = useState<TNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Deep link from an invitation: /family/{slug}?m={nodeId} focuses that member.
  // Also read public link token from ?t= query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('m');
    if (m) setHighlightId(m);
    const t = params.get('t');
    if (t) setLinkToken(t);
    setIsLoggedIn(!!getUser());
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    const tokens = getTokens();
    publicTreeApi
      .getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, tokens?.accessToken)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Gagal memuat keluarga'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, linkToken]);

  const config: TreeConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...(data?.config ?? {}) }),
    [data?.config],
  );
  const members: Members = useMemo(() => data?.members ?? {}, [data?.members]);

  const { nodes, lines } = useMemo(() => {
    if (!data?.config) return { nodes: [] as TNode[], lines: [] as Poly[] };
    const cfg = config;
    const ns: TNode[] = [];
    const ls: Poly[] = [];

    // Self + spouses (y = 0)
    const coupleXs = spreadX(1 + cfg.spouseCount, 160, 0);
    const selfX = coupleXs[0];
    ns.push({ id: 'self', name: 'Anda', role: 'Diri Sendiri', x: selfX, y: 0, group: 'self' });
    for (let i = 0; i < cfg.spouseCount; i++) {
      const sx = coupleXs[i + 1];
      ns.push({ id: `spouse-${i}`, name: cfg.spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', role: 'Suami / Istri', x: sx, y: 0, group: 'spouse' });
      ls.push({ points: [[selfX, 0], [sx, 0]], marriage: true });
    }
    const coupleMid = coupleXs.reduce((a, b) => a + b, 0) / coupleXs.length;

    // Children (y = 210)
    const childXs = spreadX(cfg.childCount, 130, coupleMid);
    childXs.forEach((x, i) => ns.push({ id: `child-${i}`, name: `Anak ${i + 1}`, role: 'Keturunan', x, y: 210, group: 'child' }));
    connectDown(ls, coupleMid, 0, childXs, 210);

    // "Keluarga Besar" group node (y = -210), connected directly to the couple
    ns.push({ id: 'grp-kb', name: 'Keluarga Besar', role: 'group', x: coupleMid, y: -210, group: 'parent', count: cfg.parentCount + 2 });
    ls.push({ points: [[coupleMid, 0], [coupleMid, -210]] });

    return { nodes: ns, lines: ls };
  }, [data?.config, config, members]);

  const resolve = (id: string, fallback: string) => {
    const m = members[id];
    const name = id === 'self' ? (m?.name || data?.owner?.name || 'Anda') : (m?.name || fallback);
    const photo = id === 'self' ? (m?.photo || data?.owner?.avatar || null) : (m?.photo || null);
    return { name, photo, alive: m?.alive !== false, gender: m?.gender || '', verified: id === 'self' ? true : m?.verified };
  };

  const onNodeClick = (node: TNode) => {
    // Only the owner (self) currently has a public profile username.
    if (node.id === 'self' && data?.owner?.username) {
      router.push(`/family/${slug}/${data.owner.username}`);
    }
  };

  const closeClaimModal = () => { setClaimNode(null); setClaimError(null); };

  const confirmClaim = async () => {
    if (!claimNode) return;
    if (!getTokens()?.accessToken) {
      savePendingClaim({ slug, nodeId: claimNode.id });
      router.push(`/register?tree=${encodeURIComponent(slug)}&node=${encodeURIComponent(claimNode.id)}`);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      await treeApi.claimNode(slug, claimNode.id);
      const refreshed = await publicTreeApi.getFamily<Partial<TreeConfig>, Members>(slug);
      setData(refreshed);
      closeClaimModal();
    } catch (e: any) {
      setClaimError(e.message || 'Gagal mengklaim bagian ini');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#05050f' }}>
      {isLoggedIn ? (
        <ThemeProvider>
          <AuthProvider>
            <AppHeader />
          </AuthProvider>
        </ThemeProvider>
      ) : (
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <Link href="/">
            <Image src="/logo-white.svg" alt="Digsan" width={110} height={28} priority className="h-7 w-auto" />
          </Link>
          <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">Masuk</Link>
        </header>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/50">
          <Loader2 className="animate-spin mr-2" size={20} /> Memuat silsilah…
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Users size={40} className="text-white/25 mb-3" />
          <h1 className="text-white text-lg font-semibold mb-1">Akses terbatas</h1>
          <p className="text-white/40 text-sm mb-5 max-w-sm">{error}</p>
          <div className="flex gap-3">
            <Link href="/login" className="text-blue-400 hover:underline text-sm">Masuk</Link>
            <Link href="/" className="text-white/40 hover:text-white text-sm">Kembali ke beranda</Link>
          </div>
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
              Pohon Keluarga {data.name}
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

          {/* Invited-member banner */}
          {highlightId && (
            <div className="px-6 -mt-1 mb-2">
              <div className="max-w-md mx-auto rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-center">
                <p className="text-amber-200 text-sm">Anda diundang — bagian Anda ditandai <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 align-middle" /> pada silsilah di bawah.</p>
              </div>
            </div>
          )}

          {/* Tree */}
          <section className="px-2 sm:px-6 pb-8">
            {nodes.length ? (
              <PublicTreeCanvas
                nodes={nodes}
                lines={lines}
                resolve={resolve}
                onNodeClick={onNodeClick}
                onUnclaimedClick={setClaimNode}
                onGroupClick={(n) => {
                  // Keluarga Besar Tree view not yet built — will be implemented
                  // after Family Mode layout (FUTURE-FEATURES.md L68)
                  if (n.id === 'grp-kb') {
                    console.log('Keluarga Besar clicked — view not yet available');
                  }
                }}
                highlightId={highlightId ?? undefined}
                focusId="self"
                className="w-full h-[70vh] min-h-[420px] max-h-[720px] rounded-2xl border border-white/[0.06] bg-white/[0.01]"
              />
            ) : (
              <div className="h-[420px] flex items-center justify-center text-white/40 text-sm">
                Silsilah belum disiapkan.
              </div>
            )}
            {nodes.length ? (
              <p className="text-center text-white/25 text-xs mt-2">
                Geser untuk menjelajah, gulir/pinch untuk memperbesar. Lingkaran bergaris putus-putus belum diklaim.
              </p>
            ) : null}
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

      {/* "Apakah ini Anda?" claim modal for an unclaimed node */}
      {claimNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={closeClaimModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a16] p-6 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeClaimModal}
              aria-label="Tutup"
              className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
            >
              <X size={18} />
            </button>
            <Users size={32} className="mx-auto text-blue-400 mb-3" />
            <h3 className="text-white font-semibold text-lg mb-1">
              Apakah ini <span className="text-blue-400">{claimNode.name}</span>?
            </h3>
            <p className="text-white/50 text-sm mb-5">
              Jika ini Anda, hubungkan akun untuk melengkapi profil dan mengedit bagian silsilah ini.
            </p>
            {claimError && (
              <p className="text-red-400 text-sm mb-3">{claimError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmClaim}
                disabled={claiming}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white transition-colors"
              >
                {claiming ? 'Memproses…' : 'Ya, ini saya'}
              </button>
              <button
                onClick={closeClaimModal}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
              >
                Bukan saya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
