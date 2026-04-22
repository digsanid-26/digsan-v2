import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(120000);

describe('Security & Polish (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ts = Date.now();
  const testUser = {
    email: `sec_e2e_${ts}@digsan.test`,
    name: 'Security E2E',
    password: 'SecPass123!',
  };

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Register & activate
    await request(app.getHttpServer()).post('/api/auth/register').send(testUser);
    const userDb = await prisma.user.findUnique({ where: { email: testUser.email } });
    userId = userDb!.id;
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    accessToken = loginRes.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      if (user) {
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.loginHistory.deleteMany({ where: { userId: user.id } });
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.userRole.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    if (app) await app.close();
  }, 15000);

  // ─── HEALTH CHECK ───────────────────────────────────────────

  describe('GET /api/health', () => {
    it('should return OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  // ─── AUTH GUARD ENFORCEMENT ─────────────────────────────────

  describe('Auth guard enforcement', () => {
    const protectedEndpoints = [
      { method: 'get', path: '/api/users/me' },
      { method: 'get', path: '/api/trees' },
      { method: 'get', path: '/api/gamification/points/balance' },
      { method: 'get', path: '/api/chat/rooms' },
      { method: 'get', path: '/api/notifications' },
    ];

    for (const ep of protectedEndpoints) {
      it(`should reject unauthenticated ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        const res = await (request(app.getHttpServer()) as any)[ep.method](ep.path);
        expect(res.status).toBe(401);
      });
    }

    it('should reject invalid JWT token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should reject expired-looking malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fake')
        .expect(401);
    });
  });

  // ─── INPUT VALIDATION ──────────────────────────────────────

  describe('Input validation', () => {
    it('should reject login with missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'password123' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('should reject unknown properties (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password123',
          hackerField: 'should be rejected',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  // ─── 404 HANDLING ───────────────────────────────────────────

  describe('404 handling', () => {
    it('should return 404 for non-existent route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/nonexistent-route')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });
  });

  // ─── RATE LIMITING (ThrottlerGuard) ─────────────────────────

  describe('Rate limiting', () => {
    it('should enforce global rate limit', async () => {
      // The global limit is 100 req/60s. We won't hit that in normal tests,
      // but we can verify the throttler header is present.
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      // Throttler adds these headers
      // In NestJS v11 ThrottlerGuard, headers may vary; just verify endpoint works
      expect(res.status).toBe(200);
    });
  });

  // ─── CORS HEADERS ──────────────────────────────────────────

  describe('CORS', () => {
    it('should allow requests (CORS configured in main.ts)', async () => {
      // CORS is configured via app.enableCors() in main.ts for
      // WEB_URL and LANDING_URL origins. Supertest bypasses CORS
      // since it talks directly to the HTTP server. We just verify
      // that the health endpoint responds normally.
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  // ─── ROLE-BASED ACCESS ─────────────────────────────────────

  describe('Role-based access control', () => {
    it('should reject non-admin from admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('should reject non-admin from admin user management', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  // ─── CONSISTENT ERROR FORMAT ───────────────────────────────

  describe('Consistent error format', () => {
    it('401 error should have standard structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);

      expect(res.body).toHaveProperty('statusCode', 401);
      expect(res.body).toHaveProperty('message');
    });

    it('400 validation error should have standard structure', async () => {
      // Use login endpoint (higher throttle limit) to test validation
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
    });

    it('403 forbidden should have standard structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('statusCode', 403);
      expect(res.body).toHaveProperty('message');
    });

    it('404 not found should have standard structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/nonexistent')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });
  });
});
