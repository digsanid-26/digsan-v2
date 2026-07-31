'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Users, ArrowRight, Loader2, X, KeyRound, BadgeCheck, LogIn, PanelLeft } from 'lucide-react';
import { publicTreeApi, treeApi, savePendingClaim } from '@/lib/tree';
import type { PublicFamily } from '@/lib/tree';
import { auth, getTokens, getUser, saveTokens, saveUser } from '@/lib/auth';
import type { TreeConfig, Members, TNode, Poly } from '@/app/components/treeTypes';
import { DEFAULT_CONFIG } from '@/app/components/treeTypes';
import PublicTreeCanvas from '@/app/components/PublicTreeCanvas';
import FamilyNodeTreeCanvas, { type FamilyNodeItem, type FamilyNodeLink, type FamilyNodeMember } from '@/app/components/FamilyNodeTreeCanvas';
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
  const [selectedNode, setSelectedNode] = useState<TNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState<'member' | 'familynode'>('member');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Super user early access form
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [eaOpen, setEaOpen] = useState(false);
  const [eaEmail, setEaEmail] = useState('');
  const [eaPassword, setEaPassword] = useState('');
  const [eaPhone, setEaPhone] = useState('');
  const [eaLoading, setEaLoading] = useState(false);
  const [eaError, setEaError] = useState('');
  const [eaSuccess, setEaSuccess] = useState('');
  const [eaLoginLoading, setEaLoginLoading] = useState(false);
  const [eaLoginError, setEaLoginError] = useState('');

  // Deep link from an invitation: /family/{slug}?m={nodeId} focuses that member.
  // Also read public link token from ?t= query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('m');
    if (m) setHighlightId(m);
    const t = params.get('t');
    if (t) setLinkToken(t);
    const u = getUser();
    setIsLoggedIn(!!u);
    setIsSuperUser(u?.roles?.includes('super_user') ?? false);
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

  // ─── Family Node Tree data (L103) ───────────────────────────
  const familyNodeTree = useMemo(() => {
    if (!data?.config) return { nodes: [] as FamilyNodeItem[], links: [] as FamilyNodeLink[] };
    const cfg = config;
    const ms = members;
    const fnNodes: FamilyNodeItem[] = [];
    const fnLinks: FamilyNodeLink[] = [];

    // Self family node (center)
    const selfMembers: FamilyNodeMember[] = [];
    const selfM = ms['self'];
    selfMembers.push({ name: selfM?.publicName || selfM?.name || data.owner?.name || 'Kepala Keluarga', photo: selfM?.photo || data.owner?.avatar || null, role: 'head' });
    for (let i = 0; i < cfg.spouseCount; i++) {
      const sp = ms[`spouse-${i}`];
      selfMembers.push({ name: sp?.publicName || sp?.name || 'Pasangan', photo: sp?.photo || null, role: 'spouse' });
    }
    for (let i = 0; i < cfg.childCount; i++) {
      const c = ms[`child-${i}`];
      selfMembers.push({ name: c?.publicName || c?.name || `Anak ${i + 1}`, photo: c?.photo || null, role: 'child' });
    }
    fnNodes.push({
      id: 'fn-self',
      name: data.name || 'Keluarga Kami',
      familyImage: data.familyImage,
      slug: slug,
      kind: 'self',
      memberCount: selfMembers.length,
      fnMembers: selfMembers,
      x: 0, y: 0,
    });

    // Parent family node (above)
    if (cfg.parentCount > 0) {
      const p0 = ms['parent-0'];
      const p1 = ms['parent-1'];
      const parentName = [p0?.publicName || p0?.name, p1?.publicName || p1?.name].filter(Boolean).join(' & ') || 'Keluarga Orang Tua';
      const parentMembers: FamilyNodeMember[] = [];
      if (p0) parentMembers.push({ name: p0.publicName || p0.name, photo: p0.photo || null, role: 'head' });
      if (p1) parentMembers.push({ name: p1.publicName || p1.name, photo: p1.photo || null, role: 'spouse' });
      fnNodes.push({
        id: 'fn-parent',
        name: `Keluarga ${parentName}`,
        familyImage: null,
        slug: null,
        kind: 'parent',
        fnMembers: parentMembers.length > 0 ? parentMembers : undefined,
        x: 0, y: -280,
      });
      fnLinks.push({ from: 'fn-self', to: 'fn-parent' });
    }

    // Older siblings (left)
    for (let i = 0; i < cfg.olderCount; i++) {
      const k = ms[`kakak-${i}`];
      const sibName = k?.publicName || k?.name || `Kakak ${i + 1}`;
      fnNodes.push({
        id: `fn-kakak-${i}`,
        name: `Keluarga ${sibName}`,
        familyImage: k?.photo || null,
        slug: null,
        kind: 'sibling',
        fnMembers: k ? [{ name: k.publicName || k.name, photo: k.photo || null, role: 'head' }] : undefined,
        x: -240 * (i + 1), y: 0,
      });
      fnLinks.push({ from: 'fn-self', to: `fn-kakak-${i}` });
    }

    // Younger siblings (right)
    for (let i = 0; i < cfg.youngerCount; i++) {
      const a = ms[`adik-${i}`];
      const sibName = a?.publicName || a?.name || `Adik ${i + 1}`;
      fnNodes.push({
        id: `fn-adik-${i}`,
        name: `Keluarga ${sibName}`,
        familyImage: a?.photo || null,
        slug: null,
        kind: 'sibling',
        fnMembers: a ? [{ name: a.publicName || a.name, photo: a.photo || null, role: 'head' }] : undefined,
        x: 240 * (i + 1), y: 0,
      });
      fnLinks.push({ from: 'fn-self', to: `fn-adik-${i}` });
    }

    // Children with spouses (below)
    const childNodes: FamilyNodeItem[] = [];
    for (let i = 0; i < cfg.childCount; i++) {
      const c = ms[`child-${i}`];
      const hasSpouse = c?.spouseId || ms[`child-${i}-spouse`];
      if (hasSpouse) {
        const childName = c?.publicName || c?.name || `Anak ${i + 1}`;
        const childMembers: FamilyNodeMember[] = [];
        if (c) childMembers.push({ name: c.publicName || c.name, photo: c.photo || null, role: 'head' });
        const spouseKey = c?.spouseId || `child-${i}-spouse`;
        const cs = ms[spouseKey];
        if (cs) childMembers.push({ name: cs.publicName || cs.name, photo: cs.photo || null, role: 'spouse' });
        childNodes.push({
          id: `fn-child-${i}`,
          name: `Keluarga ${childName}`,
          familyImage: c?.photo || null,
          slug: null,
          kind: 'child',
          fnMembers: childMembers.length > 0 ? childMembers : undefined,
          x: 0, y: 0,
        });
      }
    }
    const childSpread = 220;
    childNodes.forEach((n, idx) => {
      n.x = (idx - (childNodes.length - 1) / 2) * childSpread;
      n.y = 280;
      fnNodes.push(n);
      fnLinks.push({ from: 'fn-self', to: n.id });
    });

    return { nodes: fnNodes, links: fnLinks };
  }, [data, config, members, slug]);

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
    const rawName = id === 'self' ? (m?.name || data?.owner?.name || 'Anda') : (m?.name || fallback);
    const name = m?.publicName || rawName;
    const photo = id === 'self' ? (m?.photo || data?.owner?.avatar || null) : (m?.photo || null);
    return { name, photo, alive: m?.alive !== false, gender: m?.gender || '', verified: id === 'self' ? true : m?.verified, statusLabel: m?.statusLabel || null };
  };

  const onNodeClick = (node: TNode) => {
    // Self node with username → navigate to profile directly
    if (node.id === 'self' && data?.owner?.username) {
      router.push(`/family/${slug}/${data.owner.username}`);
      return;
    }
    // All other nodes → open unified modal
    setSelectedNode(node);
    setClaimError(null);
    setEaError('');
    setEaSuccess('');
    setEaOpen(false);
  };

  const closeModal = () => { setSelectedNode(null); setClaimError(null); setEaError(''); setEaSuccess(''); setEaOpen(false); setEaLoginError(''); };

  const confirmClaim = async () => {
    if (!selectedNode) return;
    if (!getTokens()?.accessToken) {
      savePendingClaim({ slug, nodeId: selectedNode.id });
      router.push(`/register?tree=${encodeURIComponent(slug)}&node=${encodeURIComponent(selectedNode.id)}`);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      await treeApi.claimNode(slug, selectedNode.id);
      const refreshed = await publicTreeApi.getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, getTokens()?.accessToken);
      setData(refreshed);
      closeModal();
    } catch (e: any) {
      setClaimError(e.message || 'Gagal mengklaim bagian ini');
    } finally {
      setClaiming(false);
    }
  };

  const handleEarlyAccess = async () => {
    if (!selectedNode) return;
    setEaError('');
    setEaSuccess('');
    if (!eaEmail || !eaPassword) { setEaError('Email dan password wajib diisi'); return; }
    if (eaPassword.length < 6) { setEaError('Password minimal 6 karakter'); return; }
    setEaLoading(true);
    try {
      const res = await treeApi.createEarlyAccessForNode(selectedNode.id, eaEmail, eaPassword, eaPhone || undefined);
      setEaSuccess(`Early access berhasil dibuat untuk ${res.user.email}`);
      const refreshed = await publicTreeApi.getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, getTokens()?.accessToken);
      setData(refreshed);
      setTimeout(() => closeModal(), 3000);
    } catch (e: any) {
      setEaError(e.message || 'Gagal membuat early access');
    } finally {
      setEaLoading(false);
    }
  };

  /**
   * Sign in as this node's early-access account. The super_user's own session
   * is replaced, so confirm first and send them straight to the profile form
   * they came to fill in.
   */
  const handleLoginEarlyAccess = async () => {
    if (!selectedNode) return;
    const tokens = getTokens();
    if (!tokens?.accessToken) { setEaLoginError('Sesi Anda berakhir, silakan masuk lagi'); return; }
    if (!confirm('Anda akan keluar dari akun Anda dan masuk sebagai anggota ini untuk melengkapi profilnya. Lanjutkan?')) return;
    setEaLoginError('');
    setEaLoginLoading(true);
    try {
      const res = await auth.loginAsEarlyAccess(tokens.accessToken, selectedNode.id, slug);
      saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      saveUser(res.user);
      router.push('/profile');
    } catch (e: any) {
      setEaLoginError(e.message || 'Gagal login early access');
    } finally {
      setEaLoginLoading(false);
    }
  };

  // Resolve member info for the selected node
  const selectedMember = selectedNode ? members[selectedNode.id] : null;
  const selectedResolved = selectedNode ? resolve(selectedNode.id, selectedNode.name) : null;
  const isVerifiedNode = selectedNode && selectedNode.id !== 'self' && (selectedMember?.verified || selectedMember?.linkedUserId);
  const isSelfNode = selectedNode?.id === 'self';
  // A node the super_user issued temporary credentials for — they may sign in
  // as this person to complete their profile.
  const isEarlyAccessNode = !!(selectedMember?.earlyAccess && selectedMember?.linkedUserId);

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
        <main className="flex-1 flex flex-col lg:flex-row relative">
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="fixed top-20 left-2 z-30 p-2 rounded-lg border border-white/10 bg-[#0a0a16]/90 backdrop-blur text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={sidebarOpen ? 'Sembunyikan info' : 'Tampilkan info'}
          >
            <PanelLeft size={18} />
          </button>

          {/* Left sidebar — cover + family info */}
          <aside
            className={`${
              sidebarOpen ? 'w-full lg:w-80 xl:w-96' : 'w-0'
            } shrink-0 overflow-hidden transition-all duration-300 border-r border-white/[0.06] bg-[#070712]`}
          >
            <div className="w-80 xl:w-96 h-full overflow-y-auto">
              {/* Cover image — 2:1 aspect ratio */}
              {data.coverImage ? (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2 / 1' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#070712]" />
                </div>
              ) : (
                <div className="w-full bg-gradient-to-b from-white/[0.03] to-transparent" style={{ aspectRatio: '2 / 1' }} />
              )}

              {/* Family info — left aligned, no family image */}
              <div className="px-5 py-4 text-left space-y-3">
                <p className="text-blue-400/80 text-[10px] font-medium uppercase tracking-wider">Silsilah Keluarga</p>
                <h1
                  className="text-2xl font-bold text-white tracking-tight leading-tight"
                  style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
                >
                  {data.name}
                </h1>

                {data.headName && (
                  <p className="text-white/50 text-sm">
                    Kepala Keluarga: <span className="text-white/70 font-medium">{data.headName}</span>
                  </p>
                )}

                {data.familyBio && (
                  <p className="text-white/45 text-sm leading-relaxed">{data.familyBio}</p>
                )}

                {data.description && !data.familyBio && (
                  <p className="text-white/45 text-sm leading-relaxed">{data.description}</p>
                )}

                {/* Marriage info */}
                {data.marriageStatus && data.marriageStatus !== 'NONE' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                    {data.marriageDate && (
                      <span>
                        Pernikahan: {new Date(data.marriageDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                      {data.marriageStatus === 'ONGOING' ? 'Berlangsung' :
                       data.marriageStatus === 'DIVORCED' ? 'Cerai Hidup' :
                       data.marriageStatus === 'WIDOWED' ? 'Cerai Mati' : data.marriageStatus}
                    </span>
                  </div>
                )}

                {data.owner && (
                  <div className="flex items-center gap-2 text-white/60 text-sm pt-2 border-t border-white/[0.06]">
                    {data.owner.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.owner.avatar} alt={data.owner.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
                    ) : null}
                    <span>Dikelola oleh {data.owner.name}</span>
                    {data.owner.username && (
                      <Link href={`/family/${slug}/${data.owner.username}`} className="inline-flex items-center gap-1 text-blue-400 hover:underline ml-auto">
                        Profil <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* CTA — Bagian dari keluarga ini? */}
              <div className="px-5 pb-5 pt-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <h2 className="text-white font-semibold text-sm mb-1">Bagian dari keluarga ini?</h2>
                  <p className="text-white/45 text-xs mb-3 leading-relaxed">Gabung untuk melengkapi profil Anda dan menjaga silsilah tetap hidup.</p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Bergabung di digsan.id <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Right — tree + CTA */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Invited-member banner */}
            {highlightId && (
              <div className="px-6 pt-3 mb-1">
                <div className="max-w-md rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-center">
                  <p className="text-amber-200 text-sm">Anda diundang — bagian Anda ditandai <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 align-middle" /> pada silsilah di bawah.</p>
                </div>
              </div>
            )}

            {/* Tree */}
            <section className="px-2 sm:px-4 pb-8 flex-1">
              {viewMode === 'familynode' ? (
                <FamilyNodeTreeCanvas
                  nodes={familyNodeTree.nodes}
                  links={familyNodeTree.links}
                  onNodeClick={(fn) => {
                    if (fn.slug && fn.slug !== slug) {
                      router.push(`/family/${fn.slug}`);
                    }
                  }}
                  onBack={() => setViewMode('member')}
                  className="w-full h-[70vh] min-h-[420px] max-h-[720px] rounded-2xl border border-white/[0.06] bg-white/[0.01]"
                />
              ) : nodes.length ? (
                <PublicTreeCanvas
                  nodes={nodes}
                  lines={lines}
                  resolve={resolve}
                  onNodeClick={onNodeClick}
                  onGroupClick={(n) => {
                    if (n.id === 'grp-kb') {
                      setViewMode('familynode');
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
              {viewMode === 'familynode' ? (
                <p className="text-center text-white/25 text-xs mt-2">
                  Klik lingkaran untuk membuka halaman keluarga. Klik "Mode Familymember" untuk kembali.
                </p>
              ) : nodes.length ? (
                <p className="text-center text-white/25 text-xs mt-2">
                  Geser untuk menjelajah, gulir/pinch untuk memperbesar. Lingkaran bergaris putus-putus belum diklaim.
                </p>
              ) : null}
            </section>
          </div>
        </main>
      ) : null}

      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>

      {/* Unified node modal — membercard for verified, claim+early access for unclaimed */}
      {selectedNode && selectedResolved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a16] p-6 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              aria-label="Tutup"
              className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Photo / avatar */}
            {selectedResolved.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedResolved.photo} alt={selectedResolved.name} referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border-2 border-white/10">
                <Users size={28} className="text-white/30" />
              </div>
            )}

            {/* View 1: Membercard for verified/active nodes */}
            {(isVerifiedNode || isSelfNode) && (
              <>
                {isVerifiedNode && (
                  <div className="inline-flex items-center gap-1 text-emerald-400 text-xs mb-1">
                    <BadgeCheck size={14} /> Terverifikasi
                  </div>
                )}
                <h3 className="text-white font-semibold text-lg mb-1">{selectedResolved.name}</h3>
                <p className="text-white/40 text-xs mb-3">{selectedResolved.statusLabel || selectedNode.role}</p>
                <div className="grid grid-cols-2 gap-2 text-left mb-4">
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-white/30 text-[10px] uppercase">Jenis Kelamin</p>
                    <p className="text-white/70 text-sm">{selectedResolved.gender === 'L' ? 'Laki-laki' : selectedResolved.gender === 'P' ? 'Perempuan' : '—'}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-white/30 text-[10px] uppercase">Status</p>
                    <p className="text-white/70 text-sm">{selectedResolved.alive ? 'Hidup' : 'Meninggal'}</p>
                  </div>
                  {selectedMember?.email && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 col-span-2">
                      <p className="text-white/30 text-[10px] uppercase">Email</p>
                      <p className="text-white/70 text-sm truncate">{selectedMember.email}</p>
                    </div>
                  )}
                  {selectedMember?.phone && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 col-span-2">
                      <p className="text-white/30 text-[10px] uppercase">No. HP</p>
                      <p className="text-white/70 text-sm">{selectedMember.phone}</p>
                    </div>
                  )}
                </div>
                {isSelfNode && data?.owner?.username && (
                  <button
                    onClick={() => data?.owner?.username && router.push(`/family/${slug}/${data.owner.username}`)}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Lihat Profil Lengkap
                  </button>
                )}

                {/* Early-access members get their own public profile page */}
                {!isSelfNode && selectedMember?.username && (
                  <button
                    onClick={() => router.push(`/family/${slug}/${selectedMember.username}`)}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Lihat Profil Publik
                  </button>
                )}

                {/* Sign in as this member to complete their profile — super_user only */}
                {isSuperUser && isEarlyAccessNode && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    {eaLoginError && <p className="text-xs text-red-400 mb-2">{eaLoginError}</p>}
                    <button
                      onClick={handleLoginEarlyAccess}
                      disabled={eaLoginLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black transition-colors"
                    >
                      <LogIn size={15} />
                      {eaLoginLoading ? 'Masuk…' : 'Login Early Access'}
                    </button>
                    <p className="text-white/35 text-[11px] mt-2 leading-relaxed">
                      Anda akan masuk sebagai anggota ini untuk melengkapi profilnya. Sesi Anda saat ini akan digantikan.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* View 2: Claim + Early Access for unclaimed nodes */}
            {!isVerifiedNode && !isSelfNode && (
              <>
                <h3 className="text-white font-semibold text-lg mb-1">
                  Apakah ini <span className="text-blue-400">{selectedResolved.name}</span>?
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
                    onClick={closeModal}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                  >
                    Bukan saya
                  </button>
                </div>

                {/* Early Access — super_user only */}
                {isSuperUser && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-left">
                    <button
                      type="button"
                      onClick={() => setEaOpen((v) => !v)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound size={16} className="text-amber-400" />
                        <span className="text-sm font-medium text-amber-400">Buat Early Access</span>
                      </div>
                      <span className="text-amber-400 text-xs">{eaOpen ? '▲' : '▼'}</span>
                    </button>
                    {eaOpen && (
                      <div className="mt-3 space-y-2">
                        {eaError && <p className="text-xs text-red-400">{eaError}</p>}
                        {eaSuccess && <p className="text-xs text-emerald-400">{eaSuccess}</p>}
                        <input
                          type="email"
                          placeholder="Email"
                          value={eaEmail}
                          onChange={(e) => setEaEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <input
                          type="password"
                          placeholder="Password (min. 6 karakter)"
                          value={eaPassword}
                          onChange={(e) => setEaPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <input
                          type="tel"
                          placeholder="No. HP (opsional)"
                          value={eaPhone}
                          onChange={(e) => setEaPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <button
                          type="button"
                          onClick={handleEarlyAccess}
                          disabled={eaLoading}
                          className="w-full py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                        >
                          {eaLoading ? 'Membuat…' : 'Buat Early Access'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
