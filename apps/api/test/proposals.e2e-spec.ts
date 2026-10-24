process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';

jest.setTimeout(180000);

/**
 * F2-02 — Adi drew (and manages) the father; Budi's tree shows the same
 * father. Budi's edits become proposals for Adi; Adi's edits apply directly
 * and appear in Budi's tree too.
 */
describe('Change proposals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Prop12345!';
  const users = {
    a: { email: `prop_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `prop_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `prop_c_${stamp}@digsan.test`, id: '', token: '' },
  };
  let fatherId = '';
  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeIdOf = async (k: keyof typeof users) => (await prisma.familyTree.findFirst({ where: { userId: users[k].id } }))!.id;
  const layoutOf = async (k: keyof typeof users) => (await http().get('/api/trees/layout').set(as(k)).expect(200)).body;
  const editCircle = async (k: keyof typeof users, nodeId: string, patch: Record<string, unknown>) => {
    const l = await layoutOf(k);
    await http().put('/api/trees/layout').set(as(k)).send({
      members: { ...l.members, [nodeId]: { ...(l.members?.[nodeId] ?? {}), ...patch } }, baseUpdatedAt: l.updatedAt,
    }).expect(200);
    await sync.syncTree(await treeIdOf(k));
  };
  const father = () => prisma.person.findUniqueOrThrow({ where: { id: fatherId } });
  const pending = () => prisma.changeProposal.findMany({ where: { personId: fatherId, status: 'PENDING' } });

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

    const cfg = { configured: true, spouseCount: 0, childCount: 0, parentCount: 2 };
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { ...cfg, mainFamilyName: 'Keluarga Adi', olderCount: 0, youngerCount: 1 },
      members: { self: { name: 'Adi', gender: 'L' }, 'parent-0': { name: 'Bapak Slamet', gender: 'L' }, 'parent-1': { name: 'Ibu Sri', gender: 'P' }, 'younger-0': { name: 'Budi' } },
    }).expect(200);
    await http().put('/api/trees/layout').set(as('b')).send({
      config: { ...cfg, mainFamilyName: 'Keluarga Budi', olderCount: 1, youngerCount: 0 }, members: { self: { name: 'Budi', gender: 'L' } },
    }).expect(200);
    await http().put('/api/trees/layout').set(as('c')).send({
      config: { ...cfg, parentCount: 0, olderCount: 0, youngerCount: 0, mainFamilyName: 'Keluarga Citra' }, members: { self: { name: 'Citra' } },
    }).expect(200);

    const l = await layoutOf('a');
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'younger-0': { name: 'Budi', linkedUserId: users.b.id } }, baseUpdatedAt: l.updatedAt }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);
    for (const k of ['a', 'b', 'c'] as const) await sync.syncTree(await treeIdOf(k));

    // Budi picks the father Adi already recorded (search before create).
    fatherId = (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: await treeIdOf('a'), nodeKey: 'parent-0' } } }))!.personId;
    await editCircle('b', 'parent-0', { name: 'Pak Slamet', gender: 'L', graphPersonId: fatherId });
    await sync.syncTree(await treeIdOf('b'));
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

  it("Budi's own spelling is not a change; nothing is proposed by just linking", async () => {
    expect(await pending()).toHaveLength(0);
    expect((await father()).displayName).toBe('Bapak Slamet');
  });

  it("Budi's edit in his own tree becomes a proposal for Adi (and only once)", async () => {
    await editCircle('b', 'parent-0', { alive: false });
    const p = await pending();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ proposerId: users.b.id, changes: { vitalStatus: { from: 'LIVING', to: 'DECEASED' } } });
    expect((await father()).vitalStatus).toBe('LIVING');
    expect(await prisma.notification.count({ where: { userId: users.a.id, data: { path: ['kind'], equals: 'CHANGE_PROPOSAL' } } })).toBe(1);

    // Re-saving / re-syncing without new edits proposes nothing more.
    await editCircle('b', 'self', { name: 'Budi' });
    await sync.syncTree(await treeIdOf('b'));
    expect(await pending()).toHaveLength(1);
  });

  it('only an approver may decide; approving applies it and mirrors it into Adi’s tree', async () => {
    const incoming = (await http().get('/api/genealogy/proposals?box=incoming').set(as('a')).expect(200)).body;
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ person: { displayName: 'Bapak Slamet' }, proposer: { name: 'Budi' } });
    expect((await http().get('/api/genealogy/proposals?box=incoming').set(as('b')).expect(200)).body).toEqual([]);

    await http().patch(`/api/genealogy/proposals/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(403);
    await http().patch(`/api/genealogy/proposals/${incoming[0].id}`).set(as('c')).send({ approve: true }).expect(403);
    const res = (await http().patch(`/api/genealogy/proposals/${incoming[0].id}`).set(as('a')).send({ approve: true }).expect(200)).body;
    expect(res.status).toBe('APPROVED');

    expect((await father()).vitalStatus).toBe('DECEASED');
    expect((await layoutOf('a')).members['parent-0'].alive).toBe(false);
    expect(await prisma.personRevision.count({ where: { personId: fatherId, source: 'PROPOSAL' } })).toBe(1);
    const out = (await http().get('/api/genealogy/proposals?box=outgoing').set(as('b')).expect(200)).body;
    expect(out[0].status).toBe('APPROVED');
    // Adi's next save does not bounce it back.
    await sync.syncTree(await treeIdOf('a'));
    expect((await father()).vitalStatus).toBe('DECEASED');
  });

  it("Adi (the manager) edits directly — Budi's tree follows, no proposal", async () => {
    await editCircle('a', 'parent-0', { name: 'Bapak Slamet Riyadi' });
    expect((await father()).displayName).toBe('Bapak Slamet Riyadi');
    expect((await layoutOf('b')).members['parent-0'].name).toBe('Bapak Slamet Riyadi');
    expect(await pending()).toHaveLength(0);
    // Budi's next sync is not a change either.
    await sync.syncTree(await treeIdOf('b'));
    expect(await pending()).toHaveLength(0);
    expect((await father()).displayName).toBe('Bapak Slamet Riyadi');
  });

  it('API: strangers are denied; reject, withdraw, and stale proposals', async () => {
    await http().post(`/api/genealogy/persons/${fatherId}/proposals`).set(as('c')).send({ changes: { birthPlace: 'X' } }).expect(403);

    const r1 = (await http().post(`/api/genealogy/persons/${fatherId}/proposals`).set(as('b')).send({ changes: { birthPlace: 'Klaten' }, note: 'Kata Ibu' }).expect(201)).body;
    expect(r1.status).toBe('PENDING');
    await http().patch(`/api/genealogy/proposals/${r1.id}`).set(as('a')).send({ approve: false }).expect(200);
    expect((await father()).birthPlace).toBeNull();

    const r2 = (await http().post(`/api/genealogy/persons/${fatherId}/proposals`).set(as('b')).send({ changes: { birthPlace: 'Solo' } }).expect(201)).body;
    await http().delete(`/api/genealogy/proposals/${r2.id}`).set(as('b')).expect(200);
    await http().patch(`/api/genealogy/proposals/${r2.id}`).set(as('a')).send({ approve: true }).expect(400);

    const r3 = (await http().post(`/api/genealogy/persons/${fatherId}/proposals`).set(as('b')).send({ changes: { displayName: 'Mbah Slamet' } }).expect(201)).body;
    const direct = (await http().post(`/api/genealogy/persons/${fatherId}/proposals`).set(as('a')).send({ changes: { displayName: 'H. Slamet' } }).expect(201)).body;
    expect(direct.status).toBe('APPLIED');
    await http().patch(`/api/genealogy/proposals/${r3.id}`).set(as('a')).send({ approve: true }).expect(409);
    expect((await prisma.changeProposal.findUniqueOrThrow({ where: { id: r3.id } })).status).toBe('SUPERSEDED');
    expect((await father()).displayName).toBe('H. Slamet');
  });
});
