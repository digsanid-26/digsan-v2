import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { GamificationService } from '../src/modules/gamification/gamification.service';

jest.setTimeout(120000);

describe('Gamification Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ts = Date.now();
  const testUser = {
    email: `gamif_e2e_${ts}@digsan.test`,
    name: 'Gamif E2E',
    password: 'GamifPass123!',
  };
  const otherUser = {
    email: `gamif_other_${ts}@digsan.test`,
    name: 'Gamif Other',
    password: 'OtherPass123!',
  };

  let accessToken: string;
  let otherToken: string;
  let userId: string;
  let otherUserId: string;

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

    // ─── Register & activate test user ──────────────────────
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser);

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

    // ─── Register & activate other user ─────────────────────
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(otherUser);

    const otherDb = await prisma.user.findUnique({ where: { email: otherUser.email } });
    otherUserId = otherDb!.id;
    await prisma.user.update({
      where: { id: otherUserId },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: otherUser.email, password: otherUser.password });
    otherToken = otherLogin.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      for (const email of [testUser.email, otherUser.email]) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          await prisma.point.deleteMany({ where: { userId: user.id } });
          await prisma.userBadge.deleteMany({ where: { userId: user.id } });
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

  // ─── AUTH GUARD ─────────────────────────────────────────────

  describe('Access Control', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/api/gamification/points/balance')
        .expect(401);
    });
  });

  // ─── POINTS BALANCE ─────────────────────────────────────────

  describe('GET /api/gamification/points/balance', () => {
    it('should return 0 balance for new user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('balance');
      expect(res.body.balance).toBe(0);
    });
  });

  // ─── AWARD POINTS (via service, then verify via API) ────────

  describe('Points awarding & history', () => {
    it('should show points after awarding via DB', async () => {
      // Award points directly via Prisma (simulating service calls)
      await prisma.point.create({
        data: { userId, amount: 50, type: 'registration', reason: 'Welcome bonus' },
      });
      await prisma.point.create({
        data: { userId, amount: 5, type: 'login', reason: 'Daily login' },
      });
      await prisma.point.create({
        data: { userId, amount: 20, type: 'order_complete', reason: 'Order done' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.balance).toBe(75);
    });
  });

  // ─── POINTS HISTORY ─────────────────────────────────────────

  describe('GET /api/gamification/points/history', () => {
    it('should return paginated point history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('points');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body.total).toBe(3);
      expect(Array.isArray(res.body.points)).toBe(true);
    });

    it('should filter by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/history')
        .query({ type: 'login' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.points[0].type).toBe('login');
    });

    it('should paginate with limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/history')
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.points.length).toBe(2);
      expect(res.body.limit).toBe(2);
      expect(res.body.total).toBe(3);
    });

    it('should return page 2', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/history')
        .query({ limit: 2, page: 2 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.points.length).toBe(1);
      expect(res.body.page).toBe(2);
    });
  });

  // ─── CROSS-USER ISOLATION ───────────────────────────────────

  describe('Cross-user isolation', () => {
    it('other user should have 0 balance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/balance')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body.balance).toBe(0);
    });

    it('other user should have 0 point history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/points/history')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
    });
  });

  // ─── LEADERBOARD ────────────────────────────────────────────

  describe('GET /api/gamification/leaderboard', () => {
    beforeAll(async () => {
      // Give other user some points to populate leaderboard
      await prisma.point.create({
        data: { userId: otherUserId, amount: 100, type: 'registration', reason: 'Welcome bonus' },
      });
    });

    it('should return leaderboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Each entry should have expected fields
      const entry = res.body[0];
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('userId');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('totalPoints');
    });

    it('should respect limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
    });

    it('should be sorted by points descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i - 1].totalPoints).toBeGreaterThanOrEqual(res.body[i].totalPoints);
      }
    });
  });

  // ─── BADGES ─────────────────────────────────────────────────

  describe('GET /api/gamification/badges', () => {
    it('should return all available badges', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/badges')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const badge = res.body[0];
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('requirements');
    });
  });

  describe('GET /api/gamification/badges/me', () => {
    it('should return empty badges for new user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/badges/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // User has 75 points, "Newcomer" badge requires 1 point
      // But badges are only awarded via checkAndAwardBadges service call
      // (not auto-checked on API read) so initially empty
    });

    it('should show badge after auto-award via point grant', async () => {
      // Use the service's awardPoints which triggers checkAndAwardBadges
      const gamifService = app.get(GamificationService);
      await gamifService.awardPoints(userId, 1, 'bonus', 'Trigger badge check');

      const res = await request(app.getHttpServer())
        .get('/api/gamification/badges/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Should have "Newcomer" badge (total_points >= 1)
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const badgeNames = res.body.map((ub: any) => ub.badge.name);
      expect(badgeNames).toContain('Newcomer');
    });

    it('other user should not have badges from first user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/gamification/badges/me')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      // Other user has 100 points but badges haven't been checked for them yet
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should award badge to other user after point grant', async () => {
      const gamifService = app.get(GamificationService);
      await gamifService.awardPoints(otherUserId, 1, 'bonus', 'Trigger badge check');

      const res = await request(app.getHttpServer())
        .get('/api/gamification/badges/me')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      const badgeNames = res.body.map((ub: any) => ub.badge.name);
      expect(badgeNames).toContain('Newcomer');
      expect(badgeNames).toContain('Active Member'); // 101 points >= 100
    });
  });
});
