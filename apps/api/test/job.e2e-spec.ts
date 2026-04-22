import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(60000);

describe('Job Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test users
  const customerUser = {
    email: `job_customer_${Date.now()}@digsan.test`,
    name: 'Job Customer',
    password: 'TestPass123!',
  };
  const workerUser = {
    email: `job_worker_${Date.now()}@digsan.test`,
    name: 'Job Worker',
    password: 'TestPass123!',
  };

  let customerToken: string;
  let workerToken: string;
  let customerId: string;
  let workerId: string;

  // Seed data IDs
  let categoryId: string;
  let subCategoryId: string;
  let serviceId: string;
  let serviceSlug: string;
  let addressId: string;
  let workerProfileId: string;
  let orderId: string;
  let orderNumber: string;
  let paymentId: string;
  let skillId: string;

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

    // ─── Seed: category → subcategory → service ───
    const cat = await prisma.jobCategory.create({
      data: {
        name: 'Test Category',
        slug: `test-cat-${Date.now()}`,
        description: 'E2E test category',
        order: 99,
      },
    });
    categoryId = cat.id;

    const sub = await prisma.jobSubCategory.create({
      data: {
        categoryId: cat.id,
        name: 'Test SubCategory',
        slug: `test-sub-${Date.now()}`,
        description: 'E2E test subcategory',
        order: 1,
      },
    });
    subCategoryId = sub.id;

    const svc = await prisma.jobService.create({
      data: {
        subCategoryId: sub.id,
        name: 'Test Service',
        slug: `test-svc-${Date.now()}`,
        description: 'E2E test service',
        basePrice: 100000,
        priceUnit: 'per jam',
        duration: 2,
        order: 1,
      },
    });
    serviceId = svc.id;
    serviceSlug = svc.slug;

    // ─── Register + verify + login both users ───
    for (const u of [customerUser, workerUser]) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(u);

      const user = await prisma.user.findUnique({ where: { email: u.email } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: 'ACTIVE', emailVerified: new Date() },
      });

      if (u === customerUser) customerId = user!.id;
      else workerId = user!.id;
    }

    // Login customer
    const custLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerUser.email, password: customerUser.password });
    customerToken = custLogin.body.accessToken;

    // Login worker
    const wrkLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: workerUser.email, password: workerUser.password });
    workerToken = wrkLogin.body.accessToken;

    // Create address for customer
    const addr = await prisma.address.create({
      data: {
        userId: customerId,
        label: 'Rumah',
        fullAddress: 'Jl. Test No. 1, Jakarta',
        city: 'Jakarta',
        province: 'DKI Jakarta',
      },
    });
    addressId = addr.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      // Clean up in dependency order
      await prisma.jobReview.deleteMany({ where: { order: { customerId } } }).catch(() => {});
      await prisma.jobPayment.deleteMany({ where: { order: { customerId } } }).catch(() => {});
      await prisma.jobOrderImage.deleteMany({ where: { order: { customerId } } }).catch(() => {});
      await prisma.jobOrder.deleteMany({ where: { customerId } }).catch(() => {});

      // Clean worker data
      await prisma.jobServiceArea.deleteMany({ where: { profile: { userId: workerId } } }).catch(() => {});
      await prisma.jobWorkSchedule.deleteMany({ where: { profile: { userId: workerId } } }).catch(() => {});
      await prisma.jobWorkerSkill.deleteMany({ where: { profile: { userId: workerId } } }).catch(() => {});
      await prisma.jobWorkerProfile.deleteMany({ where: { userId: workerId } }).catch(() => {});

      await prisma.address.deleteMany({ where: { userId: customerId } }).catch(() => {});

      // Clean catalog
      await prisma.jobService.deleteMany({ where: { subCategoryId } }).catch(() => {});
      await prisma.jobSubCategory.deleteMany({ where: { categoryId } }).catch(() => {});
      await prisma.jobCategory.delete({ where: { id: categoryId } }).catch(() => {});

      // Clean users
      for (const email of [customerUser.email, workerUser.email]) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } }).catch(() => {});
          await prisma.verificationToken.deleteMany({ where: { userId: user.id } }).catch(() => {});
          await prisma.loginHistory.deleteMany({ where: { userId: user.id } }).catch(() => {});
          await prisma.userRole.deleteMany({ where: { userId: user.id } }).catch(() => {});
          await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    }
    if (app) await app.close();
  }, 30000);

  // ═══════════════════════════════════════════════════════════
  // CATALOG
  // ═══════════════════════════════════════════════════════════

  describe('Catalog', () => {
    it('GET /api/jobs/catalog/categories — should list categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/catalog/categories')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/jobs/catalog/categories/:slug — should get category by slug', async () => {
      const cat = await prisma.jobCategory.findUnique({ where: { id: categoryId } });
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/catalog/categories/${cat!.slug}`)
        .expect(200);

      expect(res.body.id).toBe(categoryId);
      expect(res.body.subCategories).toBeDefined();
    });

    it('GET /api/jobs/catalog/categories/:slug — 404 for unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/catalog/categories/non-existent-slug')
        .expect(404);
    });

    it('GET /api/jobs/catalog/services — should list services', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/catalog/services')
        .expect(200);

      expect(res.body.services).toBeDefined();
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/jobs/catalog/services?categoryId=X — should filter by category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/catalog/services?categoryId=${categoryId}`)
        .expect(200);

      expect(res.body.services).toBeDefined();
    });

    it('GET /api/jobs/catalog/services/:slug — should get service by slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/catalog/services/${serviceSlug}`)
        .expect(200);

      expect(res.body.id).toBe(serviceId);
      expect(res.body.subCategory).toBeDefined();
    });

    it('GET /api/jobs/catalog/services/:slug — 404 for unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/catalog/services/non-existent-slug')
        .expect(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // WORKER
  // ═══════════════════════════════════════════════════════════

  describe('Worker', () => {
    it('POST /api/jobs/workers/register — should register as worker', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/workers/register')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          gender: 'male',
          age: 30,
          whatsappNumber: '081234567890',
          bio: 'Tukang berpengalaman 10 tahun',
          location: 'Jakarta Selatan',
          skills: [
            {
              subCategoryId,
              pricingType: 'PER_JAM',
              rate: 100000,
              canProvideEquipment: true,
              equipmentList: 'Alat standar',
            },
          ],
          workSchedules: [
            { dayOfWeek: 'Monday', startTime: '08:00', endTime: '17:00' },
            { dayOfWeek: 'Tuesday', startTime: '08:00', endTime: '17:00' },
          ],
          serviceAreas: [
            { areaName: 'Jakarta Selatan' },
            { areaName: 'Jakarta Pusat' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.skills).toHaveLength(1);
      expect(res.body.workSchedules).toHaveLength(2);
      expect(res.body.serviceAreas).toHaveLength(2);
      workerProfileId = res.body.id;
      skillId = res.body.skills[0].id;
    });

    it('POST /api/jobs/workers/register — should reject duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/workers/register')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ skills: [{ subCategoryId, pricingType: 'PER_JAM', rate: 50000 }] })
        .expect(409);
    });

    it('POST /api/jobs/workers/register — should require auth', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/workers/register')
        .send({ skills: [] })
        .expect(401);
    });

    it('GET /api/jobs/workers/me — should get own worker profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.id).toBe(workerProfileId);
      expect(res.body.skills).toBeDefined();
    });

    it('GET /api/jobs/workers/me — 404 for non-worker user', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/workers/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });

    it('PUT /api/jobs/workers/me — should update profile', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/jobs/workers/me')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ bio: 'Updated bio', age: 31 })
        .expect(200);

      expect(res.body.bio).toBe('Updated bio');
      expect(res.body.age).toBe(31);
    });

    it('GET /api/jobs/workers/profile/:id — should get profile by ID (public)', async () => {
      // First approve the worker so search can find them
      await prisma.jobWorkerProfile.update({
        where: { userId: workerId },
        data: { providerStatus: 'APPROVED' },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/jobs/workers/profile/${workerProfileId}`)
        .expect(200);

      expect(res.body.id).toBe(workerProfileId);
      expect(res.body.user).toBeDefined();
    });

    it('GET /api/jobs/workers/profile/:id — 404 for unknown ID', async () => {
      await request(app.getHttpServer())
        .get('/api/jobs/workers/profile/non-existent-id')
        .expect(404);
    });

    it('POST /api/jobs/workers/me/skills — should add a skill', async () => {
      // Create another subcategory for the new skill
      const sub2 = await prisma.jobSubCategory.create({
        data: {
          categoryId,
          name: 'Test SubCat 2',
          slug: `test-sub2-${Date.now()}`,
          order: 2,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/jobs/workers/me/skills')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          subCategoryId: sub2.id,
          pricingType: 'PER_PROJECT',
          rate: 500000,
        })
        .expect(201);

      expect(res.body.subCategoryId).toBe(sub2.id);
    });

    it('POST /api/jobs/workers/me/skills — should reject duplicate skill', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/workers/me/skills')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          subCategoryId,
          pricingType: 'PER_JAM',
          rate: 120000,
        })
        .expect(409);
    });

    it('DELETE /api/jobs/workers/me/skills/:id — should remove a skill', async () => {
      // Get skills to find one to delete (not the main one)
      const profile = await prisma.jobWorkerProfile.findUnique({
        where: { userId: workerId },
        include: { skills: true },
      });
      const extraSkill = profile!.skills.find((s) => s.subCategoryId !== subCategoryId);

      if (extraSkill) {
        await request(app.getHttpServer())
          .delete(`/api/jobs/workers/me/skills/${extraSkill.id}`)
          .set('Authorization', `Bearer ${workerToken}`)
          .expect(200);
      }
    });

    it('PUT /api/jobs/workers/me/schedule — should replace schedule', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/jobs/workers/me/schedule')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          schedules: [
            { dayOfWeek: 'Monday', startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 'Friday', startTime: '09:00', endTime: '18:00' },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);
    });

    it('PUT /api/jobs/workers/me/areas — should replace service areas', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/jobs/workers/me/areas')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          areas: [
            { areaName: 'Jakarta Barat' },
            { areaName: 'Tangerang' },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('GET /api/jobs/workers — should search workers (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/workers')
        .expect(200);

      expect(res.body.workers).toBeDefined();
      expect(res.body.total).toBeDefined();
    });

    it('GET /api/jobs/workers?subCategoryId=X — should filter by skill', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/workers?subCategoryId=${subCategoryId}`)
        .expect(200);

      expect(res.body.workers.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════

  describe('Orders', () => {
    it('POST /api/jobs/orders — should create order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          addressId,
          description: 'Perbaikan keran bocor di dapur',
          scheduledDate: '2026-06-15',
          scheduledTime: '09:00',
          duration: 2,
          providerId: workerId,
          customerNotes: 'Bawa peralatan sendiri',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.orderNumber).toMatch(/^ORD-/);
      expect(res.body.status).toBe('WAITING_WORKER');
      expect(res.body.totalPrice).toBeDefined();
      expect(Number(res.body.basePrice)).toBeGreaterThan(0);
      expect(Number(res.body.serviceFee)).toBeGreaterThan(0);
      orderId = res.body.id;
      orderNumber = res.body.orderNumber;
    });

    it('POST /api/jobs/orders — should create order without provider (PENDING)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          addressId,
          description: 'Another test order',
          scheduledDate: '2026-06-20',
          scheduledTime: '10:00',
          duration: 3,
        })
        .expect(201);

      expect(res.body.status).toBe('PENDING');
    });

    it('POST /api/jobs/orders — should require auth', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .send({
          serviceId,
          addressId,
          description: 'test',
          scheduledDate: '2026-06-15',
          scheduledTime: '09:00',
          duration: 1,
        })
        .expect(401);
    });

    it('POST /api/jobs/orders — should reject invalid service ID', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: 'non-existent-id',
          addressId,
          description: 'test',
          scheduledDate: '2026-06-15',
          scheduledTime: '09:00',
          duration: 1,
        })
        .expect(404);
    });

    it('GET /api/jobs/orders — should list customer orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/orders?role=customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/jobs/orders — should list provider orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/jobs/orders?role=provider')
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.orders).toBeDefined();
    });

    it('GET /api/jobs/orders/:id — should get order detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.id).toBe(orderId);
      expect(res.body.service).toBeDefined();
      expect(res.body.address).toBeDefined();
    });

    it('GET /api/jobs/orders/:id — 403 for unauthorized user', async () => {
      // Create a third user to test 403
      const thirdEmail = `job_third_${Date.now()}@digsan.test`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: thirdEmail, name: 'Third User', password: 'TestPass123!' });

      const thirdUser = await prisma.user.findUnique({ where: { email: thirdEmail } });
      if (thirdUser) {
        await prisma.user.update({ where: { id: thirdUser.id }, data: { status: 'ACTIVE', emailVerified: new Date() } });
        const login = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: thirdEmail, password: 'TestPass123!' });

        await request(app.getHttpServer())
          .get(`/api/jobs/orders/${orderId}`)
          .set('Authorization', `Bearer ${login.body.accessToken}`)
          .expect(403);

        // Cleanup third user
        await prisma.refreshToken.deleteMany({ where: { userId: thirdUser.id } }).catch(() => {});
        await prisma.loginHistory.deleteMany({ where: { userId: thirdUser.id } }).catch(() => {});
        await prisma.verificationToken.deleteMany({ where: { userId: thirdUser.id } }).catch(() => {});
        await prisma.userRole.deleteMany({ where: { userId: thirdUser.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: thirdUser.id } }).catch(() => {});
      }
    });

    it('GET /api/jobs/orders/by-number/:orderNumber — should find by order number', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/orders/by-number/${orderNumber}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.orderNumber).toBe(orderNumber);
    });

    // ─── STATUS FLOW ──────────────────────────────────────────

    it('PUT /api/jobs/orders/:id/status — provider confirms order', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/jobs/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ action: 'CONFIRM', notes: 'Siap datang' })
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });

    it('PUT /api/jobs/orders/:id/status — customer cannot confirm', async () => {
      // Create another order for this test
      const o = await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          addressId,
          description: 'Status test order',
          scheduledDate: '2026-07-01',
          scheduledTime: '10:00',
          duration: 1,
          providerId: workerId,
        });

      await request(app.getHttpServer())
        .put(`/api/jobs/orders/${o.body.id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ action: 'CONFIRM' })
        .expect(403);

      // Clean up
      await prisma.jobOrder.delete({ where: { id: o.body.id } }).catch(() => {});
    });

    it('PUT /api/jobs/orders/:id/status — provider starts work', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/jobs/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ action: 'START', actualStartTime: '09:15' })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.actualStartTime).toBe('09:15');
    });

    it('PUT /api/jobs/orders/:id/status — provider completes work', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/jobs/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ action: 'COMPLETE', actualEndTime: '11:00', notes: 'Selesai' })
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.actualDuration).toBeDefined();
    });

    it('PUT /api/jobs/orders/:id/status — cancel order', async () => {
      // Create a new cancellable order
      const o = await request(app.getHttpServer())
        .post('/api/jobs/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          addressId,
          description: 'Cancel test',
          scheduledDate: '2026-07-15',
          scheduledTime: '14:00',
          duration: 1,
        });

      const res = await request(app.getHttpServer())
        .put(`/api/jobs/orders/${o.body.id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ action: 'CANCEL', reason: 'Berubah pikiran' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PAYMENT
  // ═══════════════════════════════════════════════════════════

  describe('Payment', () => {
    it('POST /api/jobs/payments — should create payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId, method: 'BANK_TRANSFER' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
      expect(Number(res.body.amount)).toBeGreaterThan(0);
      paymentId = res.body.id;
    });

    it('POST /api/jobs/payments — should reject duplicate payment', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId, method: 'BANK_TRANSFER' })
        .expect(400);
    });

    it('GET /api/jobs/payments/order/:orderId — should get payment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/payments/order/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.id).toBe(paymentId);
    });

    it('PUT /api/jobs/payments/:id/proof — should upload payment proof', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/jobs/payments/${paymentId}/proof`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ proofImage: 'https://example.com/proof.jpg' })
        .expect(200);

      expect(res.body.status).toBe('CONFIRMING');
      expect(res.body.proofImage).toBe('https://example.com/proof.jpg');
    });

    it('PUT /api/jobs/payments/:id/confirm — admin confirms payment', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/jobs/payments/${paymentId}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.message).toContain('dikonfirmasi');
    });

    it('POST /api/jobs/payments/webhook — should handle payment webhook', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/payments/webhook')
        .send({
          transactionId: 'non-existent-tx',
          transactionStatus: 'settlement',
        })
        .expect(201);

      expect(res.body.message).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // REVIEW
  // ═══════════════════════════════════════════════════════════

  describe('Review', () => {
    it('POST /api/jobs/reviews — should create review for completed order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/jobs/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId, rating: 5, comment: 'Sangat memuaskan!' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.rating).toBe(5);
      expect(res.body.comment).toBe('Sangat memuaskan!');
    });

    it('POST /api/jobs/reviews — should reject duplicate review', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId, rating: 4 })
        .expect(409);
    });

    it('POST /api/jobs/reviews — should require auth', async () => {
      await request(app.getHttpServer())
        .post('/api/jobs/reviews')
        .send({ orderId, rating: 5 })
        .expect(401);
    });

    it('GET /api/jobs/reviews/provider/:providerId — should list provider reviews', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/reviews/provider/${workerId}`)
        .expect(200);

      expect(res.body.reviews).toBeDefined();
      expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/jobs/reviews/order/:orderId — should get review for order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/jobs/reviews/order/${orderId}`)
        .expect(200);

      expect(res.body.rating).toBe(5);
    });

    it('GET /api/jobs/reviews/order/:orderId — 404 for order without review', async () => {
      // Create a completed order without review
      const o = await prisma.jobOrder.create({
        data: {
          orderNumber: `ORD-TEST-${Date.now()}`,
          customerId,
          serviceId,
          addressId,
          description: 'No review order',
          scheduledDate: new Date('2026-08-01'),
          scheduledTime: '10:00',
          duration: 1,
          basePrice: 100000,
          serviceFee: 10000,
          totalPrice: 110000,
          status: 'COMPLETED',
        },
      });

      await request(app.getHttpServer())
        .get(`/api/jobs/reviews/order/${o.id}`)
        .expect(404);

      // Cleanup
      await prisma.jobOrder.delete({ where: { id: o.id } }).catch(() => {});
    });

    it('Worker rating should be updated after review', async () => {
      const profile = await prisma.jobWorkerProfile.findUnique({
        where: { userId: workerId },
      });

      expect(profile).toBeDefined();
      expect(Number(profile!.rating)).toBeGreaterThan(0);
      expect(profile!.totalReviews).toBeGreaterThanOrEqual(1);
    });
  });
});
