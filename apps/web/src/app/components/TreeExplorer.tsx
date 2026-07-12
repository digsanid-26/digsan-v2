'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getUser } from '@/lib/auth';
import { useTheme } from './ThemeProvider';
import { Plus, Minus, Maximize2, Network, X, User } from 'lucide-react';

type Group =
  | 'self' | 'spouse' | 'parent' | 'grandparent' | 'buyut'
  | 'uncle' | 'kakak' | 'adik' | 'child' | 'grandchild';

interface TNode { id: string; name: string; role: string; x: number; y: number; group: Group; }

const STYLE: Record<Group, { bg: string; border: string; size: number }> = {
  self:        { bg: '#254474', border: 'rgba(96,165,250,0.85)', size: 96 },
  spouse:      { bg: '#7e22ce', border: 'rgba(216,180,254,0.7)', size: 76 },
  parent:      { bg: '#1d4ed8', border: 'rgba(96,165,250,0.7)', size: 74 },
  grandparent: { bg: '#4338ca', border: 'rgba(165,180,252,0.7)', size: 66 },
  buyut:       { bg: '#6d28d9', border: 'rgba(196,181,253,0.7)', size: 58 },
  uncle:       { bg: '#475569', border: 'rgba(148,163,184,0.7)', size: 64 },
  kakak:       { bg: '#c2410c', border: 'rgba(251,146,60,0.7)', size: 70 },
  adik:        { bg: '#047857', border: 'rgba(52,211,153,0.7)', size: 70 },
  child:       { bg: '#b45309', border: 'rgba(251,191,36,0.7)', size: 64 },
  grandchild:  { bg: '#0d9488', border: 'rgba(94,234,212,0.7)', size: 54 },
};

const NODES: TNode[] = [
  { id: 'kk2', name: 'Kakak 2', role: 'Saudara Tua', x: -560, y: 0, group: 'kakak' },
  { id: 'kk1', name: 'Kakak 1', role: 'Saudara Tua', x: -400, y: 0, group: 'kakak' },
  { id: 'self', name: 'Anda', role: 'Diri Sendiri', x: -70, y: 0, group: 'self' },
  { id: 'spouse', name: 'Pasangan', role: 'Suami / Istri', x: 70, y: 0, group: 'spouse' },
  { id: 'ad1', name: 'Adik 1', role: 'Saudara Muda', x: 400, y: 0, group: 'adik' },
  { id: 'ad2', name: 'Adik 2', role: 'Saudara Muda', x: 560, y: 0, group: 'adik' },
  { id: 'an1', name: 'Anak 1', role: 'Keturunan', x: -240, y: 200, group: 'child' },
  { id: 'an2', name: 'Anak 2', role: 'Keturunan', x: -80, y: 200, group: 'child' },
  { id: 'an3', name: 'Anak 3', role: 'Keturunan', x: 80, y: 200, group: 'child' },
  { id: 'an4', name: 'Anak 4', role: 'Keturunan', x: 240, y: 200, group: 'child' },
  { id: 'cu1', name: 'Cucu 1', role: 'Cucu', x: -140, y: 380, group: 'grandchild' },
  { id: 'cu2', name: 'Cucu 2', role: 'Cucu', x: -20, y: 380, group: 'grandchild' },
  { id: 'cu3', name: 'Cucu 3', role: 'Cucu', x: 120, y: 380, group: 'grandchild' },
  { id: 'ayah', name: 'Ayah', role: 'Orang Tua', x: -70, y: -200, group: 'parent' },
  { id: 'ibu', name: 'Ibu', role: 'Orang Tua', x: 70, y: -200, group: 'parent' },
  { id: 'paman', name: 'Paman', role: 'Saudara Ayah', x: -360, y: -200, group: 'uncle' },
  { id: 'bibi', name: 'Bibi', role: 'Saudara Ibu', x: 360, y: -200, group: 'uncle' },
  { id: 'kakekP', name: 'Kakek', role: 'Kakek (dari Ayah)', x: -200, y: -380, group: 'grandparent' },
  { id: 'nenekP', name: 'Nenek', role: 'Nenek (dari Ayah)', x: -60, y: -380, group: 'grandparent' },
  { id: 'kakekM', name: 'Kakek', role: 'Kakek (dari Ibu)', x: 60, y: -380, group: 'grandparent' },
  { id: 'nenekM', name: 'Nenek', role: 'Nenek (dari Ibu)', x: 200, y: -380, group: 'grandparent' },
  { id: 'buyut1', name: 'Buyut', role: 'Buyut (dari Ayah)', x: -200, y: -540, group: 'buyut' },
  { id: 'buyut2', name: 'Buyut', role: 'Buyut (dari Ayah)', x: -60, y: -540, group: 'buyut' },
  { id: 'buyut3', name: 'Buyut', role: 'Buyut (dari Ibu)', x: 60, y: -540, group: 'buyut' },
  { id: 'buyut4', name: 'Buyut', role: 'Buyut (dari Ibu)', x: 200, y: -540, group: 'buyut' },
];

const COUPLES: { parents: string[]; children: string[] }[] = [
  { parents: ['self', 'spouse'], children: ['an1', 'an2', 'an3', 'an4'] },
  { parents: ['ayah', 'ibu'], children: ['kk2', 'kk1', 'self', 'ad1', 'ad2'] },
  { parents: ['kakekP', 'nenekP'], children: ['ayah', 'paman'] },
  { parents: ['kakekM', 'nenekM'], children: ['ibu', 'bibi'] },
  { parents: ['buyut1', 'buyut2'], children: ['kakekP'] },
  { parents: ['buyut3', 'buyut4'], children: ['kakekM'] },
  { parents: ['an2'], children: ['cu1', 'cu2'] },
  { parents: ['an3'], children: ['cu3'] },
];

const RELATIONS = [
  { title: 'Orang Tua', items: ['Ayah', 'Ibu'] },
  { title: 'Kakak', items: ['Kakak 1', 'Kakak 2'] },
  { title: 'Adik', items: ['Adik 1', 'Adik 2'] },
  { title: 'Pasangan', items: ['Pasangan'] },
  { title: 'Anak', items: ['Anak 1', 'Anak 2', 'Anak 3', 'Anak 4'] },
];

const OX = 1300, OY = 1000;

type Poly = { points: number[][]; marriage?: boolean };

function buildLines(): Poly[] {
  const by = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const out: Poly[] = [];
  for (const c of COUPLES) {
    const ps = c.parents.map((id) => by[id]);
    const cs = c.children.map((id) => by[id]);
    const midX = ps.reduce((s, p) => s + p.x, 0) / ps.length;
    const py = ps[0].y;
    if (ps.length === 2) out.push({ points: [[ps[0].x, py], [ps[1].x, py]], marriage: true });
    const cy = cs[0].y;
    const trunkY = (py + cy) / 2;
    out.push({ points: [[midX, py], [midX, trunkY]] });
    const xs = cs.map((n) => n.x).concat([midX]);
    out.push({ points: [[Math.min(...xs), trunkY], [Math.max(...xs), trunkY]] });
    for (const ch of cs) out.push({ points: [[ch.x, trunkY], [ch.x, cy]] });
  }
  return out;
}

const CLAMP = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function TreeExplorer() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [me, setMe] = useState<{ name: string; avatar: string | null } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<TNode | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u) setMe({ name: u.name, avatar: u.avatar });
  }, []);

  const expandedLines = useMemo(() => buildLines(), []);

  const simpleNodes: TNode[] = useMemo(() => [
    { id: 'self', name: me?.name || 'Anda', role: 'Diri Sendiri', x: 0, y: 0, group: 'self' },
    { id: 'grp-ot', name: 'Orang Tua', role: 'group', x: 0, y: -235, group: 'parent' },
    { id: 'grp-kk', name: 'Kakak', role: 'group', x: -235, y: 0, group: 'kakak' },
    { id: 'grp-ad', name: 'Adik', role: 'group', x: 235, y: 0, group: 'adik' },
    { id: 'grp-an', name: 'Anak', role: 'group', x: 0, y: 235, group: 'child' },
  ], [me]);

  const simpleLines: Poly[] = [
    { points: [[0, 0], [0, -235]] }, { points: [[0, 0], [-235, 0]] },
    { points: [[0, 0], [235, 0]] }, { points: [[0, 0], [0, 235]] },
  ];

  const nodes = expanded ? NODES : simpleNodes;
  const lines = expanded ? expandedLines : simpleLines;

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => CLAMP(z * (e.deltaY < 0 ? 1.12 : 0.89), 0.25, 2));
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

  const doExpand = () => { setExpanded(true); setZoom(0.5); setPan({ x: 0, y: 0 }); };
  const doCollapse = () => { setExpanded(false); setZoom(1); setPan({ x: 0, y: 0 }); };
  const reset = () => { setZoom(expanded ? 0.5 : 1); setPan({ x: 0, y: 0 }); };

  const clickNode = (n: TNode) => {
    if (n.role === 'group') { doExpand(); return; }
    setSelected(n);
  };

  const strokeMarriage = dark ? 'rgba(147,197,253,0.55)' : 'rgba(37,99,235,0.45)';
  const strokeNormal = dark ? 'rgba(255,255,255,0.22)' : 'rgba(51,65,85,0.28)';

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-100 dark:bg-[#05050f]">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button onClick={expanded ? doCollapse : doExpand}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg">
          <Network size={15} />{expanded ? 'Tutup Semua' : 'Expand All'}
        </button>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-1.5 p-1.5 rounded-2xl backdrop-blur
        bg-white border border-slate-200 shadow-lg
        dark:bg-white/5 dark:border-white/10 dark:shadow-none">
        <button onClick={() => setZoom((z) => CLAMP(z * 1.15, 0.25, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perbesar"><Plus size={16} /></button>
        <button onClick={reset} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Reset"><Maximize2 size={15} /></button>
        <button onClick={() => setZoom((z) => CLAMP(z * 0.87, 0.25, 2))} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10" title="Perkecil"><Minus size={16} /></button>
      </div>

      <div className="absolute top-4 right-4 z-20 text-[11px] text-slate-400 dark:text-white/35">Zoom {Math.round(zoom * 100)}% • seret untuk geser</div>

      {/* Viewport */}
      <div ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="absolute inset-0 cursor-grab active:cursor-grabbing">
        <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: drag.current ? 'none' : 'transform 0.3s ease' }}>
          <svg width={2600} height={2000} viewBox="0 0 2600 2000" style={{ position: 'absolute', left: -OX, top: -OY, overflow: 'visible', pointerEvents: 'none' }}>
            {lines.map((l, i) => (
              <polyline key={i} points={l.points.map(([x, y]) => `${x + OX},${y + OY}`).join(' ')} fill="none"
                stroke={l.marriage ? strokeMarriage : strokeNormal} strokeWidth={l.marriage ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>

          {nodes.map((n) => {
            const st = STYLE[n.group];
            const size = n.id === 'self' && !expanded ? 150 : st.size;
            const isSelf = n.id === 'self';
            return (
              <button key={n.id} data-node onClick={() => clickNode(n)}
                className="family-node absolute flex items-center justify-center rounded-full border text-white overflow-hidden"
                style={{ left: n.x, top: n.y, width: size, height: size, transform: 'translate(-50%,-50%)', background: st.bg, borderColor: st.border, boxShadow: `0 0 18px ${st.border}` }}>
                {isSelf && me?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatar} alt={n.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : isSelf ? (
                  <User size={size * 0.4} className="text-white/85" />
                ) : (
                  <span className="px-1 text-center leading-tight font-semibold" style={{ fontSize: Math.max(9, size * 0.16) }}>{n.name}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right sidebar */}
      <div className={`absolute top-0 right-0 h-full w-[330px] max-w-[85vw] z-40 transition-transform duration-300 backdrop-blur-xl
        border-l bg-white/95 border-slate-200 dark:bg-[#0a0e1a]/95 dark:border-white/10
        ${selected ? 'translate-x-0' : 'translate-x-full'}`}>
        {selected && (
          <div className="h-full flex flex-col text-slate-900 dark:text-white">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-semibold text-lg">Detail Anggota</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"><X size={18} /></button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: STYLE[selected.group].bg, border: `2px solid ${STYLE[selected.group].border}` }}>
                  {selected.id === 'self' && me?.avatar
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={me.avatar} alt={selected.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    : <User size={26} className="text-white/85" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold truncate">{selected.id === 'self' ? (me?.name || 'Anda') : selected.name}</p>
                  <p className="text-emerald-500 dark:text-emerald-400 text-sm">{selected.role}</p>
                </div>
              </div>

              {selected.id === 'self' ? (
                <div className="space-y-5">
                  {RELATIONS.map((r) => (
                    <div key={r.title}>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2">{r.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {r.items.map((it) => (
                          <span key={it} className="px-3 py-1.5 rounded-full text-xs bg-slate-100 border border-slate-200 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-white/80">{it}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <Row label="Tanggal Lahir" value="15 Maret 1985" />
                  <Row label="Tempat Tinggal" value="Jakarta, Indonesia" />
                  <Row label="Hubungan" value={selected.role} />
                  <div className="pt-1">
                    <p className="text-slate-400 dark:text-white/40 text-xs mb-1.5">CATATAN</p>
                    <p className="text-slate-600 dark:text-white/75 italic">&ldquo;Anggota keluarga yang selalu memberi dukungan dan kasih sayang.&rdquo;</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-white/10">
              <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">Lihat Riwayat Lengkap</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-3">
      <span className="text-slate-500 dark:text-white/55">{label}</span>
      <span className="font-medium text-slate-800 dark:text-white/90">{value}</span>
    </div>
  );
}
