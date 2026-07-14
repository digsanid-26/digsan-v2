'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getUser } from '@/lib/auth';
import { treeApi } from '@/lib/tree';
import type { GuardianConsent } from '@/lib/tree';
import { useTheme } from './ThemeProvider';
import type { Group, TNode, Poly, TreeConfig, Member, Members } from './treeTypes';
import { DEFAULT_CONFIG } from './treeTypes';
import { configToGraph, layoutGraph } from './familyGraph';
import InvitationStudio from './InvitationStudio';
import {
  Plus, Minus, Maximize2, Network, X, User, Settings,
  Mail, MessageCircle, Share2, Link2, Upload, Check,
} from 'lucide-react';

// ─── Styling per group ──────────────────────────────────────

const STYLE: Record<Group, { bg: string; border: string; size: number }> = {
  self:        { bg: '#254474', border: 'rgba(96,165,250,0.85)', size: 96 },
  spouse:      { bg: '#7e22ce', border: 'rgba(216,180,254,0.7)', size: 76 },
  parent:      { bg: '#1d4ed8', border: 'rgba(96,165,250,0.7)', size: 74 },
  grandparent: { bg: '#4338ca', border: 'rgba(165,180,252,0.7)', size: 66 },
  ancestor:    { bg: '#6d28d9', border: 'rgba(196,181,253,0.7)', size: 58 },
  kakak:       { bg: '#c2410c', border: 'rgba(251,146,60,0.7)', size: 70 },
  adik:        { bg: '#047857', border: 'rgba(52,211,153,0.7)', size: 70 },
  child:       { bg: '#b45309', border: 'rgba(251,191,36,0.7)', size: 64 },
  uncle:       { bg: '#0e7490', border: 'rgba(103,232,249,0.7)', size: 66 },
};

const ANCESTORS = ['Buyut', 'Canggah', 'Wareng', 'Udheg-udheg', 'Gantung Siwur', 'Gropak Senthe'];

const OX = 1600, OY = 1600; // svg internal offset (large to fit ancestral chain)

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
  if (cfg.childCount > 0) bubbles.push({ id: 'grp-an', name: 'Anak', role: 'group', x: 0, y: 235, group: 'child', count: cfg.childCount });
  bubbles.forEach((b) => { nodes.push(b); lines.push({ points: [[0, 0], [b.x, b.y]] }); });
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
  const [config, setConfig] = useState<TreeConfig>(DEFAULT_CONFIG);
  const [members, setMembers] = useState<Members>({});
  const [consents, setConsents] = useState<GuardianConsent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [panel, setPanel] = useState<'none' | 'setup' | 'member'>('none');
  const [selected, setSelected] = useState<TNode | null>(null);
  const [showStudio, setShowStudio] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
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

    let cancelled = false;
    (async () => {
      try {
        const remote = await treeApi.getLayout<Partial<TreeConfig>, Members>();
        if (cancelled) return;

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
        if (!remote.config && !hadLocalConfig) setPanel('setup');

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
        if (!cancelled && !hadLocalConfig) setPanel('setup');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const pushLayout = (payload: { config?: TreeConfig; members?: Members }) => {
    if (uidRef.current === 'guest') return; // only sync for logged-in users
    treeApi.saveLayout(payload).catch(() => { /* keep local cache; will retry on next save */ });
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

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    drag.current = { ox: pan.x, oy: pan.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPan({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) });
  };
  const onPointerUp = () => { drag.current = null; };

  const doExpand = () => { setExpanded(true); setZoom(0.42); setPan({ x: 0, y: 0 }); };
  const doCollapse = () => { setExpanded(false); setZoom(1); setPan({ x: 0, y: 0 }); };
  const reset = () => { setZoom(expanded ? 0.42 : 1); setPan({ x: 0, y: 0 }); };

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
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        {config.configured && (
          <button onClick={expanded ? doCollapse : doExpand}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">
            <Network size={15} />{expanded ? 'Tutup Semua' : 'Expand All'}
          </button>
        )}
        <button onClick={() => { setPanel('setup'); setSelected(null); }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg
            bg-white text-slate-700 hover:bg-slate-50 border border-slate-200
            dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/15">
          <Settings size={15} />Pengaturan
        </button>
        {config.configured && (
          <button onClick={() => setShowStudio(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg
              bg-white text-slate-700 hover:bg-slate-50 border border-slate-200
              dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/15">
            <Share2 size={15} />Undang
          </button>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-1.5 p-1.5 rounded-2xl backdrop-blur
        bg-white border border-slate-200 shadow-lg
        dark:bg-white/5 dark:border-white/10 dark:shadow-none">
        <button onClick={() => setZoom((z) => CLAMP(z * 1.15, 0.2, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perbesar"><Plus size={16} /></button>
        <button onClick={reset} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Reset"><Maximize2 size={15} /></button>
        <button onClick={() => setZoom((z) => CLAMP(z * 0.87, 0.2, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perkecil"><Minus size={16} /></button>
      </div>

      <div className="absolute top-4 right-4 z-20 text-[11px] text-slate-400 dark:text-white/35">Zoom {Math.round(zoom * 100)}% • seret untuk geser</div>

      {!config.configured && (
        <div className="absolute inset-x-0 top-24 z-20 flex justify-center pointer-events-none">
          <p className="px-4 py-2 rounded-full text-sm bg-white/90 text-slate-600 border border-slate-200 shadow dark:bg-white/10 dark:text-white/70 dark:border-white/10">
            Atur bagan keluarga Anda melalui tombol <b>Pengaturan</b>
          </p>
        </div>
      )}

      {/* Viewport */}
      <div ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="absolute inset-0 cursor-grab active:cursor-grabbing">
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

                {/* Name label — shown on hover/selected for nodes whose photo hides the name */}
                {!isGroup && d?.photo && (
                  <span
                    className={`pointer-events-none absolute left-1/2 top-full -translate-x-1/2 -mt-1 z-30 inline-block max-w-[180px] truncate whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-md border transition-opacity duration-200
                      bg-white/80 text-slate-800 border-slate-200
                      dark:bg-black/55 dark:text-white dark:border-white/20
                      ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {d.name}
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
          <SetupForm dark={dark} initial={config} onClose={() => setPanel('none')}
            onSave={(c) => { saveConfig({ ...c, configured: true }); setPanel('none'); setExpanded(false); }} />
        )}
        {panel === 'member' && selected && (
          <MemberForm key={selected.id} dark={dark} node={selected} isSelf={selected.id === 'self'}
            member={members[selected.id]} defaultName={selected.name} accountName={me?.name}
            canEdit={canEditMember(selected.id, selected.group, members, config, me?.id || 'guest')}
            consent={consentFor(selected.id)}
            onRequestConsent={() => requestConsent(selected.id)}
            onRevokeConsent={(id) => revokeConsent(id)}
            onClose={() => setPanel('none')}
            onSave={(m) => { saveMembers({ ...members, [selected.id]: m }); setPanel('none'); }} />
        )}
      </div>

      <InvitationStudio
        open={showStudio}
        onClose={() => setShowStudio(false)}
        dark={dark}
        nodes={nodes.map((n) => (n.role === 'group' ? n : { ...n, name: disp(n.id, n.name).name }))}
        lines={lines}
        palette={STYLE}
        aliveOf={(id) => members[id]?.alive !== false}
        inviterName={me?.name || 'Saya'}
        treeName={config.mainFamilyName}
      />
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

function SetupForm({ initial, onSave, onClose }: { dark: boolean; initial: TreeConfig; onSave: (c: TreeConfig) => void; onClose: () => void }) {
  const [c, setC] = useState<TreeConfig>(initial);
  const set = (patch: Partial<TreeConfig>) => setC((p) => ({ ...p, ...patch }));
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white';

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
          <input value={c.mainFamilyName} onChange={(e) => set({ mainFamilyName: e.target.value })} placeholder="mis. Keluarga Budi" className={inputCls} />
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

const INVITE_METHODS = [
  { label: 'Email', icon: Mail, color: 'text-rose-500' },
  { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500' },
  { label: 'Media Sosial', icon: Share2, color: 'text-blue-500' },
  { label: 'Salin Tautan', icon: Link2, color: 'text-slate-500' },
];

function MemberForm({ node, isSelf, member, defaultName, accountName, canEdit, consent, onRequestConsent, onRevokeConsent, onSave, onClose }: {
  dark: boolean; node: TNode; isSelf: boolean; member?: Member; defaultName: string; accountName?: string; canEdit: boolean;
  consent?: GuardianConsent;
  onRequestConsent: () => void; onRevokeConsent: (consentId: string) => void;
  onClose: () => void; onSave: (m: Member) => void;
}) {
  const [form, setForm] = useState<Member>({
    name: member?.name || (isSelf ? accountName || '' : ''),
    gender: member?.gender || '',
    alive: member?.alive !== false,
    photo: member?.photo || null,
    verified: member?.verified,
    familyConfig: member?.familyConfig,
  });
  const [showInvite, setShowInvite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result as string }));
    reader.readAsDataURL(file);
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
        </div>

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

        {/* Invite */}
        {!isSelf && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <p className="text-sm text-slate-600 dark:text-white/70 mb-1">Undang pemilik identitas</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mb-3">Agar melengkapi datanya sendiri secara lengkap.</p>
            <button onClick={() => setShowInvite((s) => !s)} className="w-full py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
              Undang / Invite
            </button>
            {showInvite && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {INVITE_METHODS.map((m) => (
                  <button key={m.label} onClick={() => alert(`Kirim undangan via ${m.label} (demo)`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10">
                    <m.icon size={15} className={m.color} />{m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
