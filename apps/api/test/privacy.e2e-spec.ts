process.env.GRAPH_MODEL = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';

jest.setTimeout(180000);

/**
 * F2-09 — Adi's family page shows his son Budi (linked account) and his late
 * father. Citra is a logged-in stranger. Account ids never reach the page,
 * contacts are family-only, and Budi can make himself private.
 */
describe('Family page privacy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: GraphSyncService;
  const stamp = Date.now();
  const password = 'Priv123456!';
  const users = {
    a: { email: `prv_a_${stamp}@digsan.test`, id: '', token: '' },
    b: { email: `prv_b_${stamp}@digsan.test`, id: '', token: '' },
    c: { email: `prv_c_${stamp}@digsan.test`, id: '', token: '' },
  };
  type U = keyof typeof users;
  let slug = '';
  const http = () => request(app.getHttpServer());
  const as = (u: U) => ({ Authorization: `Bearer ${users[u].token}` });
  const treeOf = (u: U) => prisma.familyTree.findFirst({ where: { userId: users[u].id }, orderBy: { createdAt: 'asc' } });
  const page = async (u: U) => (await http().get(`/api/public/family/${slug}`).set(as(u)).expect(200)).body;

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

    for (const k of ['b', 'c'] as const) {
      await http().put('/api/trees/layout').set(as(k)).send({
        config: { configured: true, mainFamilyName: `Keluarga ${k}`, spouseCount: 0, childCount: 0, parentCount: 0, olderCount: 0, youngerCount: 0 },
        members: { self: { name: k } },
      }).expect(200);
    }
    await http().put('/api/trees/layout').set(as('a')).send({
      config: { configured: true, mainFamilyName: 'Keluarga Adi', spouseCount: 0, childCount: 1, parentCount: 1, olderCount: 0, youngerCount: 0 },
      members: {
        self: { name: 'Adi', gender: 'L' },
        'parent-0': { name: 'Bapak Slamet', gender: 'L', alive: false },
        'child-0': { name: 'Budi', email: 'budi@contoh.id', phone: '081200000000' },
      },
    }).expect(200);
    const l = (await http().get('/api/trees/layout').set(as('a')).expect(200)).body;
    await http().put('/api/trees/layout').set(as('a')).send({ members: { ...l.members, 'child-0': { ...l.members['child-0'], linkedUserId: users.b.id } }, baseUpdatedAt: l.updatedAt }).expect(200);
    const incoming = (await http().get('/api/trees/link-requests/incoming').set(as('b')).expect(200)).body;
    await http().patch(`/api/trees/link-requests/${incoming[0].id}`).set(as('b')).send({ approve: true }).expect(200);
    for (const k of ['a', 'b', 'c'] as const) await sync.syncTree((await treeOf(k))!.id);
    slug = (await treeOf('a'))!.slug!;
  });

  afterAll(async () => {
    if (prisma) {
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

  it('account ids never reach the page; contacts are family-only', async () => {
    for (const u of ['a', 'b', 'c'] as const) {
      const body = await page(u);
      expect(JSON.stringify(body.members)).not.toContain(users.b.id);
      expect(body.members['child-0'].hasAccount).toBe(true);
    }
    const stranger = await page('c');
    expect(stranger.viewerIsFamily).toBe(false);
    expect(stranger.members['child-0']).toMatchObject({ name: 'Budi' });
    expect(stranger.members['child-0'].email).toBeUndefined();
    expect(stranger.members['child-0'].phone).toBeUndefined();

    const son = await page('b');
    expect(son.viewerIsFamily).toBe(true);
    // (Approving the link syncs the circle's email to the account's.)
    expect(son.members['child-0']).toMatchObject({ email: users.b.email, phone: '081200000000' });
  });

  it('only the person (or their manager) may change privacy', async () => {
    const budi = (await prisma.person.findUnique({ where: { userId: users.b.id } }))!;
    const fatherId = (await prisma.legacyNodeMap.findUnique({ where: { treeId_nodeKey: { treeId: (await treeOf('a'))!.id, nodeKey: 'parent-0' } } }))!.personId;
    await http().patch(`/api/genealogy/persons/${budi.id}/privacy`).set(as('c')).send({ privacy: 'PRIVATE' }).expect(403);
    await http().patch(`/api/genealogy/persons/${budi.id}/privacy`).set(as('a')).send({ privacy: 'PRIVATE' }).expect(403);
    await http().patch(`/api/genealogy/persons/${budi.id}/privacy`).set(as('b')).send({ privacy: 'SECRET' }).expect(400);
    await http().patch(`/api/genealogy/persons/${fatherId}/privacy`).set(as('a')).send({ privacy: 'PRIVATE' }).expect(200);
    expect((await http().patch(`/api/genealogy/persons/${budi.id}/privacy`).set(as('b')).send({ privacy: 'PRIVATE' }).expect(200)).body.privacy).toBe('PRIVATE');
    expect(await prisma.personRevision.count({ where: { personId: budi.id, source: 'API' } })).toBe(1);
  });

  it('a private living person is anonymous to strangers; the deceased are not', async () => {
    const stranger = await page('c');
    expect(stranger.members['child-0']).toMatchObject({ name: 'Anggota keluarga', photo: null, private: true });
    expect(stranger.members['parent-0']).toMatchObject({ name: 'Bapak Slamet' });
    expect((await page('a')).members['child-0'].name).toBe('Budi');
  });

  it("profiles: birth details are family-only; a private person shows strangers little", async () => {
    await prisma.user.update({ where: { id: users.b.id }, data: { birthDate: new Date('2000-05-01'), birthPlace: 'Klaten', occupation: 'Guru' } });
    const username = (await prisma.user.findUnique({ where: { id: users.b.id } }))!.username!;
    const byStranger = (await http().get(`/api/public/family/${slug}/${username}`).set(as('c')).expect(200)).body.profile;
    expect(byStranger).toMatchObject({ birthDate: null, birthPlace: null, occupation: null, private: true });
    const byFather = (await http().get(`/api/public/family/${slug}/${username}`).set(as('a')).expect(200)).body.profile;
    expect(byFather).toMatchObject({ birthPlace: 'Klaten', occupation: 'Guru' });
    expect(byFather.birthDate).toBeTruthy();
  });
});
