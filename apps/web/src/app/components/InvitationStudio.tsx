'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Share2, MessageCircle, Send, Copy, Check, Image as ImageIcon } from 'lucide-react';
import type { Group, TNode, Poly } from './treeTypes';

// ─── Types ──────────────────────────────────────────────────

type Palette = Record<Group, { bg: string; border: string; size: number }>;

interface Props {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  nodes: TNode[];
  lines: Poly[];
  palette: Palette;
  aliveOf?: (id: string) => boolean;
  inviterName: string;
  treeName?: string;
  region?: Region | null;
  highlightIds?: string[];
}

export interface Region { minX: number; maxX: number; minY: number; maxY: number; }

// ─── Canvas drawing helpers ─────────────────────────────────

const OUT_W = 1080;              // output width (social-friendly)
const MARGIN = 56;               // side margin around the tree
const HEADER_H = 150;            // title band
const MAX_TREE_H = 900;          // cap the tree area height
const WATERMARK = 'dibuat dengan digsan.id';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draws the composed invitation onto the canvas and returns its height. */
function drawInvitation(
  canvas: HTMLCanvasElement,
  opts: {
    nodes: TNode[]; lines: Poly[]; palette: Palette;
    aliveOf?: (id: string) => boolean;
    title: string; message: string;
    region?: Region | null; highlight?: Set<string>;
  },
): void {
  const { nodes, lines, palette, aliveOf, title, message, region, highlight } = opts;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rOf = (g: Group) => (palette[g]?.size ?? 60) / 2;

  // Restrict to a selected region (drag-select) or use the whole tree.
  let drawNodes = nodes;
  let drawLines = lines;
  let minX: number, maxX: number, minY: number, maxY: number;
  if (region) {
    const m = 44; // padding around the region (tree coords)
    minX = region.minX - m; maxX = region.maxX + m;
    minY = region.minY - m; maxY = region.maxY + m;
    drawNodes = nodes.filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY);
    drawLines = lines.filter((l) => l.points.every(([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY));
  } else {
    const rs = nodes.map((n) => rOf(n.group));
    minX = Math.min(...nodes.map((n, i) => n.x - rs[i]));
    maxX = Math.max(...nodes.map((n, i) => n.x + rs[i]));
    minY = Math.min(...nodes.map((n, i) => n.y - rs[i]));
    maxY = Math.max(...nodes.map((n, i) => n.y + rs[i]));
  }
  const labelPad = 46; // room for name labels under nodes
  const treeW = Math.max(1, maxX - minX);
  const treeH = Math.max(1, maxY - minY + labelPad);

  const innerW = OUT_W - MARGIN * 2;
  const scale = Math.min(innerW / treeW, MAX_TREE_H / treeH);
  const scaledTreeH = treeH * scale;
  const scaledTreeW = treeW * scale;

  // Measure footer message.
  const msgFont = 30;
  ctx.font = `500 ${msgFont}px system-ui, sans-serif`;
  const msgLines = message.trim() ? wrapText(ctx, message.trim(), innerW) : [];
  const footerH = (msgLines.length ? msgLines.length * (msgFont + 10) + 40 : 24) + 46;

  const totalH = HEADER_H + scaledTreeH + 40 + footerH;

  // High-DPI backing store.
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(OUT_W * dpr);
  canvas.height = Math.round(totalH * dpr);
  canvas.style.width = `${OUT_W}px`;
  canvas.style.height = `${totalH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background gradient.
  const bg = ctx.createLinearGradient(0, 0, OUT_W, totalH);
  bg.addColorStop(0, '#0b1220');
  bg.addColorStop(0.5, '#111a30');
  bg.addColorStop(1, '#0a0f1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, OUT_W, totalH);

  // Subtle vignette glow.
  const glow = ctx.createRadialGradient(OUT_W / 2, HEADER_H + scaledTreeH / 2, 60, OUT_W / 2, HEADER_H + scaledTreeH / 2, OUT_W);
  glow.addColorStop(0, 'rgba(59,130,246,0.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, OUT_W, totalH);

  // Title.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.fillText(title || 'Silsilah Keluarga', OUT_W / 2, 66, innerW);
  ctx.fillStyle = 'rgba(147,197,253,0.85)';
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Pohon Keluarga', OUT_W / 2, 112, innerW);

  // Tree transform: center horizontally within inner width.
  const offsetX = MARGIN + (innerW - scaledTreeW) / 2 - minX * scale;
  const offsetY = HEADER_H - minY * scale;
  const tx = (x: number) => offsetX + x * scale;
  const ty = (y: number) => offsetY + y * scale;

  // Connector lines.
  for (const l of drawLines) {
    ctx.beginPath();
    l.points.forEach(([x, y], i) => {
      const px = tx(x), py = ty(y);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = l.marriage ? 'rgba(147,197,253,0.6)' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = (l.marriage ? 3 : 2) * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Nodes.
  for (const n of drawNodes) {
    const r = rOf(n.group) * scale;
    const cx = tx(n.x), cy = ty(n.y);
    const pal = palette[n.group] || palette.self;
    const alive = aliveOf ? aliveOf(n.id) !== false : true;

    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.5;
    // Glow ring.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pal.bg;
    ctx.shadowColor = pal.border;
    ctx.shadowBlur = 14 * scale;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeStyle = pal.border;
    ctx.stroke();

    // Initials.
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(9, r * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isGroup = n.role === 'group';
    ctx.fillText(isGroup ? `×${n.count ?? ''}` : initials(n.name), cx, cy);
    ctx.restore();

    // Highlight ring + "Lengkapi" tag for nodes the invitee should fill/activate.
    if (highlight?.has(n.id)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.setLineDash([8 * scale, 6 * scale]);
      ctx.shadowColor = 'rgba(251,191,36,0.9)';
      ctx.shadowBlur = 18 * scale;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      const tag = 'Lengkapi';
      ctx.font = `700 ${Math.max(9, 12 * scale)}px system-ui, sans-serif`;
      const tw = ctx.measureText(tag).width + 14 * scale;
      const th = 22 * scale;
      const bx = cx - tw / 2, by = cy - r - th - 6 * scale;
      const rr = 6 * scale;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(bx + rr, by);
      ctx.arcTo(bx + tw, by, bx + tw, by + th, rr);
      ctx.arcTo(bx + tw, by + th, bx, by + th, rr);
      ctx.arcTo(bx, by + th, bx, by, rr);
      ctx.arcTo(bx, by, bx + tw, by, rr);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, cx, by + th / 2);
      ctx.restore();
    }

    // Name label under node.
    if (!isGroup) {
      ctx.fillStyle = alive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
      ctx.font = `600 ${Math.max(9, 13 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name;
      ctx.fillText(label, cx, cy + r + 4 * scale, rOf(n.group) * scale * 3);
      if (!alive) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('\u2020', cx + r * 0.9, cy - r * 0.9);
      }
    }
  }

  // Footer message.
  let fy = HEADER_H + scaledTreeH + 44;
  if (msgLines.length) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${msgFont}px system-ui, sans-serif`;
    for (const line of msgLines) {
      ctx.fillText(line, OUT_W / 2, fy, innerW);
      fy += msgFont + 10;
    }
    fy += 12;
  }

  // Watermark.
  ctx.fillStyle = 'rgba(147,197,253,0.7)';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(WATERMARK, OUT_W / 2, totalH - 30);
}

// ─── Component ──────────────────────────────────────────────

export default function InvitationStudio({
  open, onClose, dark, nodes, lines, palette, aliveOf, inviterName, treeName, region, highlightIds,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const defaultTitle = useMemo(
    () => (treeName ? `Silsilah Keluarga ${treeName}` : 'Silsilah Keluarga Kami'),
    [treeName],
  );
  const highlightKey = (highlightIds ?? []).join(',');
  const highlightSet = useMemo(() => new Set(highlightIds ?? []), [highlightKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const defaultMessage = useMemo(
    () => (highlightSet.size
      ? `Halo! ${inviterName || 'Saya'} mengajak Anda bergabung di digsan.id. Mohon lengkapi/aktifkan bagian yang ditandai "Lengkapi" pada silsilah keluarga kita.`
      : `Halo! ${inviterName || 'Saya'} mengajak Anda melihat & melengkapi silsilah keluarga kita di digsan.id. Yuk bergabung!`),
    [inviterName, highlightSet],
  );

  // Seed defaults when opened.
  useEffect(() => {
    if (open) {
      setTitle((t) => t || defaultTitle);
      setMessage((m) => m || defaultMessage);
    }
  }, [open, defaultTitle, defaultMessage]);

  const regenerate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;
    drawInvitation(canvas, {
      nodes, lines, palette, aliveOf,
      title: title || defaultTitle,
      message: message || defaultMessage,
      region, highlight: highlightSet,
    });
    try { setPreviewUrl(canvas.toDataURL('image/png')); } catch { /* tainted canvas — ignore */ }
  }, [nodes, lines, palette, aliveOf, title, message, defaultTitle, defaultMessage, region, highlightSet]);

  // Redraw when opened or content changes.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(regenerate, 120);
    return () => clearTimeout(id);
  }, [open, regenerate]);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://digsan.id';
  const shareText = `${message || defaultMessage}\n${shareUrl}`;

  const getBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

  const download = async () => {
    const url = previewUrl || canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `undangan-${(treeName || 'digsan').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareNative = async () => {
    const blob = await getBlob();
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
    if (blob && nav.canShare) {
      const file = new File([blob], 'undangan-digsan.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], text: shareText, title: title || defaultTitle }); return; } catch { /* cancelled */ return; }
      }
    }
    if (navigator.share) { try { await navigator.share({ text: shareText, title: title || defaultTitle, url: shareUrl }); } catch { /* cancelled */ } return; }
    await copyText();
  };

  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
  const shareTelegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message || defaultMessage)}`, '_blank', 'noopener');

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          dark ? 'bg-[#0a0e1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold">Buat Undangan (Gambar Silsilah)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-5 p-5">
          {/* Preview */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-3 flex items-center justify-center min-h-[280px]">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Pratinjau undangan" className="max-h-[60vh] w-auto rounded-lg shadow-lg" />
            ) : (
              <p className="text-sm text-slate-400">{nodes.length ? 'Menyiapkan pratinjau…' : 'Belum ada silsilah untuk ditampilkan.'}</p>
            )}
          </div>

          {/* Form + actions */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Judul</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border bg-white border-slate-200 dark:bg-white/5 dark:border-white/15 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1">Pesan Undangan</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border resize-none bg-white border-slate-200 dark:bg-white/5 dark:border-white/15 dark:text-white" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={download}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                <Download size={16} />Download
              </button>
              <button onClick={shareNative}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                <Share2 size={16} />Bagikan
              </button>
              <button onClick={shareWhatsApp}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                <MessageCircle size={16} />WhatsApp
              </button>
              <button onClick={shareTelegram}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors">
                <Send size={16} />Telegram
              </button>
              <button onClick={copyText}
                className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10 transition-colors">
                {copied ? <><Check size={16} className="text-emerald-500" />Tersalin</> : <><Copy size={16} />Salin Teks + Tautan</>}
              </button>
            </div>

            <p className="text-[11px] leading-snug text-slate-400 dark:text-white/40">
              Tip: <b>Download</b> gambar lalu lampirkan di WhatsApp/Telegram/sosmed. Di ponsel, <b>Bagikan</b> dapat langsung mengirim gambar. Tautan mengarah ke halaman digsan.id.
            </p>
          </div>
        </div>

        {/* Offscreen render target */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
