import { ANONYMOUS_NAME, filterMembersForViewer, type NodePrivacy } from './public-privacy.util';

const members = {
  self: { name: 'Adi', photo: 'a.jpg', email: 'adi@x.id' },
  'child-0': { name: 'Budi', photo: 'b.jpg', email: 'budi@x.id', phone: '0812', linkedUserId: 'u-budi', verified: true, username: 'budi' },
  'parent-0': { name: 'Bapak Slamet', photo: 'p.jpg', alive: false, graphPersonId: 'p1' },
  'child-1': { name: 'Dewi', photo: 'd.jpg', claimedByUserId: 'u-dewi' },
};
const privacy: Record<string, NodePrivacy> = {
  'child-0': { privacy: 'PRIVATE', living: true },
  'parent-0': { privacy: 'PRIVATE', living: false },
  'child-1': { privacy: 'FAMILY', living: true },
};
const privacyOf = (id: string) => privacy[id];

describe('family page privacy (F2-09)', () => {
  it('never exposes account ids; replaces them with hasAccount', () => {
    for (const viewerIsFamily of [true, false]) {
      const out = filterMembersForViewer(members, { viewerIsFamily, privacyOf });
      for (const m of Object.values(out)) {
        expect(m).not.toHaveProperty('linkedUserId');
        expect(m).not.toHaveProperty('claimedByUserId');
        expect(m).not.toHaveProperty('graphPersonId');
      }
      expect(out['child-0'].hasAccount).toBe(true);
      expect(out['child-1'].hasAccount).toBe(true);
      expect(out['parent-0'].hasAccount).toBe(false);
    }
  });

  it('family sees everything, including contacts and private living relatives', () => {
    const out = filterMembersForViewer(members, { viewerIsFamily: true, privacyOf });
    expect(out['child-0']).toMatchObject({ name: 'Budi', photo: 'b.jpg', email: 'budi@x.id', phone: '0812' });
  });

  it('others see no contacts, and private living people anonymously', () => {
    const out = filterMembersForViewer(members, { viewerIsFamily: false, privacyOf });
    expect(out.self).toEqual({ name: 'Adi', photo: 'a.jpg', hasAccount: false });
    expect(out['child-0']).toEqual({ name: ANONYMOUS_NAME, photo: null, verified: true, hasAccount: true, private: true });
    // The deceased keep their name even when marked private; FAMILY keeps name/photo.
    expect(out['parent-0']).toMatchObject({ name: 'Bapak Slamet', photo: 'p.jpg' });
    expect(out['child-1']).toMatchObject({ name: 'Dewi', photo: 'd.jpg' });
  });
});
