'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getUser } from '@/lib/auth';
import { treeApi } from '@/lib/tree';
import type { GuardianConsent, ConnectedFamily } from '@/lib/tree';
import { useTheme } from './ThemeProvider';
import type { Group, TNode, Poly, TreeConfig, Member, Members } from './treeTypes';
import { DEFAULT_CONFIG } from './treeTypes';
import { configToGraph, layoutGraph } from './familyGraph';
import { AdSpotBanner } from './AdSpotBanner';
import { STYLE, OX, OY } from './treeStyle';
import InvitationStudio from './InvitationStudio';
import type { Region } from './InvitationStudio';
import OnboardingModal from './OnboardingModal';
import {
  Plus, Minus, Maximize2, Network, X, User, Settings,
  Share2, Upload, Check, Crop, Users, Link2, ExternalLink, Search, RefreshCw,
} from 'lucide-react';

// ─── Styling per group ──────────────────────────────────────

const ANCESTORS = ['Buyut', 'Canggah', 'Wareng', 'Udheg-udheg', 'Gantung Siwur', 'Gropak Senthe'];

// ─── Geometry helpers ───────────────────────────────────────

const spread = (count: number, gap: number, cx: number): number[] => {
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

// ─── Full (expanded) tree generation ────────────────────────

function generateTree(cfg: TreeConfig): { nodes: TNode[]; lines: Poly[] } {
  const nodes: TNode[] = [];
  const lines: Poly[] = [];

  // Self + spouses (y = 0)
  const coupleXs = spread(1 + cfg.spouseCount, 160, 0);
  const selfX = coupleXs[0];
  nodes.push({ id: 'self', name: 'Anda', role: 'Diri Sendiri', x: selfX, y: 0, group: 'self' });
  for (let i = 0; i < cfg.spouseCount; i++) {
    nodes.push({ id: `spouse-${i}`, name: cfg.spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', role: 'Suami / Istri', x: coupleXs[i + 1], y: 0, group: 'spouse' });
    lines.push({ points: [[selfX, 0], [coupleXs[i + 1], 0]], marriage: true });
  }
  const coupleMid = coupleXs.reduce((a, b) => a + b, 0) / coupleXs.length;
  const leftEdge = Math.min(...coupleXs);
  const rightEdge = Math.max(...coupleXs);

  // Children (y = 210)
  const childXs = spread(cfg.childCount, 150, coupleMid);
  childXs.forEach((x, i) => nodes.push({ id: `child-${i}`, name: `Anak ${i + 1}`, role: 'Keturunan', x, y: 210, group: 'child' }));
  connectDown(lines, coupleMid, 0, childXs, 210);

  // Siblings (y = 0)
  const olderXs: number[] = [];
  for (let i = 0; i < cfg.olderCount; i++) {
    const x = leftEdge - 150 * (i + 1);
    olderXs.push(x);
    nodes.push({ id: `older-${i}`, name: `Kakak ${i + 1}`, role: 'Saudara Tua', x, y: 0, group: 'kakak' });
  }
  const youngerXs: number[] = [];
  for (let i = 0; i < cfg.youngerCount; i++) {
    const x = rightEdge + 150 * (i + 1);
    youngerXs.push(x);
    nodes.push({ id: `younger-${i}`, name: `Adik ${i + 1}`, role: 'Saudara Muda', x, y: 0, group: 'adik' });
  }

  // Parents (y = -210)
  const parentXs = spread(cfg.parentCount, 160, 0);
  const parentLabels = cfg.parentCount === 2 ? ['Ayah', 'Ibu'] : parentXs.map((_, i) => `Orang Tua ${i + 1}`);
  parentXs.forEach((x, i) => nodes.push({ id: `parent-${i}`, name: parentLabels[i], role: 'Orang Tua', x, y: -210, group: 'parent' }));
  if (cfg.parentCount >= 2) lines.push({ points: [[parentXs[0], -210], [parentXs[parentXs.length - 1], -210]], marriage: true });
  const parentMid = parentXs.length ? parentXs.reduce((a, b) => a + b, 0) / parentXs.length : 0;
  const parentKids = [...olderXs, selfX, ...youngerXs];
  if (cfg.parentCount > 0) connectDown(lines, parentMid, -210, parentKids, 0);

  // Grandparents (Simbah, y = -420) + ancestral chains
  const buildAncestors = (side: 'P' | 'M', centerX: number) => {
    let prevY = -420;
    ANCESTORS.forEach((label, i) => {
      const y = -580 - i * 150;
      nodes.push({ id: `anc${side}-${i}`, name: label, role: `Leluhur — ${label}`, x: centerX, y, group: 'ancestor' });
      lines.push({ points: [[centerX, prevY], [centerX, y]] });
      prevY = y;
    });
  };

  const pCenter = -300, mCenter = 300;
  if (cfg.simbahP > 0) {
    const xs = spread(cfg.simbahP, 150, pCenter);
    const labels = cfg.simbahP === 2 ? ['Kakek', 'Nenek'] : xs.map((_, i) => `Simbah Ayah ${i + 1}`);
    xs.forEach((x, i) => nodes.push({ id: `gpP-${i}`, name: labels[i], role: 'Simbah (dari Ayah)', x, y: -420, group: 'grandparent' }));
    if (cfg.simbahP >= 2) lines.push({ points: [[xs[0], -420], [xs[xs.length - 1], -420]], marriage: true });
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (parentXs[0] !== undefined) connectDown(lines, mid, -420, [parentXs[0]], -210);
    buildAncestors('P', pCenter);
  }
  if (cfg.simbahM > 0) {
    const xs = spread(cfg.simbahM, 150, mCenter);
    const labels = cfg.simbahM === 2 ? ['Kakek', 'Nenek'] : xs.map((_, i) => `Simbah Ibu ${i + 1}`);
    xs.forEach((x, i) => nodes.push({ id: `gpM-${i}`, name: labels[i], role: 'Simbah (dari Ibu)', x, y: -420, group: 'grandparent' }));
    if (cfg.simbahM >= 2) lines.push({ points: [[xs[0], -420], [xs[xs.length - 1], -420]], marriage: true });
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    const ibuX = parentXs[parentXs.length - 1];
    if (ibuX !== undefined) connectDown(lines, mid, -420, [ibuX], -210);
    buildAncestors('M', mCenter);
  }

  return { nodes, lines };
}

// ─── Collapsed (homepage-like) generation ───────────────────

function generateCollapsed(cfg: TreeConfig): { nodes: TNode[]; lines: Poly[] } {
  const nodes: TNode[] = [];
  const lines: Poly[] = [];
  const coupleXs = spread(1 + cfg.spouseCount, 150, 0);
  nodes.push({ id: 'self', name: 'Anda', role: 'Diri Sendiri', x: coupleXs[0], y: 0, group: 'self' });
  for (let i = 0; i < cfg.spouseCount; i++) {
    nodes.push({ id: `spouse-${i}`, name: cfg.spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', role: 'Suami / Istri', x: coupleXs[i + 1], y: 0, group: 'spouse' });
    lines.push({ points: [[coupleXs[0], 0], [coupleXs[i + 1], 0]], marriage: true });
  }
  const bubbles: TNode[] = [];
  if (cfg.parentCount > 0) bubbles.push({ id: 'grp-ot', name: 'Orang Tua', role: 'group', x: 0, y: -235, group: 'parent', count: cfg.parentCount });
  if (cfg.olderCount > 0) bubbles.push({ id: 'grp-kk', name: 'Kakak', role: 'group', x: -235, y: 0, group: 'kakak', count: cfg.olderCount });
  if (cfg.youngerCount > 0) bubbles.push({ id: 'grp-ad', name: 'Adik', role: 'group', x: 235, y: 0, group: 'adik', count: cfg.youngerCount });
  bubbles.forEach((b) => { nodes.push(b); lines.push({ points: [[0, 0], [b.x, b.y]] }); });

  // Children — always shown individually (part of main family)
  const coupleMid = coupleXs.reduce((a, b) => a + b, 0) / coupleXs.length;
  const childXs = spread(cfg.childCount, 130, coupleMid);
  childXs.forEach((x, i) => nodes.push({ id: `child-${i}`, name: `Anak ${i + 1}`, role: 'Keturunan', x, y: 210, group: 'child' }));
  connectDown(lines, coupleMid, 0, childXs, 210);

  return { nodes, lines };
}

const CLAMP = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ─── Guardianship logic ───────────────────────────────────────

function canEditMember(
  nodeId: string,
  nodeGroup: Group,
  members: Members,
  config: TreeConfig,
  currentUserId: string
): boolean {
  const m = members[nodeId];
  if (!m || m.alive) return true; // alive members can be edited
  if (nodeId === 'self') return true; // self can always edit

  // Deceased members: check guardianship
  if (nodeGroup === 'parent') {
    // Deceased parent: spouse or verified children can edit
    const isSpouse = nodeId === 'parent-0' || nodeId === 'parent-1';
    if (isSpouse) {
      // Placeholder: assume current user is spouse if not a child
      // In real app, check spouse relationship
      return true;
    }
    // Check if current user is a verified child
    for (let i = 0; i < config.childCount; i++) {
      const childId = `child-${i}`;
      const child = members[childId];
      if (child && child.verified && childId === currentUserId) return true;
    }
    return false;
  }

  if (nodeGroup === 'spouse') {
    // Deceased spouse: user or verified children can edit
    if (currentUserId === 'self') return true; // user is the owner
    for (let i = 0; i < config.childCount; i++) {
      const childId = `child-${i}`;
      const child = members[childId];
      if (child && child.verified && childId === currentUserId) return true;
    }
    return false;
  }

  if (nodeGroup === 'child') {
    // Deceased child: user (parent) or verified siblings can edit
    if (currentUserId === 'self') return true; // user is the parent
    // Check if current user is a verified sibling
    for (let i = 0; i < config.olderCount; i++) {
      const siblingId = `older-${i}`;
      const sibling = members[siblingId];
      if (sibling && sibling.verified && siblingId === currentUserId) return true;
    }
    for (let i = 0; i < config.youngerCount; i++) {
      const siblingId = `younger-${i}`;
      const sibling = members[siblingId];
      if (sibling && sibling.verified && siblingId === currentUserId) return true;
    }
    return false;
  }

  return true; // other groups (grandparent, ancestor, kakak, adik) freely editable
}

// ─── Component ──────────────────────────────────────────────

export default function TreeExplorer() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [me, setMe] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [identity, setIdentity] = useState<{ slug: string | null; username: string | null }>({ slug: null, username: null });
  const [isTreeOwner, setIsTreeOwner] = useState(true);
  const [connectedFamily, setConnectedFamily] = useState<ConnectedFamily | null>(null);
  const [config, setConfig] = useState<TreeConfig>(DEFAULT_CONFIG);
  const [members, setMembers] = useState<Members>({});
  const [consents, setConsents] = useState<GuardianConsent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [panel, setPanel] = useState<'none' | 'setup' | 'member'>('none');
  const [selected, setSelected] = useState<TNode | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [inviteCtx, setInviteCtx] = useState<{ nodeId: string; name: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);
  const [studioRegion, setStudioRegion] = useState<Region | null>(null);
  const [studioHighlight, setStudioHighlight] = useState<string[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const uidRef = useRef('guest');

  // Load persisted data — localStorage first (fast/offline cache), then
  // reconcile with the server (source of truth) so data syncs across devices.
  useEffect(() => {
    const u = getUser();
    const uid = u?.id || 'guest';
    uidRef.current = uid;
    if (u) setMe({ id: uid, name: u.name, avatar: u.avatar });

    let hadLocalConfig = false;
    try {
      const c = localStorage.getItem(`digsan_tree_cfg_${uid}`);
      if (c) { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(c) }); hadLocalConfig = true; }
      const m = localStorage.getItem(`digsan_tree_mem_${uid}`);
      if (m) setMembers(JSON.parse(m));
    } catch { /* ignore */ }

    // Only authenticated users can sync with the server.
    if (!u) {
      if (!hadLocalConfig) setPanel('setup');
      return;
    }

    // Authenticated user with no config → show onboarding modal
    if (!hadLocalConfig) setShowOnboarding(true);

    let cancelled = false;
    (async () => {
      try {
        const remote = await treeApi.getLayout<Partial<TreeConfig>, Members>();
        if (cancelled) return;

        setIdentity({ slug: remote.slug, username: remote.owner?.username ?? null });
        setIsTreeOwner(remote.isTreeOwner !== false);
        setConnectedFamily(remote.connectedFamily ?? null);

        if (remote.config) {
          const merged = { ...DEFAULT_CONFIG, ...remote.config };
          setConfig(merged);
          try { localStorage.setItem(`digsan_tree_cfg_${uid}`, JSON.stringify(merged)); } catch { /* ignore */ }
        }
        if (remote.members) {
          setMembers(remote.members);
          try { localStorage.setItem(`digsan_tree_mem_${uid}`, JSON.stringify(remote.members)); } catch { /* ignore */ }
        }

        // Load guardianship consents (ignore failure — feature is optional).
        try {
          const cs = await treeApi.getConsents();
          if (!cancelled) setConsents(cs);
        } catch { /* ignore */ }

        // No config anywhere → prompt setup.
        if (!remote.config && !hadLocalConfig) {
          setShowOnboarding(true);
          setPanel('setup');
        }

        // Local data existed but server had none → push local up so it syncs.
        if (!remote.config && hadLocalConfig) {
          try {
            const c = localStorage.getItem(`digsan_tree_cfg_${uid}`);
            const m = localStorage.getItem(`digsan_tree_mem_${uid}`);
            await treeApi.saveLayout({
              config: c ? JSON.parse(c) : undefined,
              members: m ? JSON.parse(m) : undefined,
            });
          } catch { /* ignore */ }
        }
      } catch {
        // Offline or API error → fall back to local cache.
        if (!cancelled && !hadLocalConfig) {
          setShowOnboarding(true);
          setPanel('setup');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // If the self panel is opened but we still lack a slug (e.g. the initial load
  // raced with auth or failed), fetch it so the public-link menu can activate.
  useEffect(() => {
    if (panel === 'member' && selected?.id === 'self' && !identity.slug && uidRef.current !== 'guest') {
      treeApi.getLayout<Partial<TreeConfig>, Members>()
        .then((res) => setIdentity({ slug: res.slug, username: res.owner?.username ?? null }))
        .catch(() => { /* ignore */ });
    }
  }, [panel, selected, identity.slug]);

  const pushLayout = (payload: { config?: TreeConfig; members?: Members }) => {
    if (uidRef.current === 'guest') return; // only sync for logged-in users
    treeApi.saveLayout(payload)
      // The server generates/returns the family slug + owner username here, so
      // refresh identity to activate the public link without needing a reload.
      .then((res) => setIdentity({ slug: res.slug, username: res.owner?.username ?? null }))
      .catch(() => { /* keep local cache; will retry on next save */ });
  };

  const saveConfig = (c: TreeConfig) => {
    setConfig(c);
    try { localStorage.setItem(`digsan_tree_cfg_${uidRef.current}`, JSON.stringify(c)); } catch { /* ignore */ }
    pushLayout({ config: c });
  };
  const saveMembers = (m: Members) => {
    setMembers(m);
    try { localStorage.setItem(`digsan_tree_mem_${uidRef.current}`, JSON.stringify(m)); } catch { /* ignore */ }
    pushLayout({ members: m });
  };

  const consentFor = (nodeId: string) => consents.find((c) => c.nodeId === nodeId);

  const requestConsent = async (nodeId: string) => {
    if (uidRef.current === 'guest') return;
    try {
      const created = await treeApi.requestConsent({ nodeId });
      setConsents((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    } catch { /* surfaced via disabled state; ignore */ }
  };

  const revokeConsent = async (consentId: string) => {
    if (uidRef.current === 'guest') return;
    try {
      const updated = await treeApi.revokeConsent(consentId);
      setConsents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch { /* ignore */ }
  };

  const { nodes, lines } = useMemo(() => {
    if (!config.configured) {
      return { nodes: [{ id: 'self', name: 'Anda', role: 'Diri Sendiri', x: 0, y: 0, group: 'self' as Group }], lines: [] as Poly[] };
    }
    if (expanded) {
      return layoutGraph(configToGraph(config, members, me?.name || 'Anda'));
    }
    return generateCollapsed(config);
  }, [config, expanded, members, me]);

  // Display helper (applies member overrides)
  const disp = (id: string, fallback: string) => {
    const m = members[id];
    const name = id === 'self' ? (m?.name || me?.name || 'Anda') : (m?.name || fallback);
    const photo = id === 'self' ? (m?.photo || me?.avatar || null) : (m?.photo || null);
    return { name, photo, alive: m?.alive !== false, gender: m?.gender || '' };
  };

  // Wheel zoom
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => CLAMP(z * (e.deltaY < 0 ? 1.12 : 0.89), 0.2, 2));
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  // Convert a screen (client) point to tree coordinates given current pan/zoom.
  const toTree = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) - rect.width / 2 - pan.x) / zoom,
      y: ((clientY - rect.top) - rect.height / 2 - pan.y) / zoom,
    };
  };

  const finalizeMarquee = () => {
    const m = marquee;
    marqueeRef.current = null;
    setMarquee(null);
    setSelectMode(false);
    if (!m) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Ignore tiny selections (treat as a click).
    if (Math.abs(m.ex - m.sx) < 12 || Math.abs(m.ey - m.sy) < 12) return;
    const a = toTree(rect.left + m.sx, rect.top + m.sy);
    const b = toTree(rect.left + m.ex, rect.top + m.ey);
    const region: Region = {
      minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
    };
    const highlight = nodes
      .filter((n) => n.role !== 'group' && n.x >= region.minX && n.x <= region.maxX && n.y >= region.minY && n.y <= region.maxY)
      .map((n) => n.id);
    setStudioRegion(region);
    setStudioHighlight(highlight);
    setShowStudio(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (selectMode) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      marqueeRef.current = { sx, sy };
      setMarquee({ sx, sy, ex: sx, ey: sy });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    drag.current = { ox: pan.x, oy: pan.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (selectMode) {
      if (!marqueeRef.current) return;
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMarquee({ ...marqueeRef.current, ex: e.clientX - rect.left, ey: e.clientY - rect.top });
      return;
    }
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    panRef.current = { x: nx, y: ny };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPan(panRef.current);
      });
    }
  };
  const onPointerUp = () => {
    if (selectMode) { finalizeMarquee(); return; }
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (drag.current) setPan(panRef.current);
    drag.current = null;
  };

  const doExpand = () => { setExpanded(true); setZoom(0.42); panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }); };
  const doCollapse = () => { setExpanded(false); setZoom(1); panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }); };
  const reset = () => { setZoom(expanded ? 0.42 : 1); panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }); };

  const clickNode = (n: TNode) => {
    if (n.role === 'group') { doExpand(); return; }
    const d = disp(n.id, n.name);
    setSelected({ ...n, name: d.name });
    setPanel('member');
  };

  const strokeMarriage = dark ? 'rgba(147,197,253,0.55)' : 'rgba(37,99,235,0.45)';
  const strokeNormal = dark ? 'rgba(255,255,255,0.22)' : 'rgba(51,65,85,0.28)';

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-100 dark:bg-[#05050f]">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap gap-2 sm:flex-nowrap sm:right-auto">
        {config.configured && (
          <button onClick={expanded ? doCollapse : doExpand}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg whitespace-nowrap">
            <Network size={15} />{expanded ? 'Tutup' : 'Expand'}
          </button>
        )}
        <button onClick={() => { setPanel('setup'); setSelected(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg whitespace-nowrap
            bg-white text-slate-700 hover:bg-slate-50 border border-slate-200
            dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/15">
          <Settings size={15} />Pengaturan
        </button>
        {config.configured && (
          <button onClick={() => { setStudioRegion(null); setStudioHighlight([]); setShowStudio(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg whitespace-nowrap
              bg-white text-slate-700 hover:bg-slate-50 border border-slate-200
              dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/15">
            <Share2 size={15} />Undang
          </button>
        )}
        {config.configured && (
          <button onClick={() => setSelectMode((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg border whitespace-nowrap ${
              selectMode
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-400'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/15'
            }`}>
            <Crop size={15} />{selectMode ? 'Batal' : 'Pilih'}
          </button>
        )}
      </div>

      {/* Left-Tree Ad Banners */}
      <div className="absolute top-16 left-3 z-20 w-44 space-y-2">
        <AdSpotBanner spotKey="tree-l-r1/1-01" />
        <AdSpotBanner spotKey="tree-l-r1/1-02" />
        <AdSpotBanner spotKey="tree-l-r1/1-03" />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-1.5 p-1.5 rounded-2xl backdrop-blur
        bg-white border border-slate-200 shadow-lg
        dark:bg-white/5 dark:border-white/10 dark:shadow-none">
        <button onClick={() => setZoom((z) => CLAMP(z * 1.15, 0.2, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perbesar"><Plus size={16} /></button>
        <button onClick={reset} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Reset"><Maximize2 size={15} /></button>
        <button onClick={() => setZoom((z) => CLAMP(z * 0.87, 0.2, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perkecil"><Minus size={16} /></button>
      </div>

      <div className="absolute top-3 right-3 z-20 text-[11px] text-slate-400 dark:text-white/35 hidden sm:block">Zoom {Math.round(zoom * 100)}% • seret untuk geser</div>

      {!config.configured && (
        <div className="absolute inset-x-0 top-24 z-20 flex justify-center pointer-events-none">
          <p className="px-4 py-2 rounded-full text-sm bg-white/90 text-slate-600 border border-slate-200 shadow dark:bg-white/10 dark:text-white/70 dark:border-white/10">
            Atur bagan keluarga Anda melalui tombol <b>Pengaturan</b>
          </p>
        </div>
      )}

      {selectMode && (
        <div className="absolute inset-x-0 top-16 z-30 flex justify-center pointer-events-none">
          <p className="px-4 py-2 rounded-full text-sm bg-amber-500 text-white shadow-lg">
            Seret untuk memilih area & menyorot lingkaran yang perlu dilengkapi
          </p>
        </div>
      )}

      {/* Viewport */}
      <div ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        className={`absolute inset-0 ${selectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ touchAction: 'none' }}>
        {selectMode && marquee && (
          <div className="absolute z-20 border-2 border-amber-400 bg-amber-400/15 rounded pointer-events-none"
            style={{
              left: Math.min(marquee.sx, marquee.ex),
              top: Math.min(marquee.sy, marquee.ey),
              width: Math.abs(marquee.ex - marquee.sx),
              height: Math.abs(marquee.ey - marquee.sy),
            }} />
        )}
        <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: drag.current ? 'none' : 'transform 0.3s ease' }}>
          <svg width={OX * 2} height={OY * 2} viewBox={`0 0 ${OX * 2} ${OY * 2}`} style={{ position: 'absolute', left: -OX, top: -OY, overflow: 'visible', pointerEvents: 'none' }}>
            {lines.map((l, i) => (
              <polyline key={i} points={l.points.map(([x, y]) => `${x + OX},${y + OY}`).join(' ')} fill="none"
                stroke={l.marriage ? strokeMarriage : strokeNormal} strokeWidth={l.marriage ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>

          {nodes.map((n) => {
            const st = STYLE[n.group];
            const isSelf = n.id === 'self';
            const isGroup = n.role === 'group';
            const isSelected = panel === 'member' && selected?.id === n.id;
            const baseSize = isSelf && !expanded ? 150 : st.size;
            const size = isSelected ? Math.round(baseSize * 1.35) : baseSize;
            const d = isGroup ? null : disp(n.id, n.name);
            return (
              <div key={n.id} className="group absolute"
                style={{ left: n.x, top: n.y, transform: 'translate(-50%,-50%)', zIndex: isSelected ? 20 : 1 }}>
                <button data-node onClick={() => clickNode(n)}
                  className="family-node relative flex items-center justify-center rounded-full border text-white overflow-hidden"
                  style={{
                    width: size, height: size,
                    background: st.bg, borderColor: st.border,
                    boxShadow: isSelected
                      ? `0 0 0 4px ${st.border}, 0 0 34px 6px ${st.border}, 0 10px 30px rgba(0,0,0,0.35)`
                      : `0 0 18px ${st.border}`,
                    opacity: d && !d.alive ? 0.55 : 1,
                    transition: drag.current ? 'none' : 'width 0.3s ease, height 0.3s ease, box-shadow 0.3s ease',
                  }}>
                  {isSelf && d?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo} alt={d.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : d?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo} alt={d.name} className="w-full h-full object-cover" />
                  ) : isSelf ? (
                    <User size={size * 0.4} className="text-white/85" />
                  ) : (
                    <span className="px-1 text-center leading-tight font-semibold" style={{ fontSize: Math.max(9, size * 0.15) }}>
                      {isGroup ? <>{n.name}<br /><span className="opacity-70">×{n.count}</span></> : d?.name}
                    </span>
                  )}
                  {d && !d.alive && (
                    <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-slate-800 text-white text-[9px] flex items-center justify-center border border-white/40">&dagger;</span>
                  )}
                </button>

                {/* Name + role label — shown on hover/selected for nodes whose photo hides the name */}
                {!isGroup && d?.photo && (
                  <span
                    className={`pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -mt-1 z-30 inline-block max-w-[180px] truncate whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-md border transition-opacity duration-200
                      bg-white/80 text-slate-800 border-slate-200
                      dark:bg-black/55 dark:text-white dark:border-white/20
                      ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {d.name}
                    {n.group === 'spouse' && d.gender && (
                      <span className="block text-[10px] opacity-70 mt-0.5">
                        {d.gender === 'P' ? 'Istri' : 'Suami'}
                      </span>
                    )}
                  </span>
                )}
                {/* Spouse role label for nodes without photo (name is inside circle) */}
                {!isGroup && n.group === 'spouse' && !d?.photo && d?.gender && (
                  <span
                    className={`pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 z-30 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm border transition-opacity duration-200
                      bg-white/80 text-slate-600 border-slate-200
                      dark:bg-black/55 dark:text-white/70 dark:border-white/15
                      ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {d.gender === 'P' ? 'Istri' : 'Suami'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar */}
      <div className={`absolute top-0 right-0 h-full w-[360px] max-w-[90vw] z-40 transition-transform duration-300 backdrop-blur-xl
        border-l bg-white/97 border-slate-200 dark:bg-[#0a0e1a]/97 dark:border-white/10
        ${panel !== 'none' ? 'translate-x-0' : 'translate-x-full'}`}>
        {panel === 'setup' && (
          <SetupForm dark={dark} initial={config} isTreeOwner={isTreeOwner} connectedFamily={connectedFamily}
            familySlug={identity.slug}
            onClose={() => setPanel('none')}
            onSave={(c) => { saveConfig({ ...c, configured: true }); setPanel('none'); setExpanded(false); }} />
        )}
        {panel === 'member' && selected && (
          <MemberForm key={selected.id} dark={dark} node={selected} isSelf={selected.id === 'self'}
            familySlug={identity.slug} ownerUsername={identity.username}
            member={members[selected.id]} defaultName={selected.name} accountName={me?.name}
            canEdit={canEditMember(selected.id, selected.group, members, config, me?.id || 'guest')}
            connectedFamily={connectedFamily}
            consent={consentFor(selected.id)}
            onRequestConsent={() => requestConsent(selected.id)}
            onRevokeConsent={(id) => revokeConsent(id)}
            onSetSlug={async (slug) => {
              try {
                const res = await treeApi.setSlug(slug);
                setIdentity({ slug: res.slug, username: res.owner?.username ?? null });
              } catch (err) { console.error('setSlug failed:', err); }
            }}
            onOpenInvite={() => {
              const nm = disp(selected.id, selected.name).name;
              setInviteCtx({ nodeId: selected.id, name: nm });
              setStudioRegion(null);
              setStudioHighlight([selected.id]);
              setShowStudio(true);
              setPanel('none');
            }}
            onClose={() => setPanel('none')}
            onSave={(m) => { saveMembers({ ...members, [selected.id]: m }); setPanel('none'); }} />
        )}
      </div>

      <InvitationStudio
        open={showStudio}
        onClose={() => { setShowStudio(false); setInviteCtx(null); }}
        dark={dark}
        nodes={nodes.map((n) => (n.role === 'group' ? n : { ...n, name: disp(n.id, n.name).name }))}
        lines={lines}
        palette={STYLE}
        aliveOf={(id) => members[id]?.alive !== false}
        photoOf={(id) => disp(id, '').photo}
        inviterName={me?.name || 'Saya'}
        inviteeName={inviteCtx?.name}
        onSendEmail={async (email, msg) => { await treeApi.inviteByEmail({ email, message: msg, nodeId: inviteCtx?.nodeId }); }}
        treeName={config.mainFamilyName}
        familyUrl={(() => {
          if (!identity.slug) return undefined;
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.digsan.id';
          const base = `${origin}/family/${identity.slug}`;
          // Invited a specific member → deep-link to that person on the public tree.
          if (inviteCtx?.nodeId && inviteCtx.nodeId !== 'self') return `${base}?m=${encodeURIComponent(inviteCtx.nodeId)}`;
          // Owner / self share → link to the owner's public profile (nama-keluarga/nama-user).
          if (identity.username) return `${base}/${identity.username}`;
          return base;
        })()}
        region={studioRegion}
        highlightIds={studioHighlight}
      />

      {showOnboarding && (
        <OnboardingModal
          dark={dark}
          onComplete={(c) => {
            saveConfig(c);
            setShowOnboarding(false);
            setPanel('none');
            setExpanded(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Setup form ─────────────────────────────────────────────

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-sm text-slate-600 dark:text-white/70">{label}</label>
      <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/15 overflow-hidden">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10"><Minus size={13} /></button>
        <input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-12 h-8 text-center text-sm bg-transparent text-slate-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        <button type="button" onClick={() => onChange(value + 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10"><Plus size={13} /></button>
      </div>
    </div>
  );
}

function SetupForm({ initial, isTreeOwner, connectedFamily, familySlug, onSave, onClose }: { dark: boolean; initial: TreeConfig; isTreeOwner: boolean; connectedFamily: ConnectedFamily | null; familySlug: string | null; onSave: (c: TreeConfig) => void; onClose: () => void }) {
  const [c, setC] = useState<TreeConfig>(initial);
  const set = (patch: Partial<TreeConfig>) => setC((p) => ({ ...p, ...patch }));
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';
  const inputReadOnlyCls = 'w-full px-3 py-2 rounded-lg text-sm border bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-white/50 cursor-not-allowed';

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-white">
      <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
        <h3 className="font-semibold text-lg">Pengaturan Bagan</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"><X size={18} /></button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-6">
        <section>
          <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Keluarga Utama</h4>
          <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Nama Family</label>
          {isTreeOwner ? (
            <input value={c.mainFamilyName} onChange={(e) => set({ mainFamilyName: e.target.value })} placeholder="mis. Keluarga Budi" className={inputCls} />
          ) : (
            <div className="space-y-2">
              <input value={connectedFamily?.familyName || c.mainFamilyName} readOnly placeholder="—" className={inputReadOnlyCls} />
              {connectedFamily?.slug && (
                <a href={`/family/${connectedFamily.slug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  <ExternalLink size={12} />/family/{connectedFamily.slug}
                </a>
              )}
            </div>
          )}
          <div className="mt-2">
            <NumField label="Jumlah pasangan (suami/istri)" value={c.spouseCount} onChange={(v) => set({ spouseCount: v })} />
            <NumField label="Jumlah anak" value={c.childCount} onChange={(v) => set({ childCount: v })} />
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">Kelompok Keluarga Besar</h4>
          <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Nama Family</label>
          <input value={c.extFamilyName} onChange={(e) => set({ extFamilyName: e.target.value })} placeholder="mis. Trah Kartodikromo" className={inputCls} />
          <div className="mt-2">
            <NumField label="Jumlah Orang Tua" value={c.parentCount} onChange={(v) => set({ parentCount: v })} />
            <NumField label="Jumlah Saudara (Kakak)" value={c.olderCount} onChange={(v) => set({ olderCount: v })} />
            <NumField label="Jumlah Saudara (Adik)" value={c.youngerCount} onChange={(v) => set({ youngerCount: v })} />
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">Kelompok Keluarga Simbah</h4>
          <NumField label="Jumlah Simbah (Kakek-Nenek) dari pihak Ayah" value={c.simbahP} onChange={(v) => set({ simbahP: v })} />
          <NumField label="Jumlah Simbah dari pihak Ibu" value={c.simbahM} onChange={(v) => set({ simbahM: v })} />
        </section>

        <p className="text-xs text-slate-400 dark:text-white/40 italic border-t border-slate-100 dark:border-white/10 pt-3">
          Catatan: jumlah di atas termasuk anggota keluarga yang sudah meninggal dunia.
        </p>
      </div>

      <div className="p-5 border-t border-slate-200 dark:border-white/10">
        <button onClick={() => onSave(c)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          <Check size={16} />Simpan & Susun Bagan
        </button>
      </div>
    </div>
  );
}

// ─── Member form ────────────────────────────────────────────

function MemberForm({ node, isSelf, familySlug, ownerUsername, member, defaultName, accountName, canEdit, connectedFamily, consent, onRequestConsent, onRevokeConsent, onSetSlug, onOpenInvite, onSave, onClose }: {
  dark: boolean; node: TNode; isSelf: boolean; familySlug?: string | null; ownerUsername?: string | null; member?: Member; defaultName: string; accountName?: string; canEdit: boolean;
  connectedFamily?: ConnectedFamily | null;
  consent?: GuardianConsent;
  onRequestConsent: () => void; onRevokeConsent: (consentId: string) => void;
  onSetSlug: (slug?: string) => Promise<void>;
  onOpenInvite: () => void;
  onClose: () => void; onSave: (m: Member) => void;
}) {
  const [form, setForm] = useState<Member>({
    name: member?.name || (isSelf ? accountName || '' : ''),
    gender: member?.gender || '',
    alive: member?.alive !== false,
    photo: member?.photo || null,
    verified: member?.verified,
    familyConfig: member?.familyConfig,
    email: member?.email || '',
    phone: member?.phone || '',
    linkedUserId: member?.linkedUserId || null,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [slugLoading, setSlugLoading] = useState(false);
  const [slugError, setSlugError] = useState('');

  // User search for identity matching
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; name: string; avatar: string | null; email: string }[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [linkedUserConfirm, setLinkedUserConfirm] = useState<{ id: string; name: string; avatar: string | null; email: string } | null>(null);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'matching' | 'sent' | 'linked'>(member?.linkedUserId ? 'linked' : 'idle');
  const userSearchDebounce = useRef<ReturnType<typeof setTimeout>>(null);
  const [syncing, setSyncing] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.digsan.id';
  const publicFamilyUrl = familySlug ? `${origin}/family/${familySlug}` : '';
  const publicProfileUrl = familySlug && ownerUsername ? `${origin}/family/${familySlug}/${ownerUsername}` : '';
  const copyPublicLink = async () => {
    if (!publicFamilyUrl) return;
    try {
      await navigator.clipboard.writeText(publicFamilyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  // AJAX user search (3 char minimum)
  const onUserSearchChange = (val: string) => {
    setUserSearchQuery(val);
    setShowUserSearch(true);
    if (userSearchDebounce.current) clearTimeout(userSearchDebounce.current);
    const q = val.trim();
    if (q.length < 3) {
      setUserSearchResults([]);
      return;
    }
    userSearchDebounce.current = setTimeout(async () => {
      setUserSearching(true);
      try {
        const res = await treeApi.search(q);
        setUserSearchResults(res.users.map((u: any) => ({ id: u.id, name: u.name, avatar: u.avatar, email: u.email })));
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearching(false);
      }
    }, 300);
  };

  const selectLinkedUser = (u: { id: string; name: string; avatar: string | null; email: string }) => {
    setLinkedUserConfirm(u);
    setShowUserSearch(false);
  };

  const confirmLinkUser = () => {
    if (!linkedUserConfirm) return;
    setForm((f) => ({
      ...f,
      name: linkedUserConfirm.name,
      email: linkedUserConfirm.email,
      linkedUserId: linkedUserConfirm.id,
    }));
    setMatchStatus('linked');
    setLinkedUserConfirm(null);
  };

  // Sync avatar and info from linked user account
  const handleSyncLinkedUser = async () => {
    if (!form.linkedUserId || !node?.id) return;
    setSyncing(true);
    try {
      const res = await treeApi.syncLinkedUser(node.id);
      if (res?.member) {
        setForm((f) => ({
          ...f,
          name: res.member.name || f.name,
          photo: res.member.photo || f.photo || null,
          email: res.member.email || f.email || '',
          phone: res.member.phone || f.phone || '',
          verified: true,
        }));
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Check match: if 2 of 3 (name+email or name+phone) match a known user, send consent
  const checkAndSendConsent = async () => {
    if (matchStatus === 'sent' || matchStatus === 'linked') return;
    const hasName = form.name.trim().length > 0;
    const hasEmail = !!form.email?.trim();
    const hasPhone = !!form.phone?.trim();
    if (!hasName || (!hasEmail && !hasPhone)) return;
    setMatchStatus('matching');
    try {
      // Search for matching user by name
      const res = await treeApi.search(form.name.trim());
      const candidates = res.users.filter((u: any) => {
        const nameMatch = u.name.toLowerCase().includes(form.name.toLowerCase().trim());
        const emailMatch = hasEmail && u.email?.toLowerCase() === form.email?.toLowerCase().trim();
        return nameMatch && emailMatch;
      });
      if (candidates.length > 0) {
        const target = candidates[0];
        setForm((f) => ({ ...f, linkedUserId: target.id }));
        setMatchStatus('sent');
      } else {
        setMatchStatus('idle');
      }
    } catch {
      setMatchStatus('idle');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

  return (
    <div className="h-full flex flex-col text-slate-900 dark:text-white">
      <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
        <div>
          <h3 className="font-semibold text-lg">Detail Anggota</h3>
          <p className="text-emerald-500 dark:text-emerald-400 text-xs mt-0.5">{node.role}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"><X size={18} /></button>
      </div>

      {!canEdit && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            {node.group === 'parent' && 'Profil orang tua yang meninggal hanya dapat diedit oleh suami/istri yang masih hidup atau anak-anak yang memiliki akun terverifikasi.'}
            {node.group === 'spouse' && 'Profil pasangan yang meninggal hanya dapat diedit oleh Anda atau anak-anak yang memiliki akun terverifikasi.'}
            {node.group === 'child' && 'Profil anak yang meninggal hanya dapat diedit oleh Anda (orang tua) atau saudara yang memiliki akun terverifikasi.'}
            {!['parent', 'spouse', 'child'].includes(node.group) && 'Profil ini tidak dapat diedit saat ini.'}
          </p>
        </div>
      )}

      <div className="p-5 overflow-y-auto flex-1 space-y-5">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/15">
            {form.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photo} alt="foto" className="w-full h-full object-cover" />
            ) : <User size={38} className="text-slate-400 dark:text-white/40" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" disabled={!canEdit} />
          <button onClick={() => canEdit && fileRef.current?.click()} disabled={!canEdit}
            className={`flex items-center gap-1.5 text-sm ${canEdit ? 'text-blue-600 dark:text-blue-400 hover:underline' : 'text-slate-400 cursor-not-allowed'}`}>
            <Upload size={14} />Unggah Foto Profil
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Nama Lengkap</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={defaultName}
            disabled={!canEdit} className={`${inputCls} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`} />
          {/* Slug / public link info */}
          {isSelf && (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-white/50 min-w-0">
                  <Link2 size={12} className="shrink-0" />
                  <span className="shrink-0">Family Slug:</span>
                  {slugEditing ? (
                    <input
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="nama-keluarga-fam"
                      className="flex-1 min-w-0 px-2 py-0.5 rounded text-xs font-mono border bg-white dark:bg-white/10 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white outline-none focus:border-blue-400"
                      autoFocus
                    />
                  ) : (
                    <span className={`font-mono truncate ${familySlug ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {familySlug || '(belum dibuat)'}
                    </span>
                  )}
                </div>
                {/* Buat / Edit / Save / Cancel buttons */}
                {!slugEditing ? (
                  <button
                    type="button"
                    onClick={() => { setSlugInput(familySlug || ''); setSlugEditing(true); }}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      familySlug
                        ? 'text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}>
                    {familySlug ? 'Edit' : 'Buat'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={slugLoading}
                      onClick={async () => {
                        setSlugLoading(true);
                        setSlugError('');
                        try {
                          await onSetSlug(slugInput || undefined);
                          setSlugEditing(false);
                        } catch (err: any) {
                          setSlugError(err?.message || 'Gagal membuat slug');
                        }
                        setSlugLoading(false);
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                      {slugLoading ? '…' : 'Simpan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlugEditing(false)}
                      className="px-2 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10">
                      Batal
                    </button>
                  </div>
                )}
              </div>
              {slugError && slugEditing && (
                <div className="text-xs text-rose-500 dark:text-rose-400">{slugError}</div>
              )}
              {familySlug && !slugEditing && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-white/50">
                  <span className="shrink-0">Public URL:</span>
                  <a href={publicFamilyUrl} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {publicFamilyUrl}
                  </a>
                </div>
              )}
              {ownerUsername && !slugEditing && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-white/50">
                  <span className="shrink-0">Username:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{ownerUsername}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Identity matching — user search + email/phone (not for self) */}
        {!isSelf && canEdit && form.linkedUserId && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Telah terhubung</span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Telah terhubung dengan Family: <span className="font-semibold">{connectedFamily?.familyName || 'Keluarga'}</span>
            </p>
            {connectedFamily?.slug && (
              <a href={`/family/${connectedFamily.slug}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <ExternalLink size={12} />/family/{connectedFamily.slug}
              </a>
            )}
            <button
              type="button"
              onClick={handleSyncLinkedUser}
              disabled={syncing || !canEdit}
              className="w-full py-1.5 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Menyinkronkan...' : 'Update Koneksi'}
            </button>
          </div>
        )}

        {!isSelf && canEdit && !form.linkedUserId && (
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-white/60">Identifikasi Anggota</p>
            <p className="text-xs text-slate-400 dark:text-white/40 -mt-2">Cari user terdaftar atau isi email/WhatsApp untuk mencocokkan identitas</p>

            {/* User search */}
            <div className="relative">
              <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Cari User (min. 3 huruf)</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input
                  value={userSearchQuery}
                  onChange={(e) => onUserSearchChange(e.target.value)}
                  onFocus={() => setShowUserSearch(true)}
                  placeholder="Ketik nama user..."
                  className={`${inputCls} pl-8 text-xs`}
                />
                {userSearching && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">...</span>}
              </div>
              {showUserSearch && userSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0e1a] shadow-lg">
                  {userSearchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => selectLinkedUser(u)}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{u.name.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{u.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked user confirmation */}
            {linkedUserConfirm && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3">
                <p className="text-xs text-slate-700 dark:text-white/70 mb-2">Anda yakin dia anggota keluarga Anda?</p>
                <div className="flex items-center gap-2 mb-2">
                  {linkedUserConfirm.avatar ? (
                    <img src={linkedUserConfirm.avatar} alt={linkedUserConfirm.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{linkedUserConfirm.name.charAt(0).toUpperCase()}</div>
                  )}
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{linkedUserConfirm.name}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={confirmLinkUser} className="flex-1 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500">Ya, tambahkan</button>
                  <button type="button" onClick={() => setLinkedUserConfirm(null)} className="flex-1 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5">Batal</button>
                </div>
              </div>
            )}

            {/* Email & Phone fields */}
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Email</label>
                <input
                  value={form.email || ''}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setMatchStatus('idle'); }}
                  placeholder="email@contoh.com"
                  disabled={!canEdit}
                  className={`${inputCls} text-xs ${!canEdit ? 'opacity-50' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1">Nomor WhatsApp</label>
                <input
                  value={form.phone || ''}
                  onChange={(e) => { setForm({ ...form, phone: e.target.value }); setMatchStatus('idle'); }}
                  placeholder="+62xxx"
                  disabled={!canEdit}
                  className={`${inputCls} text-xs ${!canEdit ? 'opacity-50' : ''}`}
                />
              </div>
            </div>

            {/* Match status indicators */}
            {matchStatus === 'sent' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                <span className="text-xs text-amber-700 dark:text-amber-300">Cocok ditemukan! Notifikasi persetujuan akan dikirim saat disimpan.</span>
              </div>
            )}
            {matchStatus === 'idle' && form.name.trim() && (form.email?.trim() || form.phone?.trim()) && !form.linkedUserId && (
              <button
                type="button"
                onClick={checkAndSendConsent}
                className="w-full py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cek pencocokan identitas
              </button>
            )}
          </div>
        )}

        {/* Gender */}
        <div>
          <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Jenis Kelamin</label>
          <div className="grid grid-cols-2 gap-2">
            {(['L', 'P'] as const).map((g) => (
              <button key={g} onClick={() => canEdit && setForm({ ...form, gender: g })}
                disabled={!canEdit}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.gender === g
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-white/70 dark:border-white/15 dark:hover:bg-white/10'
                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {g === 'L' ? 'Laki-laki' : 'Perempuan'}
              </button>
            ))}
          </div>
        </div>

        {/* Life status */}
        <div>
          <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">Status Kehidupan</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: true, l: 'Hidup' }, { v: false, l: 'Meninggal Dunia' }].map((s) => (
              <button key={s.l} onClick={() => canEdit && setForm({ ...form, alive: s.v })}
                disabled={!canEdit}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.alive === s.v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-white/70 dark:border-white/15 dark:hover:bg-white/10'
                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>

        {/* Menu User — quick access to the public family/profile pages (self only) */}
        {isSelf && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 p-4">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Menu User</p>
            <p className="text-xs text-slate-500 dark:text-white/50 mb-3 leading-snug">Akses cepat halaman publik keluarga & profil Anda yang bisa dibagikan ke siapa pun.</p>
            {publicFamilyUrl ? (
              <div className="space-y-2">
                <a href={publicFamilyUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                  <Users size={15} />Tree Publik Keluargaku<ExternalLink size={13} className="opacity-80" />
                </a>
                {publicProfileUrl && (
                  <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors">
                    <User size={15} />Profil Publik Saya<ExternalLink size={13} className="opacity-70" />
                  </a>
                )}
                <button type="button" onClick={copyPublicLink}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/5 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                  {copied ? <Check size={15} className="text-emerald-500" /> : <Link2 size={15} />}{copied ? 'Link Tersalin' : 'Salin Link Publik'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-white/40">Simpan silsilah terlebih dahulu untuk mengaktifkan link publik keluarga.</p>
            )}
          </div>
        )}

        {/* Family setup — guardian manages a member's own network.
            Deceased direct relative: unlocked. Living member: requires consent. */}
        {!isSelf && node.group === 'parent' && (() => {
          const deceased = !form.alive;
          const granted = consent?.status === 'GRANTED';
          const unlocked = deceased ? canEdit : granted;
          return (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                {deceased ? 'Atur Keluarga (Alm.)' : 'Atur Keluarga'}
              </p>
              <p className="text-xs text-slate-500 dark:text-white/50 mb-3 leading-snug">
                {deceased
                  ? <>Karena anggota ini telah meninggal, Anda sebagai wali dapat menata keluarganya. Menambah saudara akan memunculkan cabang paman/bibi yang tersambung ke kakek-nenek (terlihat saat <b>Expand All</b>).</>
                  : <>Anggota ini masih hidup. Menata silsilahnya memerlukan <b>izin</b> dari pemilik akun. Ajukan permintaan, dan setelah disetujui bagian ini akan terbuka.</>}
              </p>

              {!deceased && !granted && (
                <div className="mb-3">
                  {consent?.status === 'PENDING' ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                      <span className="text-xs text-amber-700 dark:text-amber-300">Menunggu persetujuan…</span>
                      <button type="button" onClick={() => consent && onRevokeConsent(consent.id)}
                        className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline">Batalkan</button>
                    </div>
                  ) : (
                    <button type="button" onClick={onRequestConsent}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                      {consent?.status === 'REJECTED' ? 'Ajukan Ulang Izin' : 'Minta Izin'}
                    </button>
                  )}
                  {consent?.status === 'REJECTED' && (
                    <p className="text-xs text-rose-500 mt-1.5">Permintaan sebelumnya ditolak.</p>
                  )}
                </div>
              )}

              {!deceased && granted && (
                <div className="flex items-center justify-between gap-2 mb-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">Izin disetujui</span>
                  <button type="button" onClick={() => consent && onRevokeConsent(consent.id)}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline">Cabut</button>
                </div>
              )}

              <div className={unlocked ? '' : 'opacity-40 pointer-events-none select-none'}>
                <NumField
                  label={deceased ? 'Jumlah Kakak (dari alm.)' : 'Jumlah Kakak'}
                  value={form.familyConfig?.olderCount ?? form.familyConfig?.siblingCount ?? 0}
                  onChange={(v) => setForm((f) => ({ ...f, familyConfig: { ...f.familyConfig, olderCount: v, siblingCount: undefined } }))}
                />
                <NumField
                  label={deceased ? 'Jumlah Adik (dari alm.)' : 'Jumlah Adik'}
                  value={form.familyConfig?.youngerCount || 0}
                  onChange={(v) => setForm((f) => ({ ...f, familyConfig: { ...f.familyConfig, youngerCount: v } }))}
                />
              </div>
            </div>
          );
        })()}

        {/* Invite — opens the invitation studio (image + method dropdown)
            Hidden for already-linked members (they are the identity owner) */}
        {!isSelf && !form.linkedUserId && (() => {
          const deceased = !form.alive;
          return (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <p className="text-sm text-slate-600 dark:text-white/70 mb-1">
                {deceased ? 'Undang kerabat edit bersama' : 'Undang pemilik identitas'}
              </p>
              <p className="text-xs text-slate-400 dark:text-white/40 mb-3">
                {deceased
                  ? 'Anggota ini telah meninggal. Undang kerabat berakun aktif yang berhak (sesuai aturan perizinan) untuk ikut mengelola silsilahnya.'
                  : 'Agar melengkapi datanya sendiri secara lengkap.'}
              </p>
              <button onClick={onOpenInvite}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                <Share2 size={15} />{deceased ? 'Undang Kerabat' : 'Buat Undangan'}
              </button>
            </div>
          );
        })()
      }
      </div>

      <div className="p-5 border-t border-slate-200 dark:border-white/10">
        <button onClick={() => onSave(form)} disabled={!canEdit}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            canEdit ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-white/10 dark:text-white/40'
          }`}>
          <Check size={16} />Simpan
        </button>
      </div>
    </div>
  );
}
