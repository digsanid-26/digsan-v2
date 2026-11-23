import { describeProposalStatus, describeRevision, sortTimeline, type HistoryEntry } from './history.util';

const names = (id: string) => ({ u1: 'Budi' } as Record<string, string>)[id] ?? null;

describe('person history (F2-10)', () => {
  it('describes edits from sync, API and approved proposals', () => {
    expect(describeRevision({ source: 'LEGACY_SYNC', diff: { displayName: 'Slamet', isPlaceholder: false } }, names))
      .toEqual({ kind: 'EDIT', text: 'Diubah (dari pohon): nama → Slamet' });
    expect(describeRevision({ source: 'PROPOSAL', diff: { vitalStatus: { from: 'LIVING', to: 'DECEASED' }, proposalId: 'p', proposerId: 'u1' } }, names))
      .toEqual({ kind: 'EDIT', text: 'Diubah (usulan disetujui): status hidup/wafat: hidup → wafat' });
    expect(describeRevision({ source: 'API', diff: { birthDate: { from: null, to: '1950-02-03T00:00:00.000Z' } } }, names)!.text)
      .toBe('Diubah (langsung): tanggal lahir: — → 1950-02-03');
  });

  it('describes privacy, stewards, links and merges', () => {
    expect(describeRevision({ source: 'API', diff: { privacy: { from: 'FAMILY', to: 'PRIVATE' } } }, names))
      .toEqual({ kind: 'PRIVACY', text: 'Diubah (langsung): privasi: keluarga → pribadi' });
    expect(describeRevision({ source: 'API', diff: { stewardAdded: 'u1', role: 'CO_STEWARD' } }, names)!.text).toBe('Budi ditunjuk sebagai wali bersama');
    expect(describeRevision({ source: 'LEGACY_SYNC', diff: { userId: 'u1', isPlaceholder: false } }, names)!.kind).toBe('LINK');
    expect(describeRevision({ source: 'MERGE', diff: { mergedFrom: 'x', mergedName: 'Pak Slamet' } }, names)!.text).toBe('Digabung dengan data ganda "Pak Slamet"');
  });

  it('skips revisions without anything a person would care about', () => {
    expect(describeRevision({ source: 'LEGACY_SYNC', diff: { isPlaceholder: false, placeholderKind: null } }, names)).toBeNull();
  });

  it('labels proposal outcomes and sorts newest first', () => {
    expect(describeProposalStatus('SUPERSEDED')).toBe('tidak berlaku (data sudah berubah)');
    const e = (iso: string, text: string): HistoryEntry => ({ at: new Date(iso), kind: 'EDIT', actor: null, text, source: 'API' });
    expect(sortTimeline([e('2026-01-01', 'a'), e('2026-03-01', 'b'), e('2026-02-01', 'c')]).map((x) => x.text)).toEqual(['b', 'c', 'a']);
  });
});
