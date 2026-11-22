process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';

jest.setTimeout(180000);

/**
 * F2-08 — unlink & leave. Adi's tree has his child Budi (household) and his
 * brother Citra's circle, both linked to their accounts; Dewi is a second
 * child. People can leave the household page, release their account from a
 * circle, and an owner removing a link gives the person their page back.
 */
describe('Unlink & leave (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Rel3ase123!';
  const users = {
    a: { email: `rls_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `rls_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `rls_c_${stamp}@digsan.test`, id: '', token: '' },
    d: { email: `rls_d_${stamp}@digsan.test`, id: '', token: '' },
  };
  type U = keyof typeof users;
  const http = () => request(app.getHttpServer());
  const as = (u: U) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeOf = (u: U) => prisma.familyTree.findFirst({ where: { userId: users[u].id }, orderBy: { createdAt: 'asc' } });
  const layoutOf = async (u: U) => (await http().get('/api/trees/layout').set(as(u)).expect(200)).body;
  const notified = (u: U, kind: string) => prisma.notification.count({ where: { userId: users[u].id, data: { path: ['kind'], equals: kind } } });

  // Four accounts exceed POST /auth/register's limit (3/min per IP), so they
  // are created verified directly; login still goes through the API.
  async function registerAndLogin(key: U, name: string) {
    const u = users[key];
    const role = await prisma.role.findUnique({ where: { name: 'user' } });
    await prisma.user.create({
      data: {
        email: u.email, name, passwordHash: await bcrypt.hash(password, 4), status: 'ACTIVE', emailVerified: new Date(),
        ...(role ? { userRoles: { create: { roleId: role.id } } } : {}),
      },
    });
    const login = await http().post('/api/auth/login').send({ email: u.email, password });
    u.token = login.body.accessToken;
    u.id = login.body.user.id;
  }

  async function link(nodeId: string, to: U, name: string) {
    const l = await layoutOf('a');
    await http().put('/api/trees/layout').set(as('a')).send({
      members: { ...l.members, [nodeId]: { ...(l.members?.[nodeId] ?? {}), name, linkedUserId: users[to].id } }, baseUpdatedAt: l.updatedAt,
    }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as(to)).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as(to)).send({ approve: true }).expect(200);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    sync = app.get(GraphSyncService);
    await registerAndLogin('a', 'Adi');
    await registerAndLogin('b', 'Budi');
    await registerAndLogin('c', 'Citra');
    await registerAndLogin('d', 'Dewi');

    for (const k of ['b', 'c', 'd'] as const) {
      await http().put('/api/trees/layout').set(as(k)).send({
        config: { configured: true, mainFamilyName: `Keluarga ${k}`, spouseCount: 0, childCount: 0, parentCount: 0, olderCount: 0, youngerCount: 0 },
        members: { self: { name: k } },
      }).expect(200);
    }
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Adi', spouseCount: 0, childCount: 2, parentCount: 0, olderCount: 0, youngerCount: 1 },
      members: { self: { name: 'Adi', gender: 'L' }, 'child-0': { name: 'Budi' }, 'child-1': { name: 'Dewi' }, 'younger-0': { name: 'Citra' } },
    }).expect(200);
    await link('child-0', 'b', 'Budi');
    await link('child-1', 'd', 'Dewi');
    await link('younger-0', 'c', 'Citra');
    await sync.syncTree((await treeOf('a'))!.id);
  });

  afterAll(async () => {
    if (prisma) {
      // Let background graph syncs triggered by the last saves finish first.
      await new Promise((r) => setTimeout(r, 3000));
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      const persons = (await prisma.person.findMany({ where: { OR: [{ createdById: { in: ids } }, { userId: { in: ids } }] }, select: { id: true } })).map((p) => p.id);
      await prisma.relationConfirmation.deleteMany({ where: { userId: { in: ids } } });
      await prisma.mergeCandidate.deleteMany({ where: { OR: [{ personAId: { in: persons } }, { personBId: { in: persons } }] } });
      await prisma.person.deleteMany({ where: { id: { in: persons } } });
      const live = new Set((await prisma.person.findMany({ select: { id: true } })).map((p) => p.id));
      const orphan = (await prisma.mergeCandidate.findMany({ select: { id: true, personAId: true, personBId: true } }))
        .filter((c) => !live.has(c.personAId) || !live.has(c.personBId)).map((c) => c.id);
      await prisma.mergeCandidate.deleteMany({ where: { id: { in: orphan } } });
      await prisma.familyNodeMember.deleteMany({ where: { userId: { in: ids } } });
      await prisma.familyTree.deleteMany({ where: { userId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.verificationToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.loginHistory.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.point.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  it('lists where my account is drawn, and whether I am in that household', async () => {
    const adiTree = (await treeOf('a'))!;
    expect((await http().get('/api/trees/me/links').set(as('b')).expect(200)).body).toEqual([
      expect.objectContaining({ treeId: adiTree.id, nodeId: 'child-0', nodeName: 'Budi', ownerName: 'Adi', pending: false, householdMember: true }),
    ]);
    expect((await http().get('/api/trees/me/links').set(as('c')).expect(200)).body).toEqual([
      expect.objectContaining({ nodeId: 'younger-0', householdMember: false }),
    ]);
    expect((await treeOf('b'))!.slug).toBeNull();
  });

  it('leaving the household gives my own page back; I stay drawn in the tree', async () => {
    const res = (await http().delete('/api/trees/family-node/membership').set(as('b')).expect(200)).body;
    expect(res.slug).toBeTruthy();
    expect((await treeOf('b'))!.slug).toBe(res.slug);
    expect(await prisma.familyNodeMember.findFirst({ where: { userId: users.b.id, isHead: false } })).toBeNull();
    expect((await layoutOf('a')).members['child-0'].linkedUserId).toBe(users.b.id);
    expect(await notified('a', 'FAMILY_NODE_LEFT')).toBe(1);
    // Not a member of anyone's household any more.
    await http().delete('/api/trees/family-node/membership').set(as('b')).expect(400);
  });

  it('"ini bukan saya": the circle stays without account and the graph follows', async () => {
    const adiTree = (await treeOf('a'))!;
    await http().delete(`/api/trees/me/links/${adiTree.id}/younger-0`).set(as('b')).expect(404);
    await http().delete(`/api/trees/me/links/${(await treeOf('b'))!.id}/self`).set(as('b')).expect(400);

    const res = (await http().delete(`/api/trees/me/links/${adiTree.id}/younger-0`).set(as('c')).expect(200)).body;
    expect(res).toMatchObject({ leftHousehold: false });
    const circle = (await layoutOf('a')).members['younger-0'];
    expect(circle.name).toBe('Citra');
    expect(circle.linkedUserId).toBeUndefined();
    expect(await notified('a', 'LINK_RELEASED')).toBe(1);
    expect((await http().get('/api/trees/me/links').set(as('c')).expect(200)).body).toEqual([]);

    await sync.syncTree(adiTree.id);
    const citra = (await prisma.person.findUnique({ where: { userId: users.c.id } }))!;
    const circlePerson = (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: adiTree.id, nodeKey: 'younger-0' } } }))!.personId;
    expect(circlePerson).not.toBe(citra.id);
    // Adi's tree no longer asserts anything about Citra's account.
    expect(await prisma.graphAssertion.count({
      where: { treeId: adiTree.id, kind: 'PARENTAGE', targetId: { in: (await prisma.parentage.findMany({ where: { OR: [{ parentId: citra.id }, { childId: citra.id }] }, select: { id: true } })).map((p) => p.id) } },
    })).toBe(0);
  });

  it('an owner removing a household link gives that person their page back', async () => {
    expect((await treeOf('d'))!.slug).toBeNull();
    const l = await layoutOf('a');
    const { linkedUserId: _drop, ...dewi } = l.members['child-1'];
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'child-1': dewi }, baseUpdatedAt: l.updatedAt }).expect(200);
    expect(await prisma.familyNodeMember.findFirst({ where: { userId: users.d.id, isHead: false } })).toBeNull();
    expect((await treeOf('d'))!.slug).toBeTruthy();
  });
});
