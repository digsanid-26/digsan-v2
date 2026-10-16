import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(120000);

/**
 * Regression suite for the family-tree authority fixes (docs/tasklist-perbaikan.md, Fase 0).
 *
 * Scenario: A and B are siblings who each own a tree and add each other.
 * Their data must stay separate (no merged household, no retired slug, no
 * overwritten family name, no duplicated parents on the public page).
 */
describe('Family tree authority (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'Authority123!';
  const users: Record<'a' | 'b' | 'c', { email: string; id: string; token: string }> = {
    a: { email: `auth_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `auth_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `auth_c_${stamp}@digsan.test`, id: '', token: '' },
  };

  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });

  async function registerAndLogin(key: keyof typeof users, name: string) {
    const u = users[key];
    await http().post('/api/auth/register').send({ email: u.email, name, password });
    const ver = await prisma.verificationToken.findFirst({
      where: { user: { email: u.email }, type: 'EMAIL', used: false },
    });
    await http().get(`/api/auth/verify-email?token=${ver!.token}`);
    const login = await http().post('/api/auth/login').send({ email: u.email, password });
    u.token = login.body.accessToken;
    u.id = login.body.user.id;
  }

  const layoutOf = async (key: keyof typeof users) =>
    (await http().get('/api/trees/layout').set(as(key)).expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await registerAndLogin('a', 'Adi Kakak');
    await registerAndLogin('b', 'Budi Adik');
    await registerAndLogin('c', 'Citra Lain');
  });

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      const earlyAccess = await prisma.user.findMany({ where: { createdById: { in: ids } }, select: { id: true } });
      const allIds = [...ids, ...earlyAccess.map((u) => u.id)];
      await prisma.familyNodeMember.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.familyTree.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.verificationToken.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: allIds } } });
      await prisma.point.deleteMany({ where: { userId: { in: allIds } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: allIds } } });
    }
    if (app) await app.close();
  });

  // ─── Read paths do not write ────────────────────────────────

  it('GET /trees/layout does not create a tree or grant roles', async () => {
    const body = await layoutOf('c');
    expect(body.treeId).toBeNull();
    expect(await prisma.familyTree.count({ where: { userId: users.c.id } })).toBe(0);
    const roles = await prisma.userRole.findMany({ where: { userId: users.c.id }, include: { role: true } });
    expect(roles.map((r) => r.role.name)).not.toContain('super_user');
  });

  // ─── Setup: A and B build their own trees ───────────────────

  it('A and B save their own layouts (tree + slug created on first save)', async () => {
    const a = await http().put('/api/trees/layout').set(as('a')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Adi', spouseCount: 0, childCount: 0, parentCount: 2, olderCount: 0, youngerCount: 1 },
      members: { self: { name: 'Adi' }, 'parent-0': { name: 'Bapak' }, 'parent-1': { name: 'Ibu' }, 'younger-0': { name: 'Budi' } },
    }).expect(200);
    expect(a.body.slug).toBeTruthy();

    const b = await http().put('/api/trees/layout').set(as('b')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Budi', spouseCount: 0, childCount: 0, parentCount: 2, olderCount: 1, youngerCount: 0 },
      members: { self: { name: 'Budi' }, 'parent-0': { name: 'Bapak' }, 'parent-1': { name: 'Ibu' }, 'older-0': { name: 'Adi' } },
    }).expect(200);
    expect(b.body.slug).toBeTruthy();
    expect(b.body.slug).not.toBe(a.body.slug);
  });

  // ─── F0-01: no cross-tree bypass ────────────────────────────

  it('B (a tree owner with super_user) cannot edit, delete or add members to A\'s tree', async () => {
    const aTree = await layoutOf('a');
    await http().put(`/api/trees/${aTree.treeId}`).set(as('b')).send({ name: 'Diambil alih' }).expect(403);
    await http().post(`/api/trees/${aTree.treeId}/members`).set(as('b')).send({ name: 'Penyusup' }).expect(403);
    await http().post(`/api/trees/${aTree.treeId}/invitations`).set(as('b')).send({ email: 'x@digsan.test' }).expect(403);
    await http().delete(`/api/trees/${aTree.treeId}`).set(as('b')).expect(403);
  });

  // ─── F0-04/F0-05: links require the target's approval ───────

  it('A linking B creates a pending request; nothing changes for B until B approves', async () => {
    const before = await layoutOf('b');
    const aLayout = await layoutOf('a');

    const res = await http().put('/api/trees/layout').set(as('a')).send({
      members: { ...aLayout.members, 'younger-0': { name: 'Budi', linkedUserId: users.b.id } },
      baseUpdatedAt: aLayout.updatedAt,
    }).expect(200);
    expect(res.body.members['younger-0'].linkedUserId).toBeNull();
    expect(res.body.members['younger-0'].pendingLinkUserId).toBe(users.b.id);
    expect(res.body.linkRequests).toEqual([{ nodeId: 'younger-0', targetUserId: users.b.id }]);

    const after = await layoutOf('b');
    expect(after.slug).toBe(before.slug);
    expect(await prisma.familyNodeMember.count({ where: { userId: users.b.id, treeId: aLayout.treeId } })).toBe(0);
  });

  it('B approves: B is linked as a sibling but does NOT join A\'s household or lose their page', async () => {
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    expect(incoming).toHaveLength(1);
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);

    const aLayout = await layoutOf('a');
    expect(aLayout.members['younger-0'].linkedUserId).toBe(users.b.id);
    expect(aLayout.members['younger-0'].verified).toBe(true);

    const bTree = await prisma.familyTree.findFirst({ where: { userId: users.b.id } });
    expect(bTree!.slug).toBeTruthy();
    expect((bTree!.layoutConfig as any).sharedFamilySlug ?? null).toBeNull();
    expect(await prisma.familyNodeMember.count({ where: { userId: users.b.id, treeId: aLayout.treeId } })).toBe(0);
  });

  // ─── F0-06: no cross-tree overwrites ────────────────────────

  it('A renaming the family does not touch B\'s tree', async () => {
    const aLayout = await layoutOf('a');
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { ...aLayout.config, mainFamilyName: 'Trah Adi Baru' },
      baseUpdatedAt: aLayout.updatedAt,
    }).expect(200);
    const bTree = await prisma.familyTree.findFirst({ where: { userId: users.b.id } });
    expect((bTree!.layoutConfig as any).mainFamilyName).toBe('Keluarga Budi');
    expect(bTree!.slug).toBeTruthy();
  });

  // ─── F0-07: reciprocal link stays two separate households ───

  it('B linking A back (reciprocal) keeps both pages and never self-anchors', async () => {
    const bLayout = await layoutOf('b');
    await http().put('/api/trees/layout').set(as('b')).send({
      members: { ...bLayout.members, 'older-0': { name: 'Adi', linkedUserId: users.a.id } },
      baseUpdatedAt: bLayout.updatedAt,
    }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('a')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('a')).send({ approve: true }).expect(200);

    const aTree = await prisma.familyTree.findFirst({ where: { userId: users.a.id } });
    const bTree = await prisma.familyTree.findFirst({ where: { userId: users.b.id } });
    expect(aTree!.slug).toBeTruthy();
    expect(bTree!.slug).toBeTruthy();
    expect((aTree!.layoutConfig as any).sharedFamilySlug ?? null).not.toBe(aTree!.slug);
    expect((aTree!.layoutConfig as any).sharedFamilySlug ?? null).toBeNull();
    expect(await prisma.familyNodeMember.count({ where: { userId: users.a.id, treeId: bTree!.id } })).toBe(0);
  });

  // ─── F0-09: no duplicated parents on the public page ────────

  it('A\'s public page does not repeat the parents or show A as their own sibling', async () => {
    const aTree = await prisma.familyTree.findFirst({ where: { userId: users.a.id } });
    const pub = await http().get(`/api/public/family/${aTree!.slug}`).set(as('a')).expect(200);
    const keys = Object.keys(pub.body.members ?? {});
    expect(keys.filter((k) => k.startsWith('younger-0-'))).toEqual([]);
    expect(pub.body.members['younger-0']?.familyConfig?.parentCount).toBeUndefined();
  });

  // ─── Sanitising ─────────────────────────────────────────────

  it('server-controlled fields cannot be forged and one account cannot sit on two circles', async () => {
    const aLayout = await layoutOf('a');
    const forged = await http().put('/api/trees/layout').set(as('a')).send({
      members: { ...aLayout.members, 'parent-0': { name: 'Bapak', verified: true, earlyAccess: true, claimedByUserId: users.c.id } },
      baseUpdatedAt: aLayout.updatedAt,
    }).expect(200);
    expect(forged.body.members['parent-0'].verified).toBeUndefined();
    expect(forged.body.members['parent-0'].claimedByUserId).toBeUndefined();

    await http().put('/api/trees/layout').set(as('a')).send({
      members: { ...forged.body.members, 'parent-1': { name: 'Ibu', linkedUserId: users.b.id } },
      baseUpdatedAt: forged.body.updatedAt,
    }).expect(400);
  });

  // ─── F0-12: stale writes are rejected ───────────────────────

  it('a save based on an outdated version gets 409', async () => {
    const aLayout = await layoutOf('a');
    await http().put('/api/trees/layout').set(as('a')).send({ config: aLayout.config, baseUpdatedAt: aLayout.updatedAt }).expect(200);
    await http().put('/api/trees/layout').set(as('a')).send({ config: aLayout.config, baseUpdatedAt: aLayout.updatedAt }).expect(409);
  });

  // ─── F0-04: early-access impersonation ──────────────────────

  it('only the creator of an early-access account may log in as it', async () => {
    // B creates an early-access account for their (unlinked) parent circle.
    const bLayout = await layoutOf('b');
    const ea = await http().post('/api/trees/early-access/parent-0').set(as('b'))
      .send({ email: `auth_ea_${stamp}@digsan.test`, password: 'Sementara1!' }).expect(201);
    const eaUserId = ea.body.user.id;
    expect((await prisma.user.findUnique({ where: { id: eaUserId } }))!.createdById).toBe(users.b.id);

    // A cannot link it through the layout (it only becomes a pending request)…
    const aLayout = await layoutOf('a');
    const res = await http().put('/api/trees/layout').set(as('a')).send({
      members: { ...aLayout.members, 'parent-1': { name: 'Ibu', linkedUserId: eaUserId } },
      baseUpdatedAt: aLayout.updatedAt,
    }).expect(200);
    expect(res.body.members['parent-1'].linkedUserId ?? null).toBeNull();

    // …and even with a link forced into the data (legacy rows), login-as is refused.
    const aTree = await prisma.familyTree.findFirst({ where: { userId: users.a.id } });
    const members = { ...(aTree!.layoutMembers as any), 'parent-1': { name: 'Ibu', linkedUserId: eaUserId } };
    await prisma.familyTree.update({ where: { id: aTree!.id }, data: { layoutMembers: members } });
    await http().post('/api/auth/early-access/login-as').set(as('a')).send({ nodeId: 'parent-1' }).expect(403);

    // The creator can still use it.
    await http().post('/api/auth/early-access/login-as').set(as('b'))
      .send({ nodeId: 'parent-0', slug: (await prisma.familyTree.findFirst({ where: { userId: users.b.id } }))!.slug })
      .expect(201);
    expect(bLayout.treeId).toBeTruthy();
  });

  // ─── F0-14: admin endpoints ─────────────────────────────────

  it('repair/recover/backfill endpoints are admin-only', async () => {
    await http().post('/api/trees/recover-slugs').set(as('a')).expect(403);
    await http().post('/api/trees/backfill-family-nodes').set(as('a')).expect(403);
    await http().post('/api/trees/repair-family-links').set(as('a')).expect(403);
  });
});
