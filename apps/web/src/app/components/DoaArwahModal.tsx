'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  configToGraph,
  neighborsOf,
  type FamilyGraph,
} from './familyGraph';
import type { TreeConfig, Members } from './treeTypes';
import {
  X, Printer, Download, FileText, Heart,
} from 'lucide-react';

interface DeceasedEntry {
  id: string;
  name: string;
  role: string;
  gender: string;
  distance: number;
  parentName: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  config: TreeConfig;
  members: Members;
  selfName: string;
  selfNodeId?: string;
  treeName?: string;
}

// BFS from self → find all deceased members sorted by distance
function findDeceased(graph: FamilyGraph, rootId: string): DeceasedEntry[] {
  const visited = new Set<string>([rootId]);
  const queue: { id: string; dist: number }[] = [{ id: rootId, dist: 0 }];
  const result: DeceasedEntry[] = [];

  while (queue.length) {
    const { id, dist } = queue.shift()!;
    const m = graph[id];
    if (!m) continue;

    if (!m.alive && !m.isSelf) {
      const parent = m.parentId ? graph[m.parentId] : null;
      result.push({
        id: m.id,
        name: m.name || '(Tanpa Nama)',
        role: m.role || '',
        gender: m.gender || '',
        distance: dist,
        parentName: parent ? parent.name : null,
      });
    }

    for (const nb of neighborsOf(graph, id)) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      queue.push({ id: nb, dist: dist + 1 });
    }
  }

  return result.sort((a, b) => a.distance - b.distance);
}

const DISTANCE_LABELS: Record<number, string> = {
  1: 'Keluarga Inti',
  2: 'Keluarga Dekat',
  3: 'Keluarga Simbah',
  4: 'Keluarga Buyut',
  5: 'Leluhur',
};

function distanceLabel(d: number): string {
  return DISTANCE_LABELS[d] || `Generasi ke-${d}`;
}

function formatName(entry: DeceasedEntry): string {
  let name = entry.name;
  if (entry.parentName && entry.gender) {
    const link = entry.gender === 'P' ? 'binti' : 'bin';
    name = `${name} ${link} ${entry.parentName}`;
  }
  return name;
}

export default function DoaArwahModal({
  open, onClose, dark, config, members, selfName, selfNodeId, treeName,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(14);
  const [fontWeight, setFontWeight] = useState(400);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [maxDepth, setMaxDepth] = useState(99);

  const graph = useMemo(
    () => configToGraph(config, members, selfName, selfNodeId),
    [config, members, selfName, selfNodeId],
  );

  const deceased = useMemo(
    () => findDeceased(graph, selfNodeId || 'self').filter((d) => d.distance <= maxDepth),
    [graph, selfNodeId, maxDepth],
  );

  // Group by distance
  const grouped = useMemo(() => {
    const map = new Map<number, DeceasedEntry[]>();
    for (const d of deceased) {
      if (!map.has(d.distance)) map.set(d.distance, []);
      map.get(d.distance)!.push(d);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [deceased]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Doa Arwah - ${treeName || selfName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Times New Roman', serif;
            padding: 40px;
            background: #fff;
            color: #1a1a1a;
          }
          h1 {
            text-align: center;
            font-size: 22px;
            margin-bottom: 8px;
          }
          .subtitle {
            text-align: center;
            font-size: 14px;
            color: #666;
            margin-bottom: 6px;
          }
          .bismillah {
            text-align: center;
            font-size: 18px;
            margin: 20px 0;
            color: #333;
          }
          .section-title {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #555;
            margin: 20px 0 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
          }
          .name-list {
            list-style: none;
            padding: 0;
          }
          .name-list li {
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            text-align: ${align};
            padding: 4px 0;
            line-height: 1.8;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #999;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Doa Arwah</h1>
        <div class="subtitle">Keluarga ${treeName || selfName}</div>
        <div class="bismillah">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</div>
        ${grouped.map(([dist, entries]) => `
          <div class="section-title">${distanceLabel(dist)}</div>
          <ul class="name-list">
            ${entries.map((e) => `<li>${formatName(e)}</li>`).join('')}
          </ul>
        `).join('')}
        <div class="footer">
          Dicetak dari Digsan.id — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  const handleExportJPG = async () => {
    const content = printRef.current;
    if (!content) return;

    // Create canvas from the styled content
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 800;
    const padding = 40;
    const lineH = fontSize * 1.8;
    const sectionH = 40;

    // Calculate total height
    let totalH = padding * 2 + 100; // title + bismillah
    for (const [, entries] of grouped) {
      totalH += sectionH + entries.length * lineH;
    }
    totalH += 40; // footer

    canvas.width = w;
    canvas.height = totalH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, totalH);

    let y = padding;

    // Title
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px Times New Roman, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Doa Arwah', w / 2, y + 22);
    y += 30;

    ctx.font = '14px Times New Roman, serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`Keluarga ${treeName || selfName}`, w / 2, y + 18);
    y += 28;

    ctx.font = '18px Times New Roman, serif';
    ctx.fillStyle = '#333';
    ctx.fillText('بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ', w / 2, y + 24);
    y += 44;

    // Entries
    for (const [dist, entries] of grouped) {
      ctx.font = 'bold 13px Times New Roman, serif';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'left';
      ctx.fillText(distanceLabel(dist).toUpperCase(), padding, y + 16);
      y += sectionH;

      ctx.font = `${fontWeight} ${fontSize}px Times New Roman, serif`;
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = align;
      const tx = align === 'center' ? w / 2 : align === 'right' ? w - padding : padding;
      for (const e of entries) {
        ctx.fillText(formatName(e), tx, y + 14);
        y += lineH;
      }
    }

    // Footer
    y += 20;
    ctx.font = '12px Times New Roman, serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Dicetak dari Digsan.id — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      w / 2, y,
    );

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doa-arwah-${treeName || selfName}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  };

  const handleExportPDF = () => {
    // Use print dialog — user can "Save as PDF"
    handlePrint();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Heart size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Doa Arwah</h2>
              <p className="text-xs text-slate-400 dark:text-white/40">
                {deceased.length} anggota keluarga telah meninggal dunia
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-white/50">Font:</label>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-2 py-1 text-slate-700 dark:text-white outline-none"
            >
              {[12, 14, 16, 18, 20].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-white/50">Tebal:</label>
            <select
              value={fontWeight}
              onChange={(e) => setFontWeight(Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-2 py-1 text-slate-700 dark:text-white outline-none"
            >
              <option value={400}>Normal</option>
              <option value={600}>Sedang</option>
              <option value={700}>Tebal</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-white/50">Rata:</label>
            <select
              value={align}
              onChange={(e) => setAlign(e.target.value as any)}
              className="text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-2 py-1 text-slate-700 dark:text-white outline-none"
            >
              <option value="left">Kiri</option>
              <option value="center">Tengah</option>
              <option value="right">Kanan</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-white/50">Kedalaman:</label>
            <select
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="text-xs rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-2 py-1 text-slate-700 dark:text-white outline-none"
            >
              <option value={1}>Inti saja</option>
              <option value={2}>Sampai Simbah</option>
              <option value={3}>Sampai Buyut</option>
              <option value={5}>Sampai Leluhur</option>
              <option value={99}>Semua</option>
            </select>
          </div>
        </div>

        {/* Content (preview) */}
        <div className="flex-1 overflow-y-auto p-5" ref={printRef}>
          {deceased.length === 0 ? (
            <div className="text-center py-12">
              <Heart size={32} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
              <p className="text-sm text-slate-400 dark:text-white/40">
                Tidak ada anggota keluarga yang dicatat meninggal dunia dalam silsilah ini.
              </p>
              <p className="text-xs text-slate-400 dark:text-white/30 mt-2">
                Tandai status "Meninggal Dunia" pada profil anggota di Tree Explorer untuk menampilkannya di sini.
              </p>
            </div>
          ) : (
            <div style={{ fontFamily: 'Times New Roman, serif' }}>
              <h1 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-1">Doa Arwah</h1>
              <p className="text-center text-sm text-slate-500 dark:text-white/50 mb-4">
                Keluarga {treeName || selfName}
              </p>
              <p className="text-center text-lg text-slate-700 dark:text-white/70 mb-6">
                بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
              </p>
              {grouped.map(([dist, entries]) => (
                <div key={dist} className="mb-5">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2 pb-1 border-b border-slate-200 dark:border-white/10"
                  >
                    {distanceLabel(dist)} ({entries.length})
                  </h3>
                  <ul className="space-y-0.5">
                    {entries.map((e) => (
                      <li
                        key={e.id}
                        style={{
                          fontSize: `${fontSize}px`,
                          fontWeight,
                          textAlign: align,
                          lineHeight: 1.8,
                        }}
                        className="text-slate-800 dark:text-white/85 py-0.5"
                      >
                        {formatName(e)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-center text-xs text-slate-400 dark:text-white/30 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                Dibuat dari Digsan.id — {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {deceased.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-white/10 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5 transition-colors"
            >
              <Printer size={15} /> Cetak
            </button>
            <button
              onClick={handleExportJPG}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5 transition-colors"
            >
              <Download size={15} /> JPG
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
            >
              <FileText size={15} /> PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
