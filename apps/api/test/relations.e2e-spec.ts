process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';

jest.setTimeout(180000);

/**
 * F2-03 — Adi drew his parents and linked his brother Budi. The parentages
 * that now touch Budi's account stay PROPOSED until Budi agrees, either by
 * confirming or by drawing them in his own tree. A rejection is respected.
 */
describe('Two-way relation confirmation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Rel123456!';
  const users = {
    a: { email: `rel_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `rel_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `rel_c_${stamp}@digsan.test`, id: '', token: '' },
  };
  type U = keyof typeof users;
  let fatherId = '';
  let motherId = '';
  let budiId = '';
  const http = () => request(app.getHttpServer());
  const as = (u: U) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeIdOf = async (k: U) => (await prisma.familyTree.findFirst({ where: { userId: users[k].id } }))!.id;
  const mapped = async (k: U, nodeKey: string) =>
    (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: await treeIdOf(k), nodeKey } } }))!.personId;
  const parentage = (parentId: string, childId: string) =>
    prisma.parentage.findUniqueOrThrow({ where: { parentId_childId_kind: { parentId, childId, kind: 'BIOLOGICAL' } } });
  const pending = async (k: U) => (await http().get('/api/genealogy/relations/pending').set(as(k)).expect(200)).body;

  async function registerAndLogin(key: U, name: string) {
    const u = users[key];
    await http().post('/api/auth/register').send({ email: u.email, name, password });
    const ver = await prisma.verificationToken.findFirst({ where: { user: { email: u.email }, type: 'EMAIL', used: false } });
    await http().get(`/api/auth/verify-email?token=${ver!.token}`);
    const login = await http().post('/api/auth/login').send({ email: u.email, password });
    u.token = login.body.accessToken;
    u.id = login.body.user.id;
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

    const cfg = { configured: true, spouseCount: 0, childCount: 0, parentCount: 2 };
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { ...cfg, mainFamilyName: 'Keluarga Adi', olderCount: 0, youngerCount: 1 },
      members: { self: { name: 'Adi', gender: 'L' }, 'parent-0': { name: 'Bapak Slamet', gender: 'L' }, 'parent-1': { name: 'Ibu Sri', gender: 'P' }, 'younger-0': { name: 'Budi' } },
    }).expect(200);
    for (const k of ['b', 'c'] as const) {
      await http().put('/api/trees/layout').set(as(k)).send({
        config: { ...cfg, parentCount: k === 'b' ? 2 : 0, olderCount: k === 'b' ? 1 : 0, youngerCount: 0, mainFamilyName: `Keluarga ${k}` },
        members: { self: { name: k } },
      }).expect(200);
    }
    for (const k of ['a', 'b', 'c'] as const) await sync.syncTree(await treeIdOf(k));

    // Adi links the younger-brother circle to Budi's account; Budi confirms identity.
    const l = (await http().get('/api/trees/layout').set(as('a')).expect(200)).body;
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'younger-0': { name: 'Budi', linkedUserId: users.b.id } }, baseUpdatedAt: l.updatedAt }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);
    await sync.syncTree(await treeIdOf('a'));

    fatherId = await mapped('a', 'parent-0');
    motherId = await mapped('a', 'parent-1');
    budiId = (await prisma.person.findUnique({ where: { userId: users.b.id } }))!.id;
  });

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      const persons = (await prisma.person.findMany({ where: { OR: [{ createdById: { in: ids } }, { userId: { in: ids } }] }, select: { id: true } })).map((p) => p.id);
      const rels = [
        ...(await prisma.parentage.findMany({ where: { OR: [{ parentId: { in: persons } }, { childId: { in: persons } }] }, select: { id: true } })),
        ...(await prisma.union.findMany({ where: { OR: [{ partnerAId: { in: persons } }, { partnerBId: { in: persons } }] }, select: { id: true } })),
      ].map((r) => r.id);
      await prisma.relationConfirmation.deleteMany({ where: { OR: [{ targetId: { in: rels } }, { userId: { in: ids } }] } });
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

  it("relations touching Budi's account wait for him; Adi's own are confirmed", async () => {
    const adiId = (await prisma.person.findUnique({ where: { userId: users.a.id } }))!.id;
    expect((await parentage(fatherId, adiId)).status).toBe('CONFIRMED');
    expect((await parentage(fatherId, budiId)).status).toBe('PROPOSED');
    expect((await parentage(motherId, budiId)).status).toBe('PROPOSED');
    expect(await prisma.notification.count({ where: { userId: users.b.id, data: { path: ['kind'], equals: 'RELATION_CONFIRM' } } })).toBe(1);

    const list = await pending('b');
    expect(list.map((r: any) => r.description).sort()).toEqual(['Bapak Slamet adalah ayah Anda', 'Ibu Sri adalah ibu Anda']);
    expect(list[0].proposedBy).toBe('Adi');
    expect(await pending('a')).toEqual([]);
  });

  it('only a person involved may decide', async () => {
    const [r] = await pending('b');
    await http().patch(`/api/genealogy/relations/parentage/${r.id}`).set(as('c')).send({ approve: true }).expect(403);
    await http().patch(`/api/genealogy/relations/parentage/${r.id}`).set(as('a')).send({ approve: true }).expect(403);
  });

  it('Budi confirms his father and rejects the mother; the rejection survives re-syncs', async () => {
    const father = await parentage(fatherId, budiId);
    const mother = await parentage(motherId, budiId);
    expect((await http().patch(`/api/genealogy/relations/parentage/${father.id}`).set(as('b')).send({ approve: true }).expect(200)).body.status).toBe('CONFIRMED');
    expect((await http().patch(`/api/genealogy/relations/parentage/${mother.id}`).set(as('b')).send({ approve: false }).expect(200)).body.status).toBe('REJECTED');
    expect(await prisma.notification.count({ where: { userId: users.a.id, data: { path: ['kind'], equals: 'RELATION_REJECTED' } } })).toBe(1);

    await sync.syncTree(await treeIdOf('a'));
    expect((await parentage(motherId, budiId)).status).toBe('REJECTED');
    expect((await parentage(fatherId, budiId)).status).toBe('CONFIRMED');
    expect(await pending('b')).toEqual([]);
  });

  it('drawing the relation in his own tree means Budi agrees after all', async () => {
    const l = (await http().get('/api/trees/layout').set(as('b')).expect(200)).body;
    await http().put('/api/trees/layout').set(as('b')).send({
      members: { ...l.members, 'parent-1': { name: 'Ibu Sri', gender: 'P', graphPersonId: motherId } }, baseUpdatedAt: l.updatedAt,
    }).expect(200);
    await sync.syncTree(await treeIdOf('b'));
    await sync.syncTree(await treeIdOf('b'));
    expect(await mapped('b', 'parent-1')).toBe(motherId);
    expect((await parentage(motherId, budiId)).status).toBe('CONFIRMED');
  });
});
