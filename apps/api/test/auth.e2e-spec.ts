import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(60000);

describe('Auth Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `e2e_test_${Date.now()}@digsan.test`,
    name: 'E2E Test User',
    password: 'TestPass123!',
  };

  let accessToken: string;
  let refreshToken: string;
  let verificationToken: string;

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
  }, 30000);

  afterAll(async () => {
    // Cleanup test user and related data
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
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

  // ─── 1. REGISTER ───────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...testUser, email: 'short@test.com', password: '12' })
        .expect(400);
    });
  });

  // ─── 2. LOGIN BEFORE VERIFICATION ──────────────────────────

  describe('POST /api/auth/login (before email verify)', () => {
    it('should reject login for unverified user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401);

      expect(res.body.message).toContain('verifikasi');
    });
  });

  // ─── 3. VERIFY EMAIL ───────────────────────────────────────

  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // Fetch the verification token directly from DB
      const token = await prisma.verificationToken.findFirst({
        where: {
          user: { email: testUser.email },
          type: 'EMAIL',
          used: false,
        },
      });

      expect(token).toBeTruthy();
      verificationToken = token!.token;

      const res = await request(app.getHttpServer())
        .get(`/api/auth/verify-email?token=${verificationToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
    });

    it('should reject already-used token', async () => {
      await request(app.getHttpServer())
        .get(`/api/auth/verify-email?token=${verificationToken}`)
        .expect(400);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/verify-email?token=invalid-token-xyz')
        .expect(400);
    });
  });

  // ─── 4. LOGIN AFTER VERIFICATION ───────────────────────────

  describe('POST /api/auth/login (after verify)', () => {
    it('should login successfully and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser.email);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword' })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'whatever' })
        .expect(401);
    });
  });

  // ─── 5. AUTHENTICATED ROUTES ───────────────────────────────

  describe('GET /api/users/me (authenticated)', () => {
    it('should return user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body.roles).toContain('user');
    });

    it('should reject without token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  // ─── 6. REFRESH TOKEN ──────────────────────────────────────

  describe('POST /api/auth/refresh-token', () => {
    it('should rotate and return new tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(refreshToken);

      // Update tokens for next tests
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject used (old) refresh token after rotation', async () => {
      // Login fresh to get a clean token pair
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      const freshRefresh = loginRes.body.refreshToken;

      // Rotate: use the fresh refresh token
      const rotateRes = await request(app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken: freshRefresh })
        .expect(201);

      // Save new tokens for subsequent tests
      accessToken = rotateRes.body.accessToken;
      refreshToken = rotateRes.body.refreshToken;

      // Now try to reuse the old (rotated-out) refresh token — should fail
      await request(app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken: freshRefresh })
        .expect(401);
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'garbage-token' })
        .expect(401);
    });
  });

  // ─── 7. FORGOT / RESET PASSWORD ────────────────────────────

  describe('Password reset flow', () => {
    let resetToken: string;

    it('POST /api/auth/forgot-password should accept request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(201);

      expect(res.body.message).toBeDefined();

      // Fetch token from DB
      const token = await prisma.verificationToken.findFirst({
        where: {
          user: { email: testUser.email },
          type: 'PASSWORD_RESET',
          used: false,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(token).toBeTruthy();
      resetToken = token!.token;
    });

    it('POST /api/auth/reset-password should reset password', async () => {
      const newPassword = 'NewPass456!';
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: newPassword })
        .expect(201);

      expect(res.body.message).toBeDefined();

      // Should be able to login with new password
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: newPassword })
        .expect(201);

      expect(loginRes.body.accessToken).toBeDefined();
      accessToken = loginRes.body.accessToken;
      refreshToken = loginRes.body.refreshToken;

      // Restore original password for remaining tests
      testUser.password = newPassword;
    });
  });

  // ─── 8. LOGOUT ─────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(201);

      // Refresh token should no longer work
      await request(app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);
    });
  });

  // ─── 9. HEALTH CHECK ───────────────────────────────────────

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
    });
  });
});
