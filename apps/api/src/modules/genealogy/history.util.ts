/**
 * F2-10 — readable history of a Person. Pure (no Prisma).
 *
 * Every authority action already leaves a trace: PersonRevision (sync, API,
 * approved proposal, merge, privacy, stewards), ChangeProposal, MergeCandidate
 * (+ approvals) and RelationConfirmation. This turns them into one timeline.
 */

export type HistoryKind = 'EDIT' | 'PROPOSAL' | 'MERGE' | 'STEWARD' | 'PRIVACY' | 'RELATION' | 'LINK';

export interface HistoryEntry {
  at: Date;
  kind: HistoryKind;
  /** Who did it (null = the system, e.g. a merge executing after all approvals). */
  actor: string | null;
  text: string;
  source: string;
  /** Done by a platform admin who is not one of the person's managers. */
  adminOverride?: boolean;
}

const FIELD: Record<string, string> = {
  displayName: 'nama', sex: 'jenis kelamin', vitalStatus: 'status hidup/wafat', photo: 'foto',
  birthDate: 'tanggal lahir', deathDate: 'tanggal wafat', birthPlace: 'tempat lahir', privacy: 'privasi',
};
const VALUE: Record<string, Record<string, string>> = {
  sex: { MALE: 'laki-laki', FEMALE: 'perempuan', UNKNOWN: 'tidak diketahui' },
  vitalStatus: { LIVING: 'hidup', DECEASED: 'wafat', UNKNOWN: 'tidak diketahui' },
  privacy: { PUBLIC: 'publik', FAMILY: 'keluarga', PRIVATE: 'pribadi' },
};
const SOURCE: Record<string, string> = {
  LEGACY_SYNC: 'dari pohon', BACKFILL: 'impor awal', API: 'langsung', PROPOSAL: 'usulan disetujui', MERGE: 'penggabungan',
};

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'photo') return 'foto baru';
  if (field === 'birthDate' || field === 'deathDate') {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  }
  return VALUE[field]?.[String(v)] ?? String(v);
}

/** One revision → one sentence (or null when it carries nothing human-relevant). */
export function describeRevision(
  rev: { source: string; diff: Record<string, any> },
  nameOf: (userId: string) => string | null,
): { kind: HistoryKind; text: string } | null {
  const d = rev.diff ?? {};
  if (d.mergedFrom) return { kind: 'MERGE', text: `Digabung dengan data ganda "${d.mergedName ?? 'tanpa nama'}"` };
  if (d.mergedInto) return { kind: 'MERGE', text: 'Data ini digabung ke orang yang sama dan tidak dipakai lagi' };
  if (d.stewardAdded) return { kind: 'STEWARD', text: `${nameOf(d.stewardAdded) ?? 'Seorang anggota'} ditunjuk sebagai wali bersama` };
  if (d.stewardRemoved) return { kind: 'STEWARD', text: `${nameOf(d.stewardRemoved) ?? 'Seorang anggota'} tidak lagi menjadi wali bersama` };
  if (d.userId) return { kind: 'LINK', text: 'Tertaut ke akun pemiliknya' };

  const parts: string[] = [];
  for (const [f, v] of Object.entries(d)) {
    if (!FIELD[f]) continue;
    if (v && typeof v === 'object' && 'to' in v) parts.push(`${FIELD[f]}: ${show(f, (v as any).from)} → ${show(f, (v as any).to)}`);
    else parts.push(`${FIELD[f]} → ${show(f, v)}`);
  }
  if (!parts.length) return null;
  const kind: HistoryKind = Object.keys(d).every((k) => k === 'privacy') ? 'PRIVACY' : 'EDIT';
  const via = SOURCE[rev.source] ? ` (${SOURCE[rev.source]})` : '';
  return { kind, text: `Diubah${via}: ${parts.join(', ')}` };
}

export function describeProposalStatus(status: string): string {
  return ({
    PENDING: 'menunggu keputusan', APPROVED: 'disetujui', REJECTED: 'ditolak', WITHDRAWN: 'ditarik pengusul',
    SUPERSEDED: 'tidak berlaku (data sudah berubah)', EXPIRED: 'kedaluwarsa',
  } as Record<string, string>)[status] ?? status.toLowerCase();
}

/** Newest first; ties keep insertion order. */
export function sortTimeline(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.map((e, i) => ({ e, i })).sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || a.i - b.i).map((x) => x.e);
}
