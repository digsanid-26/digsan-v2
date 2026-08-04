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
  /** Custom status label that overrides the auto-generated role label. */
  statusLabel?: string | null;
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
  /** Set of tags that are currently visible. Nodes/lines with a tag not in this set are hidden (opacity 0). */
  visibleTags?: Set<string>;
  /** Hover handler for a node. */
  onNodeHover?: (node: TNode | null) => void;
  /** Map of nodeId to opacity override (0-1). If present, overrides default behavior. */
  nodeOpacity?: Record<string, number>;
  /** Map of line index to opacity override (0-1). */
  lineOpacity?: number[];
  /** When true, clicking a node centers it in the viewport (default: true). */
  anchorOnClick?: boolean;
  /** Called when the SVG background (not a node) is clicked. */
  onBackgroundClick?: () => void;
  /** Node id currently hovered (for showing expand overlay). */
  hoveredNodeId?: string | null;
  /** Close buttons to render at line junctions for expanded branches. */
  closeButtons?: { x: number; y: number; tag: string }[];
  /** Called when a close button is clicked. */
  onCloseBranch?: (tag: string) => void;
}

const PAD = 80; // padding around the tree bounding box (tree coords)
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const INITIAL_SCALE = 1.5;

/** Pannable, zoomable renderer for a family graph, focused on a given node. */
export default function PublicTreeCanvas({ nodes, lines, resolve, onNodeClick, onUnclaimedClick, onGroupClick, highlightId, focusId, className, visibleTags, onNodeHover, nodeOpacity, lineOpacity, anchorOnClick = true, onBackgroundClick, hoveredNodeId, closeButtons, onCloseBranch }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const movedRef = useRef(false);
  const nodeClickedRef = useRef(false);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

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
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
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

  /** Background click (not on a node) — fires after drag ends without movement. */
  const onBackgroundPointerUp = () => {
    if (!movedRef.current && !nodeClickedRef.current) onBackgroundClick?.();
    nodeClickedRef.current = false;
  };

  /** Smoothly animate center to a target position. */
  const animateCenter = (targetX: number, targetY: number, duration = 450) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const startX = center?.x ?? box.cx;
    const startY = center?.y ?? box.cy;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // easeInOutCubic
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setCenter({ x: startX + (targetX - startX) * e, y: startY + (targetY - startY) * e });
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  /** Node clicks should be ignored right after a pan drag. */
  const handleNodeClick = (fn?: () => void, node?: TNode) => {
    if (movedRef.current) return;
    nodeClickedRef.current = true;
    if (anchorOnClick && node) animateCenter(node.x, node.y);
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
      onPointerUp={(e) => { endDrag(); onBackgroundPointerUp(); }}
      onPointerLeave={endDrag}
    >
      <svg viewBox={viewBox} className="w-full h-full" style={{ display: 'block' }}>
        {/* Connector lines */}
        {lines.map((l, i) => {
          let opacity = 1;
          if (lineOpacity && lineOpacity[i] !== undefined) {
            opacity = lineOpacity[i];
          } else if (l.tag && visibleTags && !visibleTags.has(l.tag)) {
            opacity = 0;
          }
          return (
            <polyline
              key={i}
              points={l.points.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke={l.marriage ? 'rgba(147,197,253,0.55)' : 'rgba(255,255,255,0.22)'}
              strokeWidth={l.marriage ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity, transition: 'opacity 0.4s ease' }}
            />
          );
        })}

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
          const clickable = groupClickable || (!isGroup && (!!onNodeClick || (unclaimed && !!onUnclaimedClick)));
          const onClick = () => handleNodeClick(() => {
            if (isGroup) onGroupClick?.(n);
            else if (onNodeClick) onNodeClick?.(n);
            else if (unclaimed) onUnclaimedClick?.(n);
          }, n);
          // Compute opacity: explicit override > tag-based > default
          let nodeOp = alive ? 1 : 0.55;
          if (nodeOpacity && nodeOpacity[n.id] !== undefined) {
            nodeOp = nodeOpacity[n.id];
          } else if (n.tag && visibleTags && !visibleTags.has(n.tag)) {
            nodeOp = 0;
          }
          return (
            <g
              key={n.id}
              id={`tree-node-${n.id}`}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={nodeOp}
              style={{ cursor: clickable ? 'pointer' : 'default', transition: 'opacity 0.4s ease' }}
              onClick={onClick}
              onMouseEnter={() => onNodeHover?.(n)}
              onMouseLeave={() => onNodeHover?.(null)}
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
              {/* Buka overlay on hovered Ortu / Saudara group nodes */}
              {hoveredNodeId === n.id && (n.name === 'Ortu' || (isGroup && n.name?.startsWith('Saudara'))) && (
                <g pointerEvents="none">
                  <rect x={-r} y={-10} width={r * 2} height={20} rx={10} fill="rgba(0,0,0,0.7)" />
                  <text textAnchor="middle" dominantBaseline="central" fill="#facc15" fontSize={12} fontWeight={600}>Buka</text>
                </g>
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
              {!isGroup && n.group === 'spouse' && (
                <text
                  y={r + 34}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontSize={11}
                  fontWeight={400}
                >
                  {d?.statusLabel || (d?.gender === 'P' ? 'Istri' : 'Suami')}
                </text>
              )}
              {/* Kepala Keluarga label for the male in the couple (self or spouse) — skip if custom statusLabel is set */}
              {!isGroup && d?.gender === 'L' && (n.group === 'self' || n.group === 'spouse') && !d?.statusLabel && (
                <text
                  y={r + (n.group === 'spouse' ? 50 : 34)}
                  textAnchor="middle"
                  fill="rgba(250,204,21,0.7)"
                  fontSize={10}
                  fontWeight={600}
                >
                  Kepala Keluarga
                </text>
              )}
              {/* Child label: Anak{n}{gender} or custom statusLabel */}
              {!isGroup && n.group === 'child' && d?.name && (() => {
                if (d?.statusLabel) {
                  return (
                    <text
                      y={r + 34}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize={11}
                      fontWeight={400}
                    >
                      {d.statusLabel}
                    </text>
                  );
                }
                const childIdx = parseInt(n.id.replace('child-', ''), 10) + 1;
                const genderLabel = d?.gender === 'L' ? 'pa' : d?.gender === 'P' ? 'pi' : '';
                return (
                  <text
                    y={r + 34}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize={11}
                    fontWeight={400}
                  >
                    {`Anak ${childIdx}${genderLabel}`}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Close buttons for expanded branches */}
        {closeButtons?.map((btn) => (
          <g
            key={`close-${btn.tag}`}
            transform={`translate(${btn.x}, ${btn.y})`}
            style={{ cursor: 'pointer' }}
            pointerEvents="all"
            onClick={(e) => {
              e.stopPropagation();
              onCloseBranch?.(btn.tag);
            }}
          >
            <circle r={8} fill="#ef4444" stroke="#fff" strokeWidth={1} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
            <path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        ))}
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
