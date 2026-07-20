'use client';

import { useMemo } from 'react';
import { User } from 'lucide-react';
import type { TNode, Poly } from './treeTypes';
import { STYLE } from './treeStyle';

interface Props {
  nodes: TNode[];
  lines: Poly[];
  /** Resolve display info for a node id. */
  resolve: (id: string, fallback: string) => { name: string; photo: string | null; alive: boolean; gender?: string };
  /** Optional click handler (e.g. navigate to a profile). */
  onNodeClick?: (node: TNode) => void;
  /** Optional node id to highlight (e.g. the invited member from a deep link). */
  highlightId?: string;
  className?: string;
}

const PAD = 80; // padding around the tree bounding box (tree coords)

/** Read-only, fit-to-container renderer for a family graph. */
export default function PublicTreeCanvas({ nodes, lines, resolve, onNodeClick, highlightId, className }: Props) {
  const box = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, w: 1, h: 1 };
    const rOf = (id: string, g: TNode['group']) => (STYLE[g]?.size ?? 60) / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = rOf(n.id, n.group);
      minX = Math.min(minX, n.x - r);
      maxX = Math.max(maxX, n.x + r);
      minY = Math.min(minY, n.y - r);
      maxY = Math.max(maxY, n.y + r + 28); // room for name label
    }
    return { minX: minX - PAD, minY: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  }, [nodes]);

  return (
    <div className={className}>
      <svg viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`} className="w-full h-full" style={{ overflow: 'visible' }}>
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
          const clickable = !isGroup && !!onNodeClick;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={alive ? 1 : 0.55}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              onClick={() => clickable && onNodeClick?.(n)}
            >
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
