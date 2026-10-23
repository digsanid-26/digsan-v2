import { buildGraph, type GParentage } from './graph-rules.util';
import { chooseSurvivor, findMergeCandidates, mergeBlocker, nameSimilarity, normalizeName, type MergePerson } from './merge-rules.util';

const P = (id: string, sex: MergePerson['sex'], displayName: string, extra: Partial<MergePerson> = {}): MergePerson => ({ id, sex, displayName, ...extra });
const bio = (parentId: string, childId: string): GParentage => ({ parentId, childId, kind: 'BIOLOGICAL', status: 'CONFIRMED' });

function setup(persons: MergePerson[], parentages: GParentage[], unions: { aId: string; bId: string }[] = []) {
  return { g: buildGraph(persons, parentages, unions), map: new Map(persons.map((p) => [p.id, p])) };
}

describe('names', () => {
  it('normalises titles and honorifics', () => {
    expect(normalizeName('H. Nurhamid, S.Pd')).toBe('nurhamid');
    expect(normalizeName('Bapak Asmuni Saeful Gani')).toBe('asmuni saeful gani');
    expect(normalizeName('Almh. Siti Kusriyah')).toBe('siti kusriyah');
  });

  it('scores spelling variants and partial names highly, different people low', () => {
    expect(nameSimilarity('Bapak Slamet', 'Pak Slamet')).toBe(1);
    expect(nameSimilarity('Asmuni', 'Asmuni Saeful Gani')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('Kusriyah', 'Kusriyeh')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Mutingah', 'Badri')).toBeLessThan(0.6);
  });
});

describe('findMergeCandidates (F2-04)', () => {
  it('finds the father drawn separately by two siblings (shared child)', () => {
    const { g, map } = setup(
      [P('A', 'MALE', 'Adi', { userId: 'ua' }), P('B', 'MALE', 'Budi', { userId: 'ub' }),
        P('F1', 'MALE', 'Bapak Slamet'), P('F2', 'MALE', 'Pak Slamet'), P('M1', 'FEMALE', 'Ibu Sri'), P('M2', 'FEMALE', 'Bu Sri')],
      [bio('F1', 'A'), bio('M1', 'A'), bio('F1', 'B'), bio('M1', 'B'), bio('F2', 'B'), bio('M2', 'B')],
    );
    const c = findMergeCandidates(g, map);
    expect(c.map((x) => `${x.personAId}+${x.personBId}`).sort()).toEqual(['F1+F2', 'M1+M2']);
    expect(c[0].reasons).toEqual(expect.arrayContaining(['SHARED_CHILD', 'SAME_NAME']));
    expect(c[0].score).toBeGreaterThanOrEqual(0.9);
  });

  it('never pairs father with mother, nor two accounts', () => {
    const { g, map } = setup(
      [P('C', 'MALE', 'Anak'), P('F', 'MALE', 'Ayah', { userId: 'u1' }), P('F2', 'MALE', 'Ayah', { userId: 'u2' }), P('M', 'FEMALE', 'Ibu')],
      [bio('F', 'C'), bio('F2', 'C'), bio('M', 'C')],
    );
    expect(findMergeCandidates(g, map)).toEqual([]);
  });

  it('finds a child recorded twice under the same parents, ignoring placeholders', () => {
    const { g, map } = setup(
      [P('F', 'MALE', 'Ayah'), P('C1', 'FEMALE', 'Triana Nurlaelani'), P('C2', 'FEMALE', 'Triana N.'), P('C3', 'FEMALE', 'Adik 1', { isPlaceholder: true }), P('C4', 'MALE', 'Budi')],
      [bio('F', 'C1'), bio('F', 'C2'), bio('F', 'C3'), bio('F', 'C4')],
    );
    const c = findMergeCandidates(g, map);
    expect(c.map((x) => `${x.personAId}+${x.personBId}`)).toEqual(['C1+C2']);
    expect(c[0].reasons).toContain('SAME_PARENTS');
  });
});

describe('mergeBlocker / chooseSurvivor (F2-06)', () => {
  it('blocks merging partners, ancestors with descendants, and different sexes', () => {
    const { g, map } = setup(
      [P('X', 'MALE', 'X'), P('Y', 'MALE', 'Y'), P('Z', 'FEMALE', 'Z'), P('W', 'MALE', 'W')],
      [bio('X', 'Y')],
      [{ aId: 'X', bId: 'W' }],
    );
    expect(mergeBlocker(g, map, 'X', 'Y')).toMatch(/leluhur/);
    expect(mergeBlocker(g, map, 'X', 'W')).toMatch(/pasangan/);
    expect(mergeBlocker(g, map, 'X', 'Z')).toMatch(/kelamin/);
  });

  it('keeps the account Person, then the named one, then the oldest', () => {
    const old = new Date('2020-01-01');
    const young = new Date('2024-01-01');
    expect(chooseSurvivor(P('a', 'MALE', 'A', { createdAt: old }), P('b', 'MALE', 'B', { userId: 'u', createdAt: young }))[0].id).toBe('b');
    expect(chooseSurvivor(P('a', 'MALE', 'Ayah', { isPlaceholder: true, createdAt: old }), P('b', 'MALE', 'Slamet', { createdAt: young }))[0].id).toBe('b');
    expect(chooseSurvivor(P('a', 'MALE', 'A', { createdAt: old }), P('b', 'MALE', 'B', { createdAt: young }))[0].id).toBe('a');
  });
});
