process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';
import { GenealogyService } from '../src/modules/genealogy/genealogy.service';

jest.setTimeout(180000);

/**
 * Fase 1 — siblings A and B each draw the family and link each other.
 * The graph must hold ONE Person per account, derive "Adik kandung" from the
 * shared parents, flag the doubly-drawn parents as duplicate suspects, and
 * retract relations a tree stops asserting.
 */
describe('Genealogy graph (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Graph12345!';
  const users = {
    a: { email: `graph_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `graph_b_${stamp}@digsan.test`, id: '', token: '' },
  };
  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });

  async function registerAndLogin(key: keyof typeof users, name: string) {
    const u = users[key];
    await http().post('/api/auth/register').send({ email: u.email, name, password });
    const ver = await prisma.verificationToken.findFirst({ where: { user: { email: u.email }, type: 'EMAIL', used: false } });
    await http().get(`/api/auth/verify-email?token=${ver!.token}`);
    const login = await http().post('/api/auth/login').send({ email: u.email, password });
    u.token = login.body.accessToken;
    u.id = login.body.user.id;
  }
  const layoutOf = async (key: keyof typeof users) => (await http().get('/api/trees/layout').set(as(key)).expect(200)).body;
  const treeIdOf = async (key: keyof typeof users) => (await prisma.familyTree.findFirst({ where: { userId: users[key].id } }))!.id;
  const personOf = async (key: keyof typeof users) => (await prisma.person.findUnique({ where: { userId: users[key].id } }))!;

  async function linkAndApprove(from: keyof typeof users, to: keyof typeof users, nodeId: string, name: string) {
    const l = await layoutOf(from);
    await http().put('/api/trees/layout').set(as(from)).send({
      members: { ...l.members, [nodeId]: { name, linkedUserId: users[to].id } }, baseUpdatedAt: l.updatedAt,
    }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as(to)).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as(to)).send({ approve: true }).expect(200);
  }

  /** Background dual-write is fire-and-forget; sync explicitly so assertions are deterministic. */
  const settle = async () => {
    for (const k of ['a', 'b'] as const) await sync.syncTree(await treeIdOf(k));
  };

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
  });

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(users).map((u) => u.id).filter(Boolean);
      await prisma.person.deleteMany({ where: { OR: [{ createdById: { in: ids } }, { userId: { in: ids } }] } });
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

  it('builds the siblings scenario through the normal tree API', async () => {
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Adi', spouseCount: 0, childCount: 0, parentCount: 2, olderCount: 0, youngerCount: 1 },
      members: { self: { name: 'Adi', gender: 'L' }, 'parent-0': { name: 'Bapak Slamet', gender: 'L' }, 'parent-1': { name: 'Ibu Sri', gender: 'P' }, 'younger-0': { name: 'Budi' } },
    }).expect(200);
    await http().put('/api/trees/layout').set(as('b')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Budi', spouseCount: 0, childCount: 0, parentCount: 2, olderCount: 1, youngerCount: 0 },
      members: { self: { name: 'Budi', gender: 'L' }, 'parent-0': { name: 'Pak Slamet', gender: 'L' }, 'parent-1': { name: 'Bu Sri', gender: 'P' }, 'older-0': { name: 'Adi' } },
    }).expect(200);
    await linkAndApprove('a', 'b', 'younger-0', 'Budi');
    await linkAndApprove('b', 'a', 'older-0', 'Adi');
    await settle();
  });

  it('keeps exactly one Person per account, shared by both trees', async () => {
    const a = await personOf('a');
    const b = await personOf('b');
    const mapsA = await prisma.legacyNodeMap.findMany({ where: { personId: a.id } });
    const mapsB = await prisma.legacyNodeMap.findMany({ where: { personId: b.id } });
    expect(mapsA.map((m) => m.nodeKey).sort()).toEqual(['older-0', 'self']);
    expect(mapsB.map((m) => m.nodeKey).sort()).toEqual(['self', 'younger-0']);
    expect(await prisma.person.count({ where: { userId: { in: [users.a.id, users.b.id] } } })).toBe(2);
  });

  it('derives the sibling relation from shared parents', async () => {
    const b = await personOf('b');
    const rel = (await http().get(`/api/genealogy/me/relation/${b.id}`).set(as('a')).expect(200)).body;
    expect(rel.relation.label).toBe('Adik kandung');

    const view = (await http().get('/api/genealogy/me/view').set(as('a')).expect(200)).body;
    const budi = view.persons.find((p: any) => p.id === b.id);
    expect(budi.relation.label).toBe('Adik kandung');
    expect(budi.hasAccount).toBe(true);
    expect(budi.userId).toBeUndefined();
  });

  it('flags the parents both siblings drew as duplicate suspects (merge candidates for Fase 2)', async () => {
    const b = await personOf('b');
    const issues = (await app.get(GenealogyService).check()).issues;
    const suspects = issues.filter((i) => i.code === 'DUPLICATE_PARENT_SUSPECT' && i.personIds[0] === b.id);
    expect(suspects.length).toBe(2); // two fathers, two mothers
  });

  it('retracts relations a tree no longer asserts, keeping what other trees assert', async () => {
    const aTree = await treeIdOf('a');
    const b = await personOf('b');
    const aFather = (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: aTree, nodeKey: 'parent-0' } } }))!.personId;
    expect(await prisma.parentage.count({ where: { parentId: aFather, childId: b.id } })).toBe(1);

    const l = await layoutOf('a');
    const members = { ...l.members };
    delete members['younger-0'];
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { ...l.config, youngerCount: 0 }, members, baseUpdatedAt: l.updatedAt,
    }).expect(200);
    await settle();

    expect(await prisma.parentage.count({ where: { parentId: aFather, childId: b.id } })).toBe(0);
    // B's own tree still says B has parents.
    expect(await prisma.parentage.count({ where: { childId: b.id } })).toBe(2);
  });

  it('a dry-run backfill reports without persisting anything', async () => {
    const before = await prisma.person.count();
    const report = await sync.backfill({ dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.trees).toBeGreaterThanOrEqual(2);
    expect(report.errors).toEqual([]);
    expect(await prisma.person.count()).toBe(before);
  });
});
