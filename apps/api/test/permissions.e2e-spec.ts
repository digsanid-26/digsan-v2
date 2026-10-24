process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';

jest.setTimeout(180000);

/**
 * F2-01 — one authority matrix. Adi drew his parents and linked his brother
 * Budi; Citra is a stranger. Adi manages the father he drew, Budi may only
 * propose, Citra may do nothing. Adi can appoint Budi as co-steward.
 */
describe('Authority matrix (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Perm12345!';
  const users = {
    a: { email: `perm_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `perm_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `perm_c_${stamp}@digsan.test`, id: '', token: '' },
  };
  let fatherId = '';
  let adiPersonId = '';
  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeIdOf = async (k: keyof typeof users) => (await prisma.familyTree.findFirst({ where: { userId: users[k].id } }))!.id;
  const perms = async (k: keyof typeof users, personId: string) =>
    (await http().get(`/api/genealogy/persons/${personId}/permissions`).set(as(k)).expect(200)).body;

  async function registerAndLogin(key: keyof typeof users, name: string) {
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

    const cfg = { configured: true, spouseCount: 0, childCount: 0, parentCount: 2, olderCount: 0 };
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { ...cfg, mainFamilyName: 'Keluarga Adi', youngerCount: 1 },
      members: { self: { name: 'Adi', gender: 'L' }, 'parent-0': { name: 'Bapak Slamet', gender: 'L' }, 'parent-1': { name: 'Ibu Sri', gender: 'P' }, 'younger-0': { name: 'Budi' } },
    }).expect(200);
    for (const k of ['b', 'c'] as const) {
      await http().put('/api/trees/layout').set(as(k)).send({ config: { ...cfg, parentCount: 0, youngerCount: 0, mainFamilyName: `Keluarga ${k}` }, members: { self: { name: k } } }).expect(200);
    }
    const l = (await http().get('/api/trees/layout').set(as('a')).expect(200)).body;
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'younger-0': { name: 'Budi', linkedUserId: users.b.id } }, baseUpdatedAt: l.updatedAt }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);
    for (const k of ['a', 'b', 'c'] as const) await sync.syncTree(await treeIdOf(k));

    fatherId = (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: await treeIdOf('a'), nodeKey: 'parent-0' } } }))!.personId;
    adiPersonId = (await prisma.person.findUnique({ where: { userId: users.a.id } }))!.id;
  });

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      const persons = (await prisma.person.findMany({ where: { OR: [{ createdById: { in: ids } }, { userId: { in: ids } }] }, select: { id: true } })).map((p) => p.id);
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

  it('the one who drew the father manages him; a relative may propose; a stranger nothing', async () => {
    const a = await perms('a', fatherId);
    expect(a.edit.decision).toBe('DIRECT');
    expect(a.manageStewards.decision).toBe('DIRECT');
    expect(a.stewards).toEqual([expect.objectContaining({ userId: users.a.id, name: 'Adi', role: 'PRIMARY' })]);

    const b = await perms('b', fatherId);
    expect(b.edit.decision).toBe('PROPOSAL');
    expect(b.manageStewards.decision).toBe('DENY');
    expect(b.decideMerge.decision).toBe('DENY');

    expect((await perms('c', fatherId)).edit.decision).toBe('DENY');
  });

  it("a person with an account owns their profile — even a sibling only proposes", async () => {
    expect((await perms('a', adiPersonId)).edit.decision).toBe('DIRECT');
    const b = await perms('b', adiPersonId);
    expect(b.edit.decision).toBe('PROPOSAL');
    expect(b.decideMerge.decision).toBe('DENY');
  });

  it('co-steward (wali bersama): only family members, then they manage directly', async () => {
    await http().post(`/api/genealogy/persons/${fatherId}/stewards`).set(as('a')).send({ userId: users.c.id }).expect(400);
    await http().post(`/api/genealogy/persons/${fatherId}/stewards`).set(as('b')).send({ userId: users.b.id }).expect(403);

    const res = (await http().post(`/api/genealogy/persons/${fatherId}/stewards`).set(as('a')).send({ userId: users.b.id }).expect(201)).body;
    expect(res.stewards.map((s: any) => s.role).sort()).toEqual(['CO_STEWARD', 'PRIMARY']);
    const b = await perms('b', fatherId);
    expect(b.edit.decision).toBe('DIRECT');
    expect(b.decideMerge.decision).toBe('DIRECT');
    expect(b.manageStewards.decision).toBe('DENY');

    // A co-steward cannot remove the primary manager, but may step down.
    await http().delete(`/api/genealogy/persons/${fatherId}/stewards/${users.a.id}`).set(as('b')).expect(400);
    await http().delete(`/api/genealogy/persons/${fatherId}/stewards/${users.b.id}`).set(as('b')).expect(200);
    expect((await perms('b', fatherId)).edit.decision).toBe('PROPOSAL');
    expect(await prisma.personRevision.count({ where: { personId: fatherId, source: 'API' } })).toBe(2);
  });

  it('stewards may not be added to a person who has their own account', async () => {
    await http().post(`/api/genealogy/persons/${adiPersonId}/stewards`).set(as('a')).send({ userId: users.b.id }).expect(400);
  });
});
