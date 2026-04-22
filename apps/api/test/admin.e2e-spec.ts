import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(120000);

describe('Admin Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ts = Date.now();
  const adminUser = {
    email: `admin_e2e_${ts}@digsan.test`,
    name: 'Admin E2E',
    password: 'AdminPass123!',
  };
  const regularUser = {
    email: `regular_e2e_${ts}@digsan.test`,
    name: 'Regular E2E',
    password: 'RegularPass123!',
  };

  let adminToken: string;
  let regularToken: string;
  let regularUserId: string;

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

    // ─── Register & activate admin user ─────────────────────
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(adminUser);

    const adminDb = await prisma.user.findUnique({ where: { email: adminUser.email } });
    await prisma.user.update({
      where: { id: adminDb!.id },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    });

    // Assign admin role
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    await prisma.userRole.create({
      data: { userId: adminDb!.id, roleId: adminRole!.id },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });
    adminToken = adminLogin.body.accessToken;

    // ─── Register & activate regular user ───────────────────
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(regularUser);

    const regularDb = await prisma.user.findUnique({ where: { email: regularUser.email } });
    regularUserId = regularDb!.id;
    await prisma.user.update({
      where: { id: regularDb!.id },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    });

    const regularLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: regularUser.email, password: regularUser.password });
    regularToken = regularLogin.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      // Clean up app configs created by tests
      await prisma.appConfig.deleteMany({
        where: { key: { startsWith: 'e2e_test_' } },
      });

      // Clean up both test users
      for (const email of [adminUser.email, regularUser.email]) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
          await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
          await prisma.loginHistory.deleteMany({ where: { userId: user.id } });
          await prisma.notification.deleteMany({ where: { userId: user.id } });
          await prisma.userRole.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });
        }
      }
    }
    if (app) await app.close();
  }, 15000);

  // ─── ACCESS CONTROL ─────────────────────────────────────────

  describe('Access Control', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .expect(401);
    });

    it('should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should allow admin users', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ─── DASHBOARD ──────────────────────────────────────────────

  describe('GET /api/admin/dashboard', () => {
    it('should return dashboard stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('users');
      expect(res.body.users).toHaveProperty('total');
      expect(res.body.users).toHaveProperty('active');
      expect(res.body.users).toHaveProperty('pending');
      expect(res.body).toHaveProperty('trees');
      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('workers');
      expect(res.body).toHaveProperty('revenue');
    });
  });

  // ─── USER MANAGEMENT ───────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('should return paginated users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should filter by search', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .query({ search: 'Regular E2E' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.users[0].name).toContain('Regular E2E');
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      res.body.users.forEach((u: any) => {
        expect(u.status).toBe('ACTIVE');
      });
    });

    it('should paginate with limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.users.length).toBeLessThanOrEqual(1);
      expect(res.body.limit).toBe(1);
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should return user detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(regularUserId);
      expect(res.body.email).toBe(regularUser.email);
      expect(res.body).toHaveProperty('roles');
      expect(res.body).toHaveProperty('_count');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/admin/users/:id/status', () => {
    it('should update user status', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${regularUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      expect(res.body.status).toBe('SUSPENDED');
    });

    it('should restore user status', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${regularUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(res.body.status).toBe('ACTIVE');
    });
  });

  describe('POST /api/admin/users/:id/roles', () => {
    it('should assign worker role to user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/users/${regularUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'worker' })
        .expect(201);

      expect(res.body).toHaveProperty('message');
    });

    it('should reject duplicate role assignment', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/users/${regularUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'worker' })
        .expect(400);
    });

    it('should reject invalid role', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/users/${regularUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'nonexistent_role' })
        .expect(400);
    });
  });

  describe('DELETE /api/admin/users/:id/roles/:roleName', () => {
    it('should remove role from user', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/users/${regularUserId}/roles/worker`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');
    });

    it('should reject removing non-assigned role', async () => {
      await request(app.getHttpServer())
        .delete(`/api/admin/users/${regularUserId}/roles/worker`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ─── WORKER MANAGEMENT ─────────────────────────────────────

  describe('GET /api/admin/workers', () => {
    it('should return paginated workers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/workers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('workers');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(Array.isArray(res.body.workers)).toBe(true);
    });
  });

  // ─── ORDER MANAGEMENT ──────────────────────────────────────

  describe('GET /api/admin/orders', () => {
    it('should return paginated orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  // ─── SYSTEM SETTINGS ───────────────────────────────────────

  describe('GET /api/admin/settings', () => {
    it('should return all settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/settings')
        .query({ category: 'general' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      res.body.forEach((s: any) => {
        expect(s.category).toBe('general');
      });
    });
  });

  describe('PUT /api/admin/settings/:key', () => {
    it('should update a system setting', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/admin/settings/app_name')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Digsan E2E' })
        .expect(200);

      expect(res.body.value).toBe('Digsan E2E');
    });

    it('should restore setting value', async () => {
      await request(app.getHttpServer())
        .put('/api/admin/settings/app_name')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Digsan' })
        .expect(200);
    });

    it('should return 404 for non-existent setting', async () => {
      await request(app.getHttpServer())
        .put('/api/admin/settings/nonexistent_setting')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);
    });
  });

  // ─── APP CONFIG CRUD ────────────────────────────────────────

  describe('POST /api/admin/configs', () => {
    it('should create an app config', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: `e2e_test_config_${ts}`,
          value: 'test_value',
          type: 'string',
          category: 'test',
          description: 'E2E test config',
        })
        .expect(201);

      expect(res.body.key).toBe(`e2e_test_config_${ts}`);
      expect(res.body.value).toBe('test_value');
    });

    it('should reject duplicate key', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: `e2e_test_config_${ts}`,
          value: 'duplicate',
        })
        .expect(400);
    });
  });

  describe('GET /api/admin/configs', () => {
    it('should return all app configs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/configs')
        .query({ category: 'test' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      res.body.forEach((c: any) => {
        expect(c.category).toBe('test');
      });
    });
  });

  describe('PUT /api/admin/configs/:key', () => {
    it('should update an app config', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/configs/e2e_test_config_${ts}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'updated_value' })
        .expect(200);

      expect(res.body.value).toBe('updated_value');
    });

    it('should return 404 for non-existent config', async () => {
      await request(app.getHttpServer())
        .put('/api/admin/configs/nonexistent_config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'test' })
        .expect(404);
    });
  });

  describe('DELETE /api/admin/configs/:key', () => {
    it('should delete an app config', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/configs/e2e_test_config_${ts}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');
    });

    it('should return 404 for already deleted config', async () => {
      await request(app.getHttpServer())
        .delete(`/api/admin/configs/e2e_test_config_${ts}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
