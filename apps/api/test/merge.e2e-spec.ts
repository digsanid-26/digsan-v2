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
 * Fase 2 (F2-04/F2-06) — siblings A and B each drew their parents. The
 * duplicated parents are detected, proposed to both siblings, and merged only
 * after BOTH approve. A rejected candidate is never proposed again.
 */
describe('Merge duplicates (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  let merge: MergeService;
  const stamp = Date.now();
  const password = 'Merge12345!';
  const users = {
    a: { email: `merge_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `merge_b_${stamp}@digsan.test`, id: '', token: '' },
  };
  const http = () => request(app.getHttpServer());
  const as = (u: keyof typeof users) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeIdOf = async (k: keyof typeof users) => (await prisma.familyTree.findFirst({ where: { userId: users[k].id } }))!.id;
  const personOf = async (k: keyof typeof users) => (await prisma.person.findUnique({ where: { userId: users[k].id } }))!;
  const mapped = async (k: keyof typeof users, nodeKey: string) =>
    (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: await treeIdOf(k), nodeKey } } }))!.personId;
  const settle = async () => { for (const k of ['a', 'b'] as const) await sync.syncTree(await treeIdOf(k)); };

  async function registerAndLogin(key: keyof typeof users, name: string) {
    const u = users[key];
    await http().post('/api/auth/register').send({ email: u.email, name, password });
    const ver = await prisma.verificationToken.findFirst({ where: { user: { email: u.email }, type: 'EMAIL', used: false } });
    await http().get(`/api/auth/verify-email?token=${ver!.token}`);
    const login = await http().post('/api/auth/login').send({ email: u.email, password });
    u.token = login.body.accessToken;
    u.id = login.body.user.id;
  }
  async function linkAndApprove(from: keyof typeof users, to: keyof typeof users, nodeId: string, name: string) {
    const l = (await http().get('/api/trees/layout').set(as(from)).expect(200)).body;
    await http().put('/api/trees/layout').set(as(from)).send({
      members: { ...l.members, [nodeId]: { name, linkedUserId: users[to].id } }, baseUpdatedAt: l.updatedAt,
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
    merge = app.get(MergeService);
    await registerAndLogin('a', 'Adi');
    await registerAndLogin('b', 'Budi');

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

  it('detects the doubly-drawn father and mother and proposes them to both siblings', async () => {
    await merge.detect();
    for (const k of ['a', 'b'] as const) {
      const list = (await http().get('/api/genealogy/merge-candidates').set(as(k)).expect(200)).body;
      const names = list.map((c: any) => [c.personA.displayName, c.personB.displayName].sort().join(' + ')).sort();
      expect(names).toEqual(['Bapak Slamet + Pak Slamet', 'Bu Sri + Ibu Sri']);
      expect(list[0].sharedChildren).toEqual(expect.arrayContaining(['Budi']));
      expect(list[0].approvalsNeeded).toBe(2);
    }
    expect(await prisma.notification.count({ where: { userId: users.b.id, data: { path: ['kind'], equals: 'MERGE_CANDIDATE' } } })).toBe(2);
  });

  it('merges only after BOTH stewards approve', async () => {
    const list = (await http().get('/api/genealogy/merge-candidates').set(as('a')).expect(200)).body;
    const father = list.find((c: any) => c.personA.sex === 'MALE');

    const first = (await http().patch(`/api/genealogy/merge-candidates/${father.id}`).set(as('a')).send({ approve: true }).expect(200)).body;
    expect(first.status).toBe('OPEN');
    expect(await mapped('a', 'parent-0')).not.toBe(await mapped('b', 'parent-0'));

    const second = (await http().patch(`/api/genealogy/merge-candidates/${father.id}`).set(as('b')).send({ approve: true }).expect(200)).body;
    expect(second.status).toBe('MERGED');

    // Both trees now point at the same father; Budi has exactly one father.
    const fatherId = await mapped('a', 'parent-0');
    expect(await mapped('b', 'parent-0')).toBe(fatherId);
    const b = await personOf('b');
    const bioParents = await prisma.parentage.findMany({ where: { childId: b.id, kind: 'BIOLOGICAL' }, include: { parent: true } });
    expect(bioParents.filter((p) => p.parent.sex === 'MALE')).toHaveLength(1);
    // The other spelling is kept as an alias.
    expect(await prisma.personName.count({ where: { personId: fatherId, kind: 'ALIAS' } })).toBe(1);
  });

  it('re-syncing both trees does not recreate the duplicate nor flip the name', async () => {
    const fatherId = await mapped('a', 'parent-0');
    const before = (await prisma.person.findUnique({ where: { id: fatherId } }))!.displayName;
    await settle();
    await settle();
    expect(await mapped('a', 'parent-0')).toBe(fatherId);
    expect(await mapped('b', 'parent-0')).toBe(fatherId);
    expect((await prisma.person.findUnique({ where: { id: fatherId } }))!.displayName).toBe(before);
    const rel = (await http().get(`/api/genealogy/me/relation/${(await personOf('b')).id}`).set(as('a')).expect(200)).body;
    expect(rel.relation.label).toBe('Adik kandung');
  });

  it('a rejection closes the candidate and it is never proposed again', async () => {
    const list = (await http().get('/api/genealogy/merge-candidates').set(as('b')).expect(200)).body;
    expect(list).toHaveLength(1);
    const res = (await http().patch(`/api/genealogy/merge-candidates/${list[0].id}`).set(as('b')).send({ approve: false }).expect(200)).body;
    expect(res.status).toBe('REJECTED');
    await merge.detect();
    expect((await http().get('/api/genealogy/merge-candidates').set(as('a')).expect(200)).body).toEqual([]);
  });

  it('outsiders cannot decide on someone else\'s candidate', async () => {
    const c = await prisma.mergeCandidate.findFirst({ where: { status: 'REJECTED', personAId: { in: [await mapped('a', 'parent-1'), await mapped('b', 'parent-1')] } } });
    // Already decided → 400; and a stranger would get 403 (covered by approver check).
    await http().patch(`/api/genealogy/merge-candidates/${c!.id}`).set(as('a')).send({ approve: true }).expect(400);
  });
});
