import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(60000);

describe('Family Tree (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  const testEmail = `tree_e2e_${Date.now()}@digsan.test`;
  const testPassword = 'TreeTest123!';

  let treeId: string;
  let creatorMemberId: string;
  let fatherMemberId: string;
  let motherMemberId: string;
  let childMemberId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Register + verify + login test user
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: testEmail, name: 'Tree Tester', password: testPassword });

    const verToken = await prisma.verificationToken.findFirst({
      where: { user: { email: testEmail }, type: 'EMAIL', used: false },
    });
    await request(app.getHttpServer())
      .get(`/api/auth/verify-email?token=${verToken!.token}`);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    accessToken = loginRes.body.accessToken;
    userId = loginRes.body.user.id;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      // Cleanup: delete tree (cascades members, invitations, etc.)
      if (treeId) {
        await prisma.treeInvitation.deleteMany({ where: { treeId } });
        await prisma.cardStyle.deleteMany({ where: { treeId } });
        await prisma.familyMember.deleteMany({ where: { treeId } });
        await prisma.familyTree.deleteMany({ where: { id: treeId } });
      }
      // Cleanup test user
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.loginHistory.deleteMany({ where: { userId: user.id } });
        await prisma.userRole.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    if (app) await app.close();
  }, 15000);

  // ─── 1. TREE CRUD ──────────────────────────────────────────

  describe('Tree CRUD', () => {
    it('POST /api/trees — create a tree (auto-adds creator member)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/trees')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Keluarga Uji', description: 'Pohon keluarga untuk testing' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Keluarga Uji');
      treeId = res.body.id;
    });

    it('GET /api/trees — list my trees', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/trees')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].id).toBe(treeId);
    });

    it('GET /api/trees/:id — get tree detail with members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(treeId);
      expect(res.body.members).toHaveLength(1); // creator auto-added
      expect(res.body.members[0].isCreator).toBe(true);
      creatorMemberId = res.body.members[0].id;
    });

    it('PUT /api/trees/:id — update tree', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/trees/${treeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Keluarga Uji Updated', isPublic: true })
        .expect(200);

      expect(res.body.name).toBe('Keluarga Uji Updated');
      expect(res.body.isPublic).toBe(true);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/trees')
        .expect(401);
    });
  });

  // ─── 2. MEMBERS ────────────────────────────────────────────

  describe('Members CRUD', () => {
    it('POST /api/trees/:id/members — add father', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Bapak Uji',
          gender: 'male',
          birthDate: '1960-05-15',
          birthPlace: 'Jakarta',
          familyRole: 'Ayah',
        })
        .expect(201);

      expect(res.body.name).toBe('Bapak Uji');
      expect(res.body.gender).toBe('male');
      fatherMemberId = res.body.id;
    });

    it('POST /api/trees/:id/members — add mother with spouse link', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Ibu Uji',
          gender: 'female',
          birthDate: '1965-03-20',
          familyRole: 'Ibu',
          spouseId: fatherMemberId,
        })
        .expect(201);

      expect(res.body.name).toBe('Ibu Uji');
      expect(res.body.spouse).toBeTruthy();
      expect(res.body.spouse.id).toBe(fatherMemberId);
      motherMemberId = res.body.id;
    });

    it('bidirectional spouse link — father now shows mother as spouse', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/members/${fatherMemberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.spouse).toBeTruthy();
      expect(res.body.spouse.id).toBe(motherMemberId);
    });

    it('POST /api/trees/:id/members — add child with parent', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Anak Uji',
          gender: 'male',
          birthDate: '1990-11-01',
          familyRole: 'Anak',
          parentId: fatherMemberId,
          childOrder: 1,
        })
        .expect(201);

      expect(res.body.parent.id).toBe(fatherMemberId);
      childMemberId = res.body.id;
    });

    it('GET /api/trees/:id/members — list all members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // creator + father + mother + child = 4
      expect(res.body.length).toBe(4);
    });

    it('PUT /api/trees/:id/members/:memberId — update member', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/trees/${treeId}/members/${childMemberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Anak Uji Updated', birthPlace: 'Bandung' })
        .expect(200);

      expect(res.body.name).toBe('Anak Uji Updated');
    });

    it('should reject self-parent', async () => {
      await request(app.getHttpServer())
        .put(`/api/trees/${treeId}/members/${childMemberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ parentId: childMemberId })
        .expect(400);
    });

    it('should reject delete member with children', async () => {
      await request(app.getHttpServer())
        .delete(`/api/trees/${treeId}/members/${fatherMemberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('DELETE /api/trees/:id/members/:memberId — remove leaf member', async () => {
      await request(app.getHttpServer())
        .delete(`/api/trees/${treeId}/members/${childMemberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Re-add child for subsequent tests
      const res = await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Anak Uji Baru',
          gender: 'female',
          parentId: fatherMemberId,
          childOrder: 1,
        });
      childMemberId = res.body.id;
    });
  });

  // ─── 3. CARD STYLE ─────────────────────────────────────────

  describe('Card Style', () => {
    it('PUT /api/trees/:id/card-style — set card style', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/trees/${treeId}/card-style`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          backgroundColor: '#f0f0f0',
          textColor: '#333333',
          borderRadius: 12,
          fontFamily: 'Inter',
        })
        .expect(200);

      expect(res.body.backgroundColor).toBe('#f0f0f0');
      expect(res.body.borderRadius).toBe(12);
    });
  });

  // ─── 4. GRAPH & TRAVERSAL ──────────────────────────────────

  describe('Graph & Traversal', () => {
    it('GET /api/trees/:id/graph — get family graph', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/graph`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('nodes');
      expect(res.body).toHaveProperty('edges');
      expect(res.body.nodes.length).toBeGreaterThanOrEqual(4);
      // Should have parent edges and spouse edges
      const parentEdges = res.body.edges.filter((e: any) => e.type === 'parent');
      const spouseEdges = res.body.edges.filter((e: any) => e.type === 'spouse');
      expect(parentEdges.length).toBeGreaterThanOrEqual(1);
      expect(spouseEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/trees/:id/members/:memberId/ancestors — get ancestors', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/members/${childMemberId}/ancestors`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].id).toBe(fatherMemberId);
    });

    it('GET /api/trees/:id/members/:memberId/descendants — get descendants', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/members/${fatherMemberId}/descendants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/trees/:id/statistics — get tree statistics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/statistics`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.totalMembers).toBeGreaterThanOrEqual(4);
      expect(res.body).toHaveProperty('male');
      expect(res.body).toHaveProperty('female');
      expect(res.body).toHaveProperty('generations');
      expect(res.body.generations).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── 5. INVITATIONS ────────────────────────────────────────

  describe('Invitations', () => {
    let invitationId: string;
    let invitationToken: string;

    it('POST /api/trees/:id/invitations — create invitation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/invitations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'invited@digsan.test' })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body.email).toBe('invited@digsan.test');
      invitationId = res.body.id;
      invitationToken = res.body.token;
    });

    it('GET /api/trees/:id/invitations — list invitations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/trees/${treeId}/invitations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject invitation without email or phone', async () => {
      await request(app.getHttpServer())
        .post(`/api/trees/${treeId}/invitations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('DELETE /api/trees/:id/invitations/:invitationId — cancel invitation', async () => {
      await request(app.getHttpServer())
        .delete(`/api/trees/${treeId}/invitations/${invitationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // ─── 6. PUBLIC ENDPOINTS ────────────────────────────────────

  describe('Public tree endpoints', () => {
    it('GET /api/public/trees — browse public trees', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/public/trees')
        .expect(200);

      expect(res.body).toHaveProperty('trees');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
    });

    it('GET /api/public/trees/:id — view public tree', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/public/trees/${treeId}`)
        .expect(200);

      expect(res.body.id).toBe(treeId);
      expect(res.body.isPublic).toBe(true);
    });

    it('GET /api/public/trees/:id/graph — public graph', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/public/trees/${treeId}/graph`)
        .expect(200);

      expect(res.body).toHaveProperty('nodes');
      expect(res.body).toHaveProperty('edges');
    });

    it('GET /api/public/trees/:id/statistics — public statistics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/public/trees/${treeId}/statistics`)
        .expect(200);

      expect(res.body).toHaveProperty('totalMembers');
    });
  });

  // ─── 7. DELETE TREE ─────────────────────────────────────────

  describe('Delete tree', () => {
    it('DELETE /api/trees/:id — delete tree and all members', async () => {
      await request(app.getHttpServer())
        .delete(`/api/trees/${treeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Tree should be gone
      await request(app.getHttpServer())
        .get(`/api/trees/${treeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Mark as deleted so afterAll cleanup skips
      treeId = '';
    });
  });
});
