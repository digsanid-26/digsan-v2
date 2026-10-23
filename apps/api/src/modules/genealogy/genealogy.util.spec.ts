import { familyMembersToGraphDraft, layoutToGraphDraft, type GraphDraft } from './layout-graph.util';
import { buildGraph, checkGraph, relationOf, wouldCreateCycle, type GParentage, type GPerson } from './graph-rules.util';

/** Turn a draft into a rules Graph, using draft keys as person ids. */
function graphOf(d: GraphDraft, extraParentages: GParentage[] = []) {
  const persons: GPerson[] = [...d.persons.values()].map((p) => ({ id: p.key, sex: p.sex, displayName: p.displayName, isPlaceholder: p.isPlaceholder }));
  const parentages: GParentage[] = d.parentages.map((p) => ({ parentId: p.parentKey, childId: p.childKey, kind: 'BIOLOGICAL', birthOrder: p.birthOrder }));
  return buildGraph(persons, [...parentages, ...extraParentages], d.unions.map((u) => ({ aId: u.aKey, bId: u.bKey, status: u.status })));
}

const has = (d: GraphDraft, parent: string, child: string) => d.parentages.some((p) => p.parentKey === parent && p.childKey === child);
const hasUnion = (d: GraphDraft, a: string, b: string) => d.unions.some((u) => (u.aKey === a && u.bKey === b) || (u.aKey === b && u.bKey === a));

describe('layoutToGraphDraft (F1-03)', () => {
  it('turns ego-relative sibling keys into shared parents', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'user-a', ownerName: 'Adi',
      config: { configured: true, parentCount: 2, olderCount: 0, youngerCount: 1, spouseCount: 0, childCount: 0 },
      members: { 'parent-0': { name: 'Bapak', gender: 'L' }, 'parent-1': { name: 'Ibu' }, 'younger-0': { name: 'Budi', linkedUserId: 'user-b' } },
    });
    expect(d.persons.get('self')!.userId).toBe('user-a');
    expect(d.persons.get('younger-0')!.userId).toBe('user-b');
    for (const parent of ['parent-0', 'parent-1']) {
      expect(has(d, parent, 'self')).toBe(true);
      expect(has(d, parent, 'younger-0')).toBe(true);
    }
    expect(hasUnion(d, 'parent-0', 'parent-1')).toBe(true);
    const order = (k: string) => d.parentages.find((p) => p.parentKey === 'parent-0' && p.childKey === k)!.birthOrder;
    expect(order('self')).toBeLessThan(order('younger-0')!);
    expect(d.persons.get('parent-1')!.sex).toBe('FEMALE');
  });

  it('keeps counted but unnamed slots as placeholders', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', members: {},
      config: { configured: true, spouseCount: 1, childCount: 2, parentCount: 2, olderCount: 0, youngerCount: 0 },
    });
    expect(d.persons.get('child-1')!.isPlaceholder).toBe(true);
    expect(d.persons.get('child-1')!.displayName).toBe('Anak 2');
    // Children of the only spouse belong to both partners.
    expect(has(d, 'spouse-0', 'child-0')).toBe(true);
    expect(d.parentages.find((p) => p.childKey === 'child-0')!.unionKey).toBeTruthy();
  });

  it('applies marriageStatus to the first union and supports multiple spouses', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', marriageStatus: 'DIVORCED',
      config: { configured: true, spouseCount: 2, childCount: 1, parentCount: 0 },
      members: { 'child-0': { name: 'C' } },
    });
    expect(d.unions.find((u) => hasUnion({ ...d, unions: [u] }, 'self', 'spouse-0'))!.status).toBe('DIVORCED');
    // Two spouses: the other parent of child-0 is unknown, so only self is recorded.
    expect(d.parentages.filter((p) => p.childKey === 'child-0').map((p) => p.parentKey)).toEqual(['self']);
  });

  it('resolves grandparents, uncles and the ancestor chain through the right parent', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, parentCount: 2, simbahP: 0, simbahM: 2 },
      members: {
        'parent-1': { name: 'Ibu', familyConfig: { olderCount: 1 } },
        'gpM-0': { name: 'Kakek Ibu' },
        'uncleMo-0': { name: 'Pakde dari Ibu' },
        'ancM-0': { name: 'Buyut' },
        'ancM-1': { name: 'Canggah' },
      },
    });
    expect(has(d, 'gpM-0', 'parent-1')).toBe(true);
    expect(has(d, 'gpM-0', 'uncleMo-0')).toBe(true);
    expect(has(d, 'ancM-0', 'gpM-0')).toBe(true);
    expect(has(d, 'ancM-1', 'ancM-0')).toBe(true);
    expect(d.persons.has('gpP-0')).toBe(false); // simbahP = 0 → not drawn
  });

  it('treats tree-UI circles by their stored relations, never by key shape (timestamp ids)', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, spouseCount: 1, childCount: 1, parentCount: 0 },
      members: {
        'child-0': { name: 'Anak' },
        'child-1785683950690370': { name: 'Cucu', group: 'child', parentId: 'child-0' },
        'child-7': { name: 'Sisa data lama' }, // childCount = 1 → not drawn
      },
    });
    expect(has(d, 'child-0', 'child-1785683950690370')).toBe(true);
    expect(has(d, 'self', 'child-1785683950690370')).toBe(false);
    for (const p of d.parentages) expect(p.birthOrder == null || p.birthOrder < 1000).toBe(true);
    expect(d.persons.has('child-7')).toBe(false);
    expect(d.unmapped).toContain('child-7');
  });

  it('ignores stale records of undrawn slots even when needed structurally (no cycle from old sync data)', () => {
    // Real case: the old connection sync stored the inviter (the owner's CHILD)
    // as `parent-1` of the owner, while parentCount = 1 so it is not drawn.
    const d = layoutToGraphDraft({
      ownerUserId: 'mother', ownerName: 'Ibu', config: { configured: true, parentCount: 1, olderCount: 1, youngerCount: 0, spouseCount: 0, childCount: 0 },
      members: { 'parent-0': { name: 'Ayah Ibu' }, 'older-0': { name: 'Kakak Ibu' }, 'parent-1': { name: 'Anak', linkedUserId: 'child-account' } },
    });
    expect([...d.persons.values()].some((p) => p.userId === 'child-account')).toBe(false);
    expect(d.persons.has('parent-1')).toBe(false); // only parent-0 is drawn; siblings share it
    expect(has(d, 'parent-0', 'self')).toBe(true);
    expect(has(d, 'parent-0', 'older-0')).toBe(true);
    expect(d.unmapped).toContain('parent-1');
  });

  it('still links siblings through placeholder parents when no parent is drawn', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, parentCount: 0, olderCount: 1, spouseCount: 0, childCount: 0 },
      members: { 'older-0': { name: 'Kakak' } },
    });
    expect(has(d, 'parent-0', 'older-0') && has(d, 'parent-0', 'self')).toBe(true);
    expect(d.persons.get('parent-0')!.isPlaceholder).toBe(true);
  });

  it('treats per-node setup counts as totals including relatives already drawn', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X',
      config: { configured: true, parentCount: 2, simbahP: 2, simbahM: 0, olderCount: 0, youngerCount: 3, spouseCount: 0, childCount: 0 },
      members: {
        'parent-0': { name: 'Ayah', familyConfig: { olderCount: 3, youngerCount: 2 } },
        'gpP-0': { name: 'Kakek', familyConfig: { spouseCount: 1, childCount: 6 } },
        'gpP-1': { name: 'Nenek', familyConfig: { spouseCount: 1, childCount: 6 } },
        'younger-0': { name: 'Budi', familyConfig: { olderCount: 1, youngerCount: 2 } },
        'gpP-0-fc-child-4': { name: 'Sudah diisi' },
      },
    });
    const fcKeys = [...d.persons.keys()].filter((k) => k.includes('-fc-'));
    // Wife + 6 children already drawn → nothing generated, except the slot the user filled in.
    expect(fcKeys).toEqual(['gpP-0-fc-child-4']);
    expect(d.persons.get('gpP-0-fc-child-4')!.displayName).toBe('Sudah diisi');
  });

  it('carries a chosen existing Person (graphPersonId) on the draft, never for self', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, parentCount: 1 },
      members: { self: { name: 'X', graphPersonId: 'evil' }, 'parent-0': { name: 'Pak Slamet', graphPersonId: 'person-123' } },
    });
    expect(d.persons.get('parent-0')!.graphPersonId).toBe('person-123');
    expect(d.persons.get('self')!.graphPersonId).toBeNull();
  });

  it('builds per-node sub-trees from familyConfig (-fc- keys)', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, spouseCount: 0, childCount: 1, parentCount: 0 },
      members: {
        'child-0': { name: 'Anak', familyConfig: { spouseCount: 1, childCount: 2 } },
        'child-0-fc-child-1': { name: 'Cucu Kedua' },
      },
    });
    expect(hasUnion(d, 'child-0', 'child-0-fc-spouse-0')).toBe(true);
    expect(has(d, 'child-0', 'child-0-fc-child-1')).toBe(true);
    expect(has(d, 'child-0-fc-spouse-0', 'child-0-fc-child-1')).toBe(true); // only partner → co-parent
    expect(d.persons.get('child-0-fc-child-1')!.displayName).toBe('Cucu Kedua');
    expect(d.persons.get('child-0-fc-child-0')!.isPlaceholder).toBe(true);
  });

  it('maps namespaced keys relative to their own ego (married-in ancestry)', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, spouseCount: 1, parentCount: 0 },
      members: { 'spouse-0': { name: 'Istri' }, 'spouse-0-parent-1': { name: 'Mertua' }, 'spouse-0-older-0': { name: 'Kakak Ipar' } },
    });
    expect(has(d, 'spouse-0-parent-1', 'spouse-0')).toBe(true);
    expect(has(d, 'spouse-0-parent-1', 'spouse-0-older-0')).toBe(true);
    expect(has(d, 'spouse-0-parent-1', 'self')).toBe(false);
  });

  it('handles explicit recursive nodes and legacy junk keys', () => {
    const d = layoutToGraphDraft({
      ownerUserId: 'u', ownerName: 'X', config: { configured: true, spouseCount: 0, childCount: 1, parentCount: 0 },
      members: {
        'child-0': { name: 'Anak' },
        'n-1': { name: 'Menantu', group: 'spouse', spouseId: 'child-0' },
        'n-2': { name: 'Cucu', group: 'child', parentId: 'child-0' },
        'child-0-spouse': { name: 'Menantu lama' },
        olderCount: 3,
      },
    });
    expect(hasUnion(d, 'child-0', 'n-1')).toBe(true);
    expect(has(d, 'child-0', 'n-2')).toBe(true);
    expect(has(d, 'n-1', 'n-2')).toBe(false); // child-0 has two partners → co-parent unknown
    expect(hasUnion(d, 'child-0', 'child-0-spouse')).toBe(true);
    expect(d.unmapped).toContain('olderCount');
  });
});

describe('familyMembersToGraphDraft (F1-05)', () => {
  it('maps parentId/spouseId and the creator to the owner account', () => {
    const base = { gender: null, deathDate: null, photo: null, childOrder: null, userId: null };
    const d = familyMembersToGraphDraft([
      { ...base, id: 'a', name: 'Saya', isCreator: true, parentId: null, spouseId: 'b' },
      { ...base, id: 'b', name: 'Istri', isCreator: false, parentId: null, spouseId: 'a' },
      { ...base, id: 'c', name: 'Anak', isCreator: false, parentId: 'a', spouseId: null, childOrder: 1 },
    ], 'owner');
    expect(d.persons.get('fm:a')!.userId).toBe('owner');
    expect(has(d, 'fm:a', 'fm:c')).toBe(true);
    expect(has(d, 'fm:b', 'fm:c')).toBe(true);
    expect(d.unions).toHaveLength(1);
  });
});

describe('graph invariants (F1-07)', () => {
  it('detects cycles before they are inserted', () => {
    const g = buildGraph([{ id: 'a', sex: 'MALE' }, { id: 'b', sex: 'MALE' }], [{ parentId: 'a', childId: 'b', kind: 'BIOLOGICAL' }], []);
    expect(wouldCreateCycle(g, 'b', 'a')).toBe(true);
    expect(wouldCreateCycle(g, 'a', 'b')).toBe(false);
  });

  it('flags siblings who drew their father twice as a duplicate suspect', () => {
    const g = buildGraph(
      [{ id: 'b', sex: 'MALE' }, { id: 'f1', sex: 'MALE', displayName: 'Bapak' }, { id: 'f2', sex: 'MALE', displayName: 'Bapak' }],
      [{ parentId: 'f1', childId: 'b', kind: 'BIOLOGICAL', certainty: 'ASSUMED' }, { parentId: 'f2', childId: 'b', kind: 'BIOLOGICAL', certainty: 'ASSUMED' }],
      [],
    );
    const issues = checkGraph(g);
    expect(issues.map((i) => i.code)).toContain('DUPLICATE_PARENT_SUSPECT');
    expect(issues.find((i) => i.code === 'DUPLICATE_PARENT_SUSPECT')!.personIds).toEqual(['b', 'f1', 'f2']);
  });

  it('rejects partner = own parent', () => {
    const g = buildGraph([{ id: 'a', sex: 'MALE' }, { id: 'b', sex: 'FEMALE' }], [{ parentId: 'a', childId: 'b', kind: 'BIOLOGICAL' }], [{ aId: 'a', bId: 'b' }]);
    expect(checkGraph(g).map((i) => i.code)).toContain('UNION_WITH_PARENT_OR_CHILD');
  });
});

describe('relationOf — kinship calculator (F1-09)', () => {
  // Family: grandparents G1+G2 → father F (+mother M) → ego E, sister S (older), half-brother H (F + M2)
  //         G1+G2 → uncle U → cousin C; E married W, W's mother WM; E's child K married KS, KS's father KF.
  const P = (id: string, sex: GPerson['sex']): GPerson => ({ id, sex });
  const bio = (parentId: string, childId: string, birthOrder: number | null = null): GParentage => ({ parentId, childId, kind: 'BIOLOGICAL', birthOrder });
  const g = buildGraph(
    [P('G1', 'MALE'), P('G2', 'FEMALE'), P('F', 'MALE'), P('M', 'FEMALE'), P('M2', 'FEMALE'), P('E', 'MALE'), P('S', 'FEMALE'),
      P('H', 'MALE'), P('U', 'MALE'), P('C', 'FEMALE'), P('W', 'FEMALE'), P('WM', 'FEMALE'), P('K', 'MALE'), P('KS', 'FEMALE'),
      P('KF', 'MALE'), P('A', 'FEMALE')],
    [
      bio('G1', 'F'), bio('G2', 'F'), bio('G1', 'U'), bio('G2', 'U'), bio('U', 'C'),
      bio('F', 'S', 0), bio('M', 'S', 0), bio('F', 'E', 1), bio('M', 'E', 1), bio('F', 'H', 2), bio('M2', 'H', 2),
      bio('WM', 'W'), bio('E', 'K'), bio('W', 'K'), bio('KF', 'KS'),
      { parentId: 'E', childId: 'A', kind: 'ADOPTIVE' },
    ],
    [{ aId: 'F', bId: 'M' }, { aId: 'F', bId: 'M2' }, { aId: 'E', bId: 'W', status: 'ONGOING' }, { aId: 'K', bId: 'KS' }],
  );
  const rel = (other: string) => relationOf(g, 'E', other)?.label;

  it('labels direct and collateral blood relatives', () => {
    expect(rel('F')).toBe('Ayah');
    expect(rel('G2')).toBe('Nenek (pihak ayah)');
    expect(rel('S')).toBe('Kakak kandung');
    expect(rel('H')).toBe('Adik (seayah)');
    expect(rel('U')).toBe('Paman (pihak ayah)');
    expect(rel('C')).toBe('Sepupu (pihak ayah)');
    expect(rel('K')).toBe('Anak');
    expect(relationOf(g, 'C', 'E')?.label).toBe('Sepupu (pihak ayah)');
  });

  it('labels relations by marriage', () => {
    expect(rel('W')).toBe('Istri');
    expect(rel('WM')).toBe('Ibu mertua');
    expect(rel('KS')).toBe('Menantu');
    expect(rel('KF')).toBe('Besan');
    expect(relationOf(g, 'H', 'M')?.label).toBe('Ibu tiri');
  });

  it('distinguishes adoption and lineage mode', () => {
    expect(rel('A')).toBe('Anak angkat');
    expect(relationOf(g, 'E', 'A', ['BIOLOGICAL'])).toBeNull();
  });

  it('computes deep cousin degrees (12th cousin)', () => {
    const persons: GPerson[] = [P('root', 'MALE')];
    const parentages: GParentage[] = [];
    for (const side of ['x', 'y']) {
      let prev = 'root';
      for (let i = 1; i <= 13; i++) {
        const id = `${side}${i}`;
        persons.push(P(id, 'MALE'));
        parentages.push(bio(prev, id));
        prev = id;
      }
    }
    const deep = buildGraph(persons, parentages, []);
    // The chain runs through x13's father (all male) → paternal side.
    expect(relationOf(deep, 'x13', 'y13')?.label).toBe('Sepupu derajat 12 (pihak ayah)');
    // y11 is two generations closer to the common ancestor → an older generation.
    expect(relationOf(deep, 'x13', 'y11')?.label).toBe('Sepupu derajat 10, 2 generasi di atas (pihak ayah)');
  });
});
