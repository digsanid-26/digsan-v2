'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, GitMerge, Inbox, Link2, Loader2, PencilLine, Send, ShieldCheck, Undo2, UserPlus, Users, X } from 'lucide-react';
import {
  treeApi,
  type ChangeProposal,
  type IncomingLinkRequest,
  type MergeCandidate,
  type PendingRelation,
  type Stewardships,
} from '@/lib/tree';

const FIELD_LABEL: Record<string, string> = {
  displayName: 'Nama', sex: 'Jenis kelamin', vitalStatus: 'Status', photo: 'Foto',
  birthDate: 'Tanggal lahir', deathDate: 'Tanggal wafat', birthPlace: 'Tempat lahir',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', SUPERSEDED: 'Tidak berlaku', EXPIRED: 'Kedaluwarsa',
};
const ROLE_LABEL: Record<string, string> = { OWNER: 'Pemilik', PRIMARY: 'Pengelola utama', CO_STEWARD: 'Wali bersama', GUARDIAN: 'Wali' };

function fieldValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'sex') return v === 'MALE' ? 'Laki-laki' : v === 'FEMALE' ? 'Perempuan' : 'Tidak diketahui';
  if (field === 'vitalStatus') return v === 'DECEASED' ? 'Wafat' : v === 'LIVING' ? 'Hidup' : 'Tidak diketahui';
  if (field === 'photo') return 'foto baru';
  if (field === 'birthDate' || field === 'deathDate') return new Date(String(v)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return String(v);
}

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5';
const btnYes = 'inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50';
const btnNo = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5';

function Section({ icon: Icon, title, hint, count, children }: { icon: typeof Inbox; title: string; hint: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-blue-500" />
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        {!!count && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{count}</span>}
      </div>
      <p className="-mt-2 text-xs text-slate-500 dark:text-white/50">{hint}</p>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-white/10 dark:text-white/40">{text}</p>
);

export default function FamilyRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [relations, setRelations] = useState<PendingRelation[]>([]);
  const [incoming, setIncoming] = useState<ChangeProposal[]>([]);
  const [outgoing, setOutgoing] = useState<ChangeProposal[]>([]);
  const [merges, setMerges] = useState<MergeCandidate[]>([]);
  const [links, setLinks] = useState<IncomingLinkRequest[]>([]);
  const [stewardships, setStewardships] = useState<Stewardships>({ persons: [], familyAccounts: [] });
  const [appoint, setAppoint] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [r, i, o, m, l, s] = await Promise.all([
      settle(treeApi.getPendingRelations(), []),
      settle(treeApi.getProposals('incoming'), []),
      settle(treeApi.getProposals('outgoing'), []),
      settle(treeApi.getMergeCandidates(), []),
      settle(treeApi.getIncomingLinkRequests(), []),
      settle(treeApi.getStewardships(), { persons: [], familyAccounts: [] }),
    ]);
    setRelations(r); setIncoming(i); setOutgoing(o); setMerges(m); setLinks(l); setStewardships(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setActing(key);
    setError(null);
    try {
      await fn();
      if (done) alert(done);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Gagal memproses permintaan');
      await load();
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-500" /></div>;
  }

  const waiting = relations.length + incoming.length + merges.length + links.length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-500/20">
          <Inbox size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Permintaan Keluarga</h1>
          <p className="text-sm text-slate-500 dark:text-white/50">
            {waiting ? `${waiting} permintaan menunggu keputusan Anda` : 'Tidak ada yang menunggu keputusan Anda'}
          </p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      <Section icon={Link2} title="Apakah ini Anda?" hint="Anggota keluarga menautkan akun Anda ke lingkaran di pohon mereka." count={links.length}>
        {links.length === 0 ? <Empty text="Tidak ada permintaan tautan." /> : links.map((l) => (
          <div key={l.id} className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center`}>
            <p className="flex-1 text-sm text-slate-700 dark:text-white/80">
              <b>{l.requester?.name ?? 'Seseorang'}</b> menautkan Anda sebagai <b>{l.nodeName}</b> di pohon <b>{l.treeName}</b>.
            </p>
            <div className="flex gap-2">
              <button className={btnYes} disabled={acting === l.id} onClick={() => act(l.id, () => treeApi.respondLinkRequest(l.id, true))}><Check size={14} /> Ya, ini saya</button>
              <button className={btnNo} disabled={acting === l.id} onClick={() => act(l.id, () => treeApi.respondLinkRequest(l.id, false))}><X size={14} /> Bukan</button>
            </div>
          </div>
        ))}
      </Section>

      <Section icon={ShieldCheck} title="Konfirmasi hubungan" hint="Hubungan yang dicatat orang lain dan melibatkan Anda. Sampai Anda konfirmasi, hubungan ini berstatus usulan." count={relations.length}>
        {relations.length === 0 ? <Empty text="Tidak ada hubungan yang perlu dikonfirmasi." /> : relations.map((r) => (
          <div key={r.id} className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center`}>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{r.description}</p>
              <p className="text-xs text-slate-500 dark:text-white/50">Dicatat oleh {r.proposedBy ?? 'anggota keluarga'}</p>
            </div>
            <div className="flex gap-2">
              <button className={btnYes} disabled={acting === r.id} onClick={() => act(r.id, () => treeApi.decideRelation(r.kind, r.id, true))}><Check size={14} /> Benar</button>
              <button className={btnNo} disabled={acting === r.id} onClick={() => act(r.id, () => treeApi.decideRelation(r.kind, r.id, false))}><X size={14} /> Tidak benar</button>
            </div>
          </div>
        ))}
      </Section>

      <Section icon={PencilLine} title="Usulan perubahan data" hint="Kerabat mengusulkan perbaikan data orang yang Anda kelola. Jika disetujui, semua pohon yang memuat orang itu ikut berubah." count={incoming.length}>
        {incoming.length === 0 ? <Empty text="Tidak ada usulan perubahan." /> : incoming.map((p) => (
          <div key={p.id} className={card}>
            <p className="text-sm text-slate-700 dark:text-white/80"><b>{p.proposer.name ?? 'Anggota keluarga'}</b> mengusulkan perubahan untuk <b>{p.person.displayName}</b>:</p>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(p.changes).map(([f, c]) => (
                <li key={f} className="text-slate-600 dark:text-white/70">
                  {FIELD_LABEL[f] ?? f}: <span className="line-through opacity-60">{fieldValue(f, c.from)}</span> → <b className="text-slate-900 dark:text-white">{fieldValue(f, c.to)}</b>
                </li>
              ))}
            </ul>
            {p.note && <p className="mt-2 text-xs italic text-slate-500 dark:text-white/50">“{p.note}”</p>}
            <div className="mt-3 flex gap-2">
              <button className={btnYes} disabled={acting === p.id} onClick={() => act(p.id, () => treeApi.decideProposal(p.id, true), 'Perubahan diterapkan ke semua pohon yang memuat orang ini.')}><Check size={14} /> Setujui</button>
              <button className={btnNo} disabled={acting === p.id} onClick={() => act(p.id, () => treeApi.decideProposal(p.id, false))}><X size={14} /> Tolak</button>
            </div>
          </div>
        ))}
      </Section>

      <Section icon={GitMerge} title="Kemungkinan orang yang sama" hint="Orang yang tercatat dua kali di silsilah. Digabung hanya jika semua pengelola setuju." count={merges.length}>
        {merges.length === 0 ? <Empty text="Tidak ada usulan penggabungan." /> : merges.map((m) => (
          <div key={m.id} className={card}>
            <div className="grid gap-2 sm:grid-cols-2">
              {[m.personA, m.personB].map((p, idx) => p && (
                <div key={idx} className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                  <p className="font-medium text-slate-900 dark:text-white">{p.displayName}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">{p.drawnBy.length ? `Tercatat oleh ${p.drawnBy.join(', ')}` : 'Tercatat di silsilah'}{p.hasAccount ? ' · punya akun' : ''}</p>
                </div>
              ))}
            </div>
            {m.sharedChildren.length > 0 && <p className="mt-2 text-xs text-slate-500 dark:text-white/50">Sama-sama tercatat sebagai orang tua dari: {m.sharedChildren.join(', ')}</p>}
            <p className="mt-1 text-xs text-slate-500 dark:text-white/50">Persetujuan: {m.approvalsGiven}/{m.approvalsNeeded}{m.myDecision === true ? ' · Anda sudah setuju' : ''}</p>
            {m.myDecision !== true && (
              <div className="mt-3 flex gap-2">
                <button className={btnYes} disabled={acting === m.id} onClick={() => act(m.id, () => treeApi.decideMerge(m.id, true))}><Check size={14} /> Ya, gabungkan</button>
                <button className={btnNo} disabled={acting === m.id} onClick={() => act(m.id, () => treeApi.decideMerge(m.id, false))}><X size={14} /> Bukan orang yang sama</button>
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section icon={Send} title="Usulan saya" hint="Perubahan yang Anda usulkan untuk orang yang dikelola kerabat lain.">
        {outgoing.length === 0 ? <Empty text="Anda belum mengirim usulan." /> : outgoing.map((p) => (
          <div key={p.id} className={`${card} flex flex-col gap-2 sm:flex-row sm:items-center`}>
            <div className="flex-1 text-sm text-slate-700 dark:text-white/80">
              <b>{p.person.displayName}</b>: {Object.entries(p.changes).map(([f, c]) => `${FIELD_LABEL[f] ?? f} → ${fieldValue(f, c.to)}`).join(', ')}
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-white/70">{STATUS_LABEL[p.status] ?? p.status}</span>
            {p.status === 'PENDING' && (
              <button className={btnNo} disabled={acting === p.id} onClick={() => act(p.id, () => treeApi.withdrawProposal(p.id))}><Undo2 size={14} /> Tarik</button>
            )}
          </div>
        ))}
      </Section>

      <Section icon={Users} title="Wali bersama" hint="Orang tanpa akun yang Anda kelola. Pengelola utama dapat menunjuk anggota keluarga ber-akun untuk ikut mengelola (mis. profil almarhum orang tua).">
        {stewardships.persons.length === 0 ? <Empty text="Anda belum mengelola data siapa pun." /> : stewardships.persons.map((p) => {
          const isPrimary = p.myRole === 'PRIMARY' || p.myRole === 'OWNER' || p.myRole === 'GUARDIAN';
          const candidates = stewardships.familyAccounts.filter((a) => !p.stewards.some((s) => s.userId === a.userId));
          return (
            <div key={p.id} className={card}>
              <p className="font-medium text-slate-900 dark:text-white">{p.displayName}{p.deceased ? ' (alm.)' : ''} {p.relation && <span className="text-xs font-normal text-slate-500 dark:text-white/50">· {p.relation}</span>}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.stewards.map((s) => (
                  <span key={s.userId} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-white/80">
                    {s.name ?? 'Pengguna'} · {ROLE_LABEL[s.role] ?? s.role}
                    {s.role === 'CO_STEWARD' && (isPrimary || p.myRole === 'CO_STEWARD') && (
                      <button
                        aria-label="Hapus wali bersama"
                        className="ml-1 text-slate-400 hover:text-red-500"
                        disabled={acting === `${p.id}:${s.userId}`}
                        onClick={() => act(`${p.id}:${s.userId}`, () => treeApi.removeCoSteward(p.id, s.userId))}
                      ><X size={12} /></button>
                    )}
                  </span>
                ))}
              </div>
              {isPrimary && candidates.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    value={appoint[p.id] ?? ''}
                    onChange={(e) => setAppoint((a) => ({ ...a, [p.id]: e.target.value }))}
                  >
                    <option value="">Pilih anggota keluarga…</option>
                    {candidates.map((a) => <option key={a.userId} value={a.userId}>{a.name ?? 'Pengguna'}{a.relation ? ` (${a.relation})` : ''}</option>)}
                  </select>
                  <button
                    className={btnYes}
                    disabled={!appoint[p.id] || acting === p.id}
                    onClick={() => act(p.id, () => treeApi.addCoSteward(p.id, appoint[p.id]))}
                  ><UserPlus size={14} /> Tunjuk</button>
                </div>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}
