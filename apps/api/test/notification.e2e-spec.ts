import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { NotificationType } from '@prisma/client';

jest.setTimeout(60000);

describe('Notification Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `notif_test_${Date.now()}@digsan.test`,
    name: 'Notif Test User',
    password: 'TestPass123!',
  };

  let accessToken: string;
  let userId: string;
  let notificationIds: string[] = [];

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

    // Register + verify + login
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    userId = user!.id;

    // Force-verify email and activate
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', emailVerified: new Date() },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(201);

    accessToken = loginRes.body.accessToken;

    // Seed some notifications for tests
    const types: NotificationType[] = [
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'PAYMENT_SUCCESS',
      'ORDER_COMPLETED',
      'REVIEW_RECEIVED',
    ];

    for (let i = 0; i < types.length; i++) {
      const notif = await prisma.notification.create({
        data: {
          userId,
          type: types[i],
          title: `Test Notification ${i + 1}`,
          message: `Message for notification ${i + 1}`,
          data: { index: i },
        },
      });
      notificationIds.push(notif.id);
    }
  }, 30000);

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.deviceToken.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.verificationToken.deleteMany({ where: { userId } });
      await prisma.loginHistory.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (app) await app.close();
  }, 15000);

  // ─── 1. LIST NOTIFICATIONS (paginated) ─────────────────────

  describe('GET /api/notifications', () => {
    it('should return paginated notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('notifications');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body.notifications.length).toBe(5);
      expect(res.body.total).toBe(5);
    });

    it('should paginate with limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.notifications.length).toBe(2);
      expect(res.body.total).toBe(5);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('should return page 2', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?page=2&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.notifications.length).toBe(2);
      expect(res.body.page).toBe(2);
    });

    it('should filter by isRead=false', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?isRead=false')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.notifications.length).toBe(5);
      // All should be unread initially
      res.body.notifications.forEach((n: any) => {
        expect(n.isRead).toBe(false);
      });
    });

    it('should filter by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?type=ORDER_CREATED')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.notifications.length).toBe(1);
      expect(res.body.notifications[0].type).toBe('ORDER_CREATED');
    });

    it('should reject without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications')
        .expect(401);
    });
  });

  // ─── 2. UNREAD COUNT ──────────────────────────────────────

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('unreadCount');
      expect(res.body.unreadCount).toBe(5);
    });
  });

  // ─── 3. MARK AS READ ─────────────────────────────────────

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/notifications/${notificationIds[0]}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.isRead).toBe(true);
      expect(res.body.readAt).toBeTruthy();
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .put('/api/notifications/nonexistent-id/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('unread count should decrease after marking as read', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.unreadCount).toBe(4);
    });
  });

  // ─── 4. MARK ALL AS READ ─────────────────────────────────

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.message).toContain('4');
    });

    it('unread count should be 0', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.unreadCount).toBe(0);
    });

    it('filter isRead=true should return all 5', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?isRead=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.notifications.length).toBe(5);
    });
  });

  // ─── 5. DELETE NOTIFICATION ───────────────────────────────

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationIds[4]}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.message).toContain('dihapus');
    });

    it('total should decrease after delete', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.total).toBe(4);
    });

    it('should return 404 for already deleted notification', async () => {
      await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationIds[4]}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── 6. DEVICE TOKEN MANAGEMENT ──────────────────────────

  describe('POST /api/notifications/device-token', () => {
    const testToken = `fcm_test_token_${Date.now()}`;

    it('should register a device token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: testToken, platform: 'android' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.token).toBe(testToken);
      expect(res.body.platform).toBe('android');
      expect(res.body.isActive).toBe(true);
    });

    it('should update existing token on re-register', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: testToken, platform: 'ios' })
        .expect(201);

      expect(res.body.token).toBe(testToken);
      expect(res.body.platform).toBe('ios');
    });

    it('should deactivate a device token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/notifications/device-token/${testToken}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.message).toContain('dihapus');

      // Verify token is inactive
      const dt = await prisma.deviceToken.findFirst({ where: { token: testToken } });
      expect(dt!.isActive).toBe(false);
    });
  });

  // ─── 7. CROSS-USER ISOLATION ──────────────────────────────

  describe('Cross-user isolation', () => {
    const otherUser = {
      email: `notif_other_${Date.now()}@digsan.test`,
      name: 'Notif Other User',
      password: 'TestPass123!',
    };
    let otherToken: string;
    let otherUserId: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(otherUser)
        .expect(201);

      const user = await prisma.user.findUnique({ where: { email: otherUser.email } });
      otherUserId = user!.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { status: 'ACTIVE', emailVerified: new Date() },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: otherUser.email, password: otherUser.password })
        .expect(201);

      otherToken = loginRes.body.accessToken;
    });

    afterAll(async () => {
      if (otherUserId) {
        await prisma.notification.deleteMany({ where: { userId: otherUserId } });
        await prisma.deviceToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.refreshToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.verificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.loginHistory.deleteMany({ where: { userId: otherUserId } });
        await prisma.userRole.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
      }
    });

    it('other user should see 0 notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
    });

    it('other user should not be able to mark first user notification as read', async () => {
      await request(app.getHttpServer())
        .put(`/api/notifications/${notificationIds[1]}/read`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('other user should not be able to delete first user notification', async () => {
      await request(app.getHttpServer())
        .delete(`/api/notifications/${notificationIds[1]}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
