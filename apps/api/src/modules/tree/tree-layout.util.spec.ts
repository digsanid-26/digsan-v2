import {
  buildConnectedLayout,
  isHouseholdNode,
  isLayoutEmpty,
  projectFamilyConfig,
  projectionScope,
  protectedFieldsChanged,
  revertProtectedFields,
  sanitizeLayoutMembers,
  stripIdentityFields,
} from './tree-layout.util';

const OWNER = 'owner-1';

describe('sanitizeLayoutMembers', () => {
  it('turns a new linkedUserId into a pending link request', () => {
    const res = sanitizeLayoutMembers({}, { 'younger-0': { name: 'B', linkedUserId: 'user-b' } }, OWNER);
    expect(res.errors).toEqual([]);
    expect(res.members['younger-0'].linkedUserId).toBeNull();
    expect(res.members['younger-0'].pendingLinkUserId).toBe('user-b');
    expect(res.linkRequests).toEqual([{ nodeId: 'younger-0', userId: 'user-b' }]);
  });

  it('does not re-request an already pending link', () => {
    const old = { 'younger-0': { name: 'B', pendingLinkUserId: 'user-b' } };
    const res = sanitizeLayoutMembers(old, { 'younger-0': { name: 'B', linkedUserId: 'user-b' } }, OWNER);
    expect(res.linkRequests).toEqual([]);
    expect(res.members['younger-0'].pendingLinkUserId).toBe('user-b');
  });

  it('keeps a pending link when the client omits the field', () => {
    const old = { 'younger-0': { name: 'B', pendingLinkUserId: 'user-b' } };
    const res = sanitizeLayoutMembers(old, { 'younger-0': { name: 'B Baru' } }, OWNER);
    expect(res.members['younger-0'].pendingLinkUserId).toBe('user-b');
    expect(res.cancelledRequests).toEqual([]);
  });

  it('cancels a pending link when the client clears it explicitly', () => {
    const old = { 'younger-0': { name: 'B', pendingLinkUserId: 'user-b' } };
    const res = sanitizeLayoutMembers(old, { 'younger-0': { name: 'B', pendingLinkUserId: null } }, OWNER);
    expect(res.members['younger-0'].pendingLinkUserId).toBeUndefined();
    expect(res.cancelledRequests).toEqual([{ nodeId: 'younger-0', userId: 'user-b' }]);
  });

  it('never lets the client forge server-controlled fields', () => {
    const res = sanitizeLayoutMembers(
      { 'child-0': { name: 'C' } },
      { 'child-0': { name: 'C', verified: true, earlyAccess: true, claimedByUserId: 'x', username: 'hijack' } },
      OWNER,
    );
    const m = res.members['child-0'];
    expect(m.verified).toBeUndefined();
    expect(m.earlyAccess).toBeUndefined();
    expect(m.claimedByUserId).toBeUndefined();
    expect(m.username).toBeUndefined();
  });

  it('keeps an approved link and its server fields', () => {
    const old = { 'spouse-0': { name: 'W', linkedUserId: 'user-w', verified: true } };
    const res = sanitizeLayoutMembers(old, { 'spouse-0': { name: 'W', linkedUserId: 'user-w', verified: false } }, OWNER);
    expect(res.members['spouse-0'].linkedUserId).toBe('user-w');
    expect(res.members['spouse-0'].verified).toBe(true);
    expect(res.linkRequests).toEqual([]);
  });

  it('lets an approved link move to another node (index shift after delete)', () => {
    const old = {
      'child-0': { name: 'A' },
      'child-1': { name: 'B', linkedUserId: 'user-b', verified: true, earlyAccess: true, username: 'b' },
    };
    const res = sanitizeLayoutMembers(old, { 'child-0': { name: 'B', linkedUserId: 'user-b' } }, OWNER);
    expect(res.errors).toEqual([]);
    expect(res.linkRequests).toEqual([]);
    expect(res.unlinked).toEqual([]);
    expect(res.members['child-0']).toMatchObject({ linkedUserId: 'user-b', verified: true, earlyAccess: true, username: 'b' });
  });

  it('reports removed links (unlink or node deleted)', () => {
    const old = { 'child-0': { name: 'A', linkedUserId: 'user-a', verified: true } };
    const res = sanitizeLayoutMembers(old, { 'child-0': { name: 'A', linkedUserId: null } }, OWNER);
    expect(res.unlinked).toEqual([{ nodeId: 'child-0', userId: 'user-a' }]);
    expect(res.members['child-0'].verified).toBeUndefined();

    const deleted = sanitizeLayoutMembers(old, {}, OWNER);
    expect(deleted.unlinked).toEqual([{ nodeId: 'child-0', userId: 'user-a' }]);
  });

  it('rejects one account on two nodes', () => {
    const old = { 'older-0': { name: 'A', linkedUserId: 'user-a' } };
    const res = sanitizeLayoutMembers(
      old,
      { 'older-0': { name: 'A', linkedUserId: 'user-a' }, 'child-1-spouse': { name: 'A', linkedUserId: 'user-a' } },
      OWNER,
    );
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('rejects linking the owner to a non-self node', () => {
    const res = sanitizeLayoutMembers({}, { 'older-0': { name: 'Me', linkedUserId: OWNER } }, OWNER);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.linkRequests).toEqual([]);
  });
});

describe('isHouseholdNode', () => {
  it('treats spouses and children as household, everyone else not', () => {
    const layout = {
      'x-1': { group: 'child', parentId: 'spouse-0' },
      'x-2': { group: 'child', parentId: 'older-0' },
      'x-3': { group: 'spouse', spouseId: 'self' },
    };
    expect(isHouseholdNode('spouse-0', layout)).toBe(true);
    expect(isHouseholdNode('child-3', layout)).toBe(true);
    expect(isHouseholdNode('x-1', layout)).toBe(true);
    expect(isHouseholdNode('x-3', layout)).toBe(true);
    for (const id of ['parent-0', 'older-0', 'younger-1', 'gpP-0', 'unclePo-0', 'x-2']) {
      expect(isHouseholdNode(id, layout)).toBe(false);
    }
  });
});

describe('projection policy (A ⇄ B siblings)', () => {
  it('projects full ancestry only for married-in spouses', () => {
    expect(projectionScope('spouse-0', {})).toBe('full');
    expect(projectionScope('child-0-spouse', {})).toBe('full');
  });

  it('never projects ancestry for siblings or children (their parents are already drawn)', () => {
    expect(projectionScope('younger-0', {})).toBe('descendants');
    expect(projectionScope('child-0', {})).toBe('descendants');
    expect(projectFamilyConfig({ parentCount: 2, olderCount: 1, spouseCount: 1, childCount: 3 }, 'descendants'))
      .toEqual({ spouseCount: 1, childCount: 3 });
  });

  it('projects nothing for direct ancestors', () => {
    expect(projectionScope('parent-0', {})).toBe('none');
    expect(projectionScope('gpM-1', {})).toBe('none');
    expect(projectFamilyConfig({ childCount: 4 }, 'none')).toBeNull();
  });
});

describe('slice / consent helpers', () => {
  it('stripIdentityFields keeps stored identity values', () => {
    const out = stripIdentityFields(
      { name: 'X', linkedUserId: 'evil', verified: true },
      { name: 'Y', linkedUserId: 'real' },
    );
    expect(out).toEqual({ name: 'X', linkedUserId: 'real' });
  });

  it('detects and reverts protected profile changes', () => {
    const prev = { name: 'Siti', photo: 'a.jpg', parentId: 'self' };
    const next = { name: 'Siti Baru', photo: 'a.jpg', parentId: 'spouse-0' };
    expect(protectedFieldsChanged(prev, next)).toBe(true);
    expect(revertProtectedFields(prev, next)).toEqual({ name: 'Siti', photo: 'a.jpg', parentId: 'spouse-0' });
    expect(protectedFieldsChanged(prev, { ...prev, parentId: 'x' })).toBe(false);
  });
});

describe('buildConnectedLayout', () => {
  const accepter = { id: 'acc', name: 'Penerima', avatar: null };
  const inviterMembers = {
    self: { name: 'Pengundang', gender: 'L', alive: true },
    'spouse-0': { name: 'Istri Pengundang', linkedUserId: 'wife-id', verified: true },
    'child-0': { name: 'Anak Satu' },
    'child-1': { name: 'Penerima', linkedUserId: 'acc' },
    'child-2': { name: 'Anak Tiga', linkedUserId: 'third-party' },
    'parent-0': { name: 'Kakek' },
    'parent-1': { name: 'Nenek' },
    'older-0': { name: 'Kakak Pengundang' },
  };
  const inviterConfig = { childCount: 3, spouseCount: 1, parentCount: 2, olderCount: 1, youngerCount: 0 };

  it('uses 0-based keys and never copies third-party account links', () => {
    const out = buildConnectedLayout({ relationship: 'ayah', inviterUserId: 'inv', inviterConfig, inviterMembers, accepter })!;
    expect(out.members['parent-0']).toMatchObject({ name: 'Pengundang', linkedUserId: 'inv' });
    expect(out.members['parent-1']).toEqual({ name: 'Istri Pengundang' });
    expect(out.members['gpP-0']).toEqual({ name: 'Kakek' });
    expect(out.members['older-0']).toEqual({ name: 'Anak Satu' });
    expect(out.members['younger-0']).toEqual({ name: 'Anak Tiga' });
    expect(out.config).toMatchObject({ olderCount: 1, youngerCount: 1 });
    expect(out.inviterSideNodeId).toBe('child-1');
    for (const m of Object.values(out.members)) {
      if (m.linkedUserId) expect(m.linkedUserId).toBe('inv');
    }
    expect(Object.keys(out.members)).not.toContain('olderCount');
  });

  it("treats 'anak' as the inviter being the accepter's child", () => {
    const out = buildConnectedLayout({ relationship: 'anak', inviterUserId: 'inv', inviterConfig, inviterMembers, accepter })!;
    expect(out.members['child-1']).toMatchObject({ name: 'Pengundang', linkedUserId: 'inv' });
    expect(out.members['child-0']).toEqual({ name: 'Kakak Pengundang' });
    expect(out.config.childCount).toBe(2);
    expect(out.joinsInviterHousehold).toBe(false);
  });

  it('spouse shares the household and children', () => {
    const out = buildConnectedLayout({ relationship: 'pasangan', inviterUserId: 'inv', inviterConfig, inviterMembers, accepter })!;
    expect(out.members['spouse-0']).toMatchObject({ linkedUserId: 'inv' });
    expect(out.members['child-2']).toEqual({ name: 'Anak Tiga' });
    expect(out.joinsInviterHousehold).toBe(true);
  });

  it('refuses to guess placements it cannot know', () => {
    for (const rel of ['cucu', 'paman-bibi', 'keponakan']) {
      expect(buildConnectedLayout({ relationship: rel, inviterUserId: 'inv', inviterConfig, inviterMembers, accepter })).toBeNull();
    }
  });

  it('isLayoutEmpty only accepts unconfigured trees with just self', () => {
    expect(isLayoutEmpty(null, null)).toBe(true);
    expect(isLayoutEmpty({ configured: false }, { self: { name: 'A' } })).toBe(true);
    expect(isLayoutEmpty({ configured: true }, {})).toBe(false);
    expect(isLayoutEmpty({}, { 'child-0': { name: 'X' } })).toBe(false);
  });
});
