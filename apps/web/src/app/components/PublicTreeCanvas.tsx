'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { User, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { TNode, Poly } from './treeTypes';
import { STYLE } from './treeStyle';

interface ResolvedMember {
  name: string;
  photo: string | null;
  alive: boolean;
  gender?: string;
  /** Whether this slot is linked to a real, claimed account. */
  verified?: boolean;
}

interface Props {
  nodes: TNode[];
  lines: Poly[];
  /** Resolve display info for a node id. */
  resolve: (id: string, fallback: string) => ResolvedMember;
  /** Click handler for the owner ("self") node, e.g. navigate to a profile. */
  onNodeClick?: (node: TNode) => void;
  /** Click handler for an unclaimed node — should open the "is this you?" prompt. */
  onUnclaimedClick?: (node: TNode) => void;
  /** Click handler for a group node (e.g. "Keluarga Besar"). */
  onGroupClick?: (node: TNode) => void;
  /** Optional node id to highlight (e.g. the invited member from a deep link). */
  highlightId?: string;
  /** Node id to center the initial viewport on (defaults to "self"). */
  focusId?: string;
  className?: string;
}

const PAD = 80; // padding around the tree bounding box (tree coords)
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const INITIAL_SCALE = 1.5;

/** Pannable, zoomable renderer for a family graph, focused on a given node. */
export default function PublicTreeCanvas({ nodes, lines, resolve, onNodeClick, onUnclaimedClick, onGroupClick, highlightId, focusId, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const movedRef = useRef(false);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const box = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, w: 1, h: 1, cx: 0.5, cy: 0.5 };
    const rOf = (id: string, g: TNode['group']) => (STYLE[g]?.size ?? 60) / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = rOf(n.id, n.group);
      minX = Math.min(minX, n.x - r);
      maxX = Math.max(maxX, n.x + r);
      minY = Math.min(minY, n.y - r);
      maxY = Math.max(maxY, n.y + r + 28); // room for name label
    }
    const padMinX = minX - PAD, padMinY = minY - PAD;
    const w = maxX - minX + PAD * 2, h = maxY - minY + PAD * 2;
    return { minX: padMinX, minY: padMinY, w, h, cx: padMinX + w / 2, cy: padMinY + h / 2 };
  }, [nodes]);

  const focusNode = (id: string) => nodes.find((n) => n.id === id) ?? null;

  const resetView = () => {
    const target = focusNode(focusId || 'self');
    setCenter(target ? { x: target.x, y: target.y } : { x: box.cx, y: box.cy });
    setScale(INITIAL_SCALE);
  };

  // Center on the active user (or the deep-linked node) whenever the graph
  // becomes available, instead of defaulting to the bounding-box center
  // (which shows the eldest ancestors first).
  useEffect(() => {
    if (!nodes.length) return;
    const target = focusNode(highlightId || focusId || 'self');
    setCenter(target ? { x: target.x, y: target.y } : { x: box.cx, y: box.cy });
    setScale(INITIAL_SCALE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, focusId, highlightId]);

  const cx = center?.x ?? box.cx;
  const cy = center?.y ?? box.cy;
  const viewW = box.w / scale;
  const viewH = box.h / scale;
  const viewBox = `${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`;

  const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => clampScale(s * factor));
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

  /** Node clicks should be ignored right after a pan drag. */
  const handleNodeClick = (fn?: () => void) => {
    if (movedRef.current) return;
    fn?.();
  };

  const zoomIn = () => setScale((s) => clampScale(s * 1.3));
  const zoomOut = () => setScale((s) => clampScale(s / 1.3));

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
        {/* Connector lines */}
        {lines.map((l, i) => (
          <polyline
            key={i}
            points={l.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={l.marriage ? 'rgba(147,197,253,0.55)' : 'rgba(255,255,255,0.22)'}
            strokeWidth={l.marriage ? 3 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n) => {
          const st = STYLE[n.group];
          const r = st.size / 2;
          const isGroup = n.role === 'group';
          const d = isGroup ? null : resolve(n.id, n.name);
          const alive = d ? d.alive : true;
          const isSelf = n.id === 'self';
          const unclaimed = !isGroup && !isSelf && !d?.verified;
          const groupClickable = isGroup && !!onGroupClick;
          const clickable = groupClickable || (!isGroup && ((isSelf && !!onNodeClick) || (unclaimed && !!onUnclaimedClick)));
          const onClick = () => handleNodeClick(() => {
            if (isGroup) onGroupClick?.(n);
            else if (isSelf) onNodeClick?.(n);
            else if (unclaimed) onUnclaimedClick?.(n);
          });
          return (
            <g
              key={n.id}
              id={`tree-node-${n.id}`}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={alive ? 1 : 0.55}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              onClick={onClick}
            >
              {/* Dashed ring hints that this slot hasn't been claimed by an account yet */}
              {unclaimed && (
                <circle r={r + 4} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="4 3" />
              )}
              {/* Highlight ring for the deep-linked (invited) member */}
              {!isGroup && n.id === highlightId && (
                <circle r={r + 8} fill="none" stroke="#facc15" strokeWidth={3}>
                  <animate attributeName="r" values={`${r + 6};${r + 13};${r + 6}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.95;0.35;0.95" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {d?.photo ? (
                <>
                  <clipPath id={`clip-${n.id}`}>
                    <circle r={r - 1} />
                  </clipPath>
                  <circle r={r} fill={st.bg} stroke={st.border} strokeWidth={2} />
                  <image
                    href={d.photo}
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    clipPath={`url(#clip-${n.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <circle r={r} fill="none" stroke={st.border} strokeWidth={2} />
                </>
              ) : (
                <>
                  <circle r={r} fill={st.bg} stroke={st.border} strokeWidth={2} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize={isGroup ? r * 0.4 : Math.max(11, r * 0.42)}
                    fontWeight={600}
                  >
                    {isGroup ? `×${n.count ?? ''}` : (d?.name ? initials(d.name) : '')}
                  </text>
                </>
              )}

              {/* Name label */}
              {isGroup && n.name && (
                <text
                  y={r + 18}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize={13}
                  fontWeight={500}
                >
                  {n.name}
                </text>
              )}
              {!isGroup && d?.name && (
                <text
                  y={r + 18}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.85)"
                  fontSize={14}
                  fontWeight={500}
                >
                  {d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name}
                </text>
              )}
              {/* Spouse role label */}
              {!isGroup && n.group === 'spouse' && d?.gender && (
                <text
                  y={r + 34}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontSize={11}
                  fontWeight={400}
                >
                  {d.gender === 'P' ? 'Istri' : 'Suami'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Perbesar"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Perkecil"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Kembali ke posisi awal"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-colors"
        >
          <Maximize2 size={15} />
        </button>
      </div>
      {/* Icon fallback marker (kept for parity with explorer styling) */}
      <span className="sr-only"><User size={0} /></span>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
