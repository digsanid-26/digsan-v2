process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';
import { MergeService } from '../src/modules/genealogy/merge.service';

jest.setTimeout(180000);

/**
 * F2-05 — search before create. Adi drew the parents and linked Budi as his
 * younger brother. When Budi fills in his own "Ayah" circle, the graph offers
 * the father Adi already recorded; choosing it reuses that Person, so no
 * duplicate (and no merge) is ever needed.
 */
describe('Search before create (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Suggest123!';
  const users = {
    a: { email: `sug_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `sug_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `sug_c_${stamp}@digsan.test`, id: '', token: '' },
  };
  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeIdOf = async (k: keyof typeof users) => (await prisma.familyTree.findFirst({ where: { userId: users[k].id } }))!.id;
  const mapped = async (k: keyof typeof users, nodeKey: string) =>
    (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: await treeIdOf(k), nodeKey } } }))?.personId;
  const layoutOf = async (k: keyof typeof users) => (await http().get('/api/trees/layout').set(as(k)).expect(200)).body;
  const settle = async () => { for (const k of ['a', 'b', 'c'] as const) await sync.syncTree(await treeIdOf(k)); };
  const save = async (k: keyof typeof users, patch: Record<string, unknown>, config?: Record<string, unknown>) => {
    const l = await layoutOf(k);
    return (await http().put('/api/trees/layout').set(as(k)).send({
      ...(config ? { config } : {}), members: { ...(l.members ?? {}), ...patch }, baseUpdatedAt: l.updatedAt,
    }).expect(200)).body;
  };

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
    await registerAndLogin('c', 'Citra Orang Lain');

    const famCfg = { configured: true, spouseCount: 0, childCount: 0, parentCount: 2 };
    await save('a', { self: { name: 'Adi', gender: 'L' }, 'parent-0': { name: 'Bapak Slamet', gender: 'L' }, 'parent-1': { name: 'Ibu Sri', gender: 'P' }, 'younger-0': { name: 'Budi' } },
      { ...famCfg, mainFamilyName: 'Keluarga Adi', olderCount: 0, youngerCount: 1 });
    await save('b', { self: { name: 'Budi', gender: 'L' } }, { ...famCfg, mainFamilyName: 'Keluarga Budi', olderCount: 1, youngerCount: 0 });
    await save('c', { self: { name: 'Citra' }, 'parent-0': { name: 'Pak Jauh', gender: 'L' } }, { ...famCfg, mainFamilyName: 'Keluarga Citra', olderCount: 0, youngerCount: 0 });

    // Adi links Budi as his younger brother; Budi confirms.
    const l = await layoutOf('a');
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'younger-0': { name: 'Budi', linkedUserId: users.b.id } }, baseUpdatedAt: l.updatedAt }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);
    await settle();
  });

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      const persons = (await prisma.person.findMany({ where: { OR: [{ createdById: { in: ids } }, { userId: { in: ids } }] }, select: { id: true } })).map((p) => p.id);
      await prisma.mergeCandidate.deleteMany({ where: { OR: [{ personAId: { in: persons } }, { personBId: { in: persons } }] } });
      await prisma.person.deleteMany({ where: { id: { in: persons } } });
      // Candidates whose persons were already removed by sync (orphan placeholders).
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

  it("offers the father Adi already recorded when Budi opens his own 'Ayah' circle", async () => {
    const res = (await http().get('/api/genealogy/me/suggest?nodeId=parent-0').set(as('b')).expect(200)).body;
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0]).toMatchObject({ displayName: 'Bapak Slamet', relation: 'Ayah', roleMatch: true, hasAccount: false });
    expect(res[0].drawnBy).toEqual(['Adi']);
    // The mother is not offered for the father's circle.
    expect(res.some((s: any) => s.displayName === 'Ibu Sri')).toBe(false);
  });

  it('also matches by typed name (titles ignored)', async () => {
    const res = (await http().get('/api/genealogy/me/suggest?q=Bu%20Sri').set(as('b')).expect(200)).body;
    expect(res[0].displayName).toBe('Ibu Sri');
  });

  it("choosing the suggestion reuses Adi's Person — no duplicate father, nothing to merge", async () => {
    const father = (await http().get('/api/genealogy/me/suggest?nodeId=parent-0').set(as('b')).expect(200)).body[0];
    const saved = await save('b', { 'parent-0': { name: 'Pak Slamet', gender: 'L', graphPersonId: father.personId } });
    expect(saved.members['parent-0'].graphPersonId).toBe(father.personId);
    await settle();

    expect(await mapped('b', 'parent-0')).toBe(await mapped('a', 'parent-0'));
    const budi = (await prisma.person.findUnique({ where: { userId: users.b.id } }))!;
    const fathers = (await prisma.parentage.findMany({ where: { childId: budi.id, kind: 'BIOLOGICAL' }, include: { parent: true } }))
      .filter((p) => p.parent.sex === 'MALE');
    expect(fathers).toHaveLength(1);
    // Budi's spelling doesn't overwrite the shared record.
    expect(fathers[0].parent.displayName).toBe('Bapak Slamet');
    // Nothing is left to merge for the father (an earlier candidate against
    // Budi's unnamed placeholder became obsolete when the placeholder vanished).
    await app.get(MergeService).detect();
    expect(await prisma.mergeCandidate.count({
      where: { status: 'OPEN', OR: [{ personAId: father.personId }, { personBId: father.personId }] },
    })).toBe(0);
    const open = (await http().get('/api/genealogy/merge-candidates').set(as('b')).expect(200)).body;
    expect(open.some((c: any) => [c.personA?.id, c.personB?.id].includes(father.personId))).toBe(false);
  });

  it('refuses persons outside my family, account persons, and reuse on two circles', async () => {
    const stranger = await mapped('c', 'parent-0');
    const adi = (await prisma.person.findUnique({ where: { userId: users.a.id } }))!;
    const mother = await mapped('a', 'parent-1');
    const saved = await save('b', {
      'parent-1': { name: 'Orang lain', graphPersonId: stranger },
      'older-0': { name: 'Adi', graphPersonId: adi.id },
    });
    expect(saved.members['parent-1'].graphPersonId).toBeUndefined();
    expect(saved.members['older-0'].graphPersonId).toBeUndefined();

    const dup = await save('b', { 'parent-1': { name: 'Ibu', graphPersonId: mother }, 'gpM-0': { name: 'X', graphPersonId: mother } });
    const holders = ['parent-1', 'gpM-0'].filter((k) => dup.members[k]?.graphPersonId === mother);
    expect(holders.length).toBeLessThanOrEqual(1);
  });
});
