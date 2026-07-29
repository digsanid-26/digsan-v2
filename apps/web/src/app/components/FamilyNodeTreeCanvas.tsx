'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, ArrowLeft, Users } from 'lucide-react';

export interface FamilyNodeMember {
  name: string;
  photo: string | null;
  role: 'head' | 'spouse' | 'child';
}

export interface FamilyNodeItem {
  id: string;
  name: string;
  familyImage: string | null;
  slug: string | null;
  /** Node type for positioning. */
  kind: 'self' | 'parent' | 'sibling' | 'child';
  /** Optional member count to display. */
  memberCount?: number;
  /** Members for hover preview (L104). */
  fnMembers?: FamilyNodeMember[];
  x: number;
  y: number;
}

export interface FamilyNodeLink {
  from: string;
  to: string;
  /** Whether this is a marriage link (horizontal) vs parent-child (vertical). */
  marriage?: boolean;
}

interface Props {
  nodes: FamilyNodeItem[];
  links: FamilyNodeLink[];
  onNodeClick?: (node: FamilyNodeItem) => void;
  onBack?: () => void;
  className?: string;
}

const NODE_R = 48;
const PAD = 100;
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const INITIAL_SCALE = 1.2;

export default function FamilyNodeTreeCanvas({ nodes, links, onNodeClick, onBack, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const movedRef = useRef(false);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const box = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, w: 1, h: 1, cx: 0.5, cy: 0.5 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - NODE_R - PAD);
      maxX = Math.max(maxX, n.x + NODE_R + PAD);
      minY = Math.min(minY, n.y - NODE_R - PAD);
      maxY = Math.max(maxY, n.y + NODE_R + 40 + PAD);
    }
    const w = maxX - minX, h = maxY - minY;
    return { minX, minY, w, h, cx: minX + w / 2, cy: minY + h / 2 };
  }, [nodes]);

  useEffect(() => {
    if (!nodes.length) return;
    const self = nodes.find((n) => n.kind === 'self');
    setCenter(self ? { x: self.x, y: self.y } : { x: box.cx, y: box.cy });
    setScale(INITIAL_SCALE);
  }, [nodes.length, box.cx, box.cy]);

  const cx = center?.x ?? box.cx;
  const cy = center?.y ?? box.cy;
  const viewW = box.w / scale;
  const viewH = box.h / scale;
  const viewBox = `${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`;

  const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => clampScale(s * (e.deltaY > 0 ? 0.9 : 1.1)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, cx, cy };
    movedRef.current = false;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pxPerUnit = rect.width / viewW;
    const dx = (e.clientX - dragRef.current.x) / pxPerUnit;
    const dy = (e.clientY - dragRef.current.y) / pxPerUnit;
    if (Math.abs(e.clientX - dragRef.current.x) > 3 || Math.abs(e.clientY - dragRef.current.y) > 3) {
      movedRef.current = true;
    }
    setCenter({ x: dragRef.current.cx - dx, y: dragRef.current.cy - dy });
  };

  const endDrag = () => { dragRef.current = null; setDragging(false); };

  const handleNodeClick = (node: FamilyNodeItem) => {
    if (movedRef.current) return;
    onNodeClick?.(node);
  };

  const zoomIn = () => setScale((s) => clampScale(s * 1.3));
  const zoomOut = () => setScale((s) => clampScale(s / 1.3));
  const resetView = () => {
    const self = nodes.find((n) => n.kind === 'self');
    setCenter(self ? { x: self.x, y: self.y } : { x: box.cx, y: box.cy });
    setScale(INITIAL_SCALE);
  };

  const nodeMap = useMemo(() => {
    const m = new Map<string, FamilyNodeItem & { x: number; y: number }>();
    for (const n of nodes as any[]) m.set(n.id, n);
    return m;
  }, [nodes]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <svg viewBox={viewBox} className="w-full h-full" style={{ display: 'block' }}>
        {/* Links */}
        {links.map((l, i) => {
          const from = nodeMap.get(l.from);
          const to = nodeMap.get(l.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={l.marriage ? 'rgba(147,197,253,0.5)' : 'rgba(255,255,255,0.2)'}
              strokeWidth={l.marriage ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n: any) => {
          const isSelf = n.kind === 'self';
          const r = isSelf ? NODE_R : NODE_R * 0.8;
          const isHovered = hoveredId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              onClick={() => handleNodeClick(n)}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Glow ring for self */}
              {isSelf && (
                <circle r={r + 6} fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth={3} />
              )}
              {/* Hover ring */}
              {isHovered && !isSelf && (
                <circle r={r + 4} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
              )}
              {n.familyImage ? (
                <>
                  <clipPath id={`fn-clip-${n.id}`}>
                    <circle r={r - 2} />
                  </clipPath>
                  <circle r={r} fill="#1a1a2e" stroke={isSelf ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'} strokeWidth={2.5} />
                  <image
                    href={n.familyImage}
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    clipPath={`url(#fn-clip-${n.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <circle r={r} fill="none" stroke={isSelf ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'} strokeWidth={2.5} />
                </>
              ) : (
                <>
                  <circle r={r} fill={isSelf ? '#1e293b' : '#151528'} stroke={isSelf ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.12)'} strokeWidth={2} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={16}
                    fontWeight={600}
                  >
                    {initials(n.name)}
                  </text>
                </>
              )}
              {/* Name label */}
              <text
                y={r + 20}
                textAnchor="middle"
                fill={isSelf ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)'}
                fontSize={isSelf ? 14 : 12}
                fontWeight={isSelf ? 600 : 500}
              >
                {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
              </text>
              {/* Member count badge */}
              {n.memberCount && n.memberCount > 0 && !isHovered && (
                <g transform={`translate(${r * 0.7}, ${r * 0.7})`}>
                  <circle r={12} fill="rgba(59,130,246,0.8)" />
                  <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={10} fontWeight={700}>
                    {n.memberCount}
                  </text>
                </g>
              )}

              {/* L104: Orbiting member circles on hover */}
              {isHovered && n.fnMembers && n.fnMembers.length > 0 && (() => {
                const SMALL_R = 14;
                const orbitR = r + 24;
                // Cap: head + spouse + 2 children + 1 "plus" = 5 max
                const MAX_SHOW = 5;
                const visible = n.fnMembers.slice(0, MAX_SHOW);
                const hasMore = n.fnMembers.length > MAX_SHOW;
                const total = visible.length + (hasMore ? 1 : 0);
                const startAngle = Math.PI; // left (180°)
                const items: { x: number; y: number; m: FamilyNodeMember | null; isMore: boolean }[] = [];
                for (let i = 0; i < visible.length; i++) {
                  const angle = startAngle + (i * 2 * Math.PI / total);
                  items.push({ x: orbitR * Math.cos(angle), y: orbitR * Math.sin(angle), m: visible[i], isMore: false });
                }
                if (hasMore) {
                  const angle = startAngle + (visible.length * 2 * Math.PI / total);
                  items.push({ x: orbitR * Math.cos(angle), y: orbitR * Math.sin(angle), m: null, isMore: true });
                }
                return (
                  <>
                    {items.map((item, idx) => (
                      <g key={idx} transform={`translate(${item.x}, ${item.y})`}>
                        {item.m?.photo ? (
                          <>
                            <clipPath id={`fnm-clip-${n.id}-${idx}`}>
                              <circle r={SMALL_R - 1} />
                            </clipPath>
                            <circle r={SMALL_R} fill="#1a1a2e" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                            <image
                              href={item.m.photo}
                              x={-SMALL_R}
                              y={-SMALL_R}
                              width={SMALL_R * 2}
                              height={SMALL_R * 2}
                              clipPath={`url(#fnm-clip-${n.id}-${idx})`}
                              preserveAspectRatio="xMidYMid slice"
                            />
                            <circle r={SMALL_R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                          </>
                        ) : item.isMore ? (
                          <>
                            <circle r={SMALL_R} fill="rgba(59,130,246,0.3)" stroke="rgba(59,130,246,0.5)" strokeWidth={1.5} />
                            <text textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize={12} fontWeight={700}>+</text>
                          </>
                        ) : (
                          <>
                            <circle r={SMALL_R} fill="#151528" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                            <text textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.5)" fontSize={8} fontWeight={600}>
                              {initials(item.m?.name || '?')}
                            </text>
                          </>
                        )}
                        {/* Role color dot */}
                        {item.m && (
                          <circle cx={SMALL_R * 0.7} cy={SMALL_R * 0.7} r={4}
                            fill={item.m.role === 'head' ? '#facc15' : item.m.role === 'spouse' ? '#93c5fd' : '#86efac'} />
                        )}
                      </g>
                    ))}
                  </>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {/* Back button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors"
        >
          <ArrowLeft size={15} /> Mode Familymember
        </button>
      )}

      {/* View label */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 border border-white/10 backdrop-blur-sm">
        <Users size={13} /> Mode Family Node
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button type="button" onClick={zoomIn} aria-label="Perbesar" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors">
          <ZoomIn size={16} />
        </button>
        <button type="button" onClick={zoomOut} aria-label="Perkecil" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors">
          <ZoomOut size={16} />
        </button>
        <button type="button" onClick={resetView} aria-label="Kembali ke posisi awal" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors">
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
