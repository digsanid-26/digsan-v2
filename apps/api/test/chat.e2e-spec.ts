import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';

jest.setTimeout(120000);

describe('Chat Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ts = Date.now();
  const userA = {
    email: `chat_a_${ts}@digsan.test`,
    name: 'Chat User A',
    password: 'ChatPassA123!',
  };
  const userB = {
    email: `chat_b_${ts}@digsan.test`,
    name: 'Chat User B',
    password: 'ChatPassB123!',
  };
  const userC = {
    email: `chat_c_${ts}@digsan.test`,
    name: 'Chat User C',
    password: 'ChatPassC123!',
  };

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;

  let directRoomId: string;
  let groupRoomId: string;
  let messageId: string;

  async function registerAndActivate(userData: { email: string; name: string; password: string }) {
    await request(app.getHttpServer()).post('/api/auth/register').send(userData);
    const userDb = await prisma.user.findUnique({ where: { email: userData.email } });
    await prisma.user.update({
      where: { id: userDb!.id },
      data: { emailVerified: new Date(), status: 'ACTIVE' },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userData.email, password: userData.password });
    return { id: userDb!.id, token: loginRes.body.accessToken };
  }

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

    const a = await registerAndActivate(userA);
    tokenA = a.token; userAId = a.id;

    const b = await registerAndActivate(userB);
    tokenB = b.token; userBId = b.id;

    const c = await registerAndActivate(userC);
    tokenC = c.token; userCId = c.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      // Clean up chat data first, then users
      for (const email of [userA.email, userB.email, userC.email]) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          await prisma.chatMessage.deleteMany({ where: { senderId: user.id } });
          await prisma.chatMember.deleteMany({ where: { userId: user.id } });
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
          await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
          await prisma.loginHistory.deleteMany({ where: { userId: user.id } });
          await prisma.notification.deleteMany({ where: { userId: user.id } });
          await prisma.userRole.deleteMany({ where: { userId: user.id } });
        }
      }
      // Delete orphan rooms (no members left)
      const orphanRooms = await prisma.chatRoom.findMany({
        where: { members: { none: {} } },
      });
      for (const room of orphanRooms) {
        await prisma.chatMessage.deleteMany({ where: { roomId: room.id } });
        await prisma.chatRoom.delete({ where: { id: room.id } });
      }
      // Also delete rooms that still have our test members
      if (directRoomId) {
        await prisma.chatMessage.deleteMany({ where: { roomId: directRoomId } }).catch(() => {});
        await prisma.chatMember.deleteMany({ where: { roomId: directRoomId } }).catch(() => {});
        await prisma.chatRoom.delete({ where: { id: directRoomId } }).catch(() => {});
      }
      if (groupRoomId) {
        await prisma.chatMessage.deleteMany({ where: { roomId: groupRoomId } }).catch(() => {});
        await prisma.chatMember.deleteMany({ where: { roomId: groupRoomId } }).catch(() => {});
        await prisma.chatRoom.delete({ where: { id: groupRoomId } }).catch(() => {});
      }
      for (const email of [userA.email, userB.email, userC.email]) {
        await prisma.user.deleteMany({ where: { email } });
      }
    }
    if (app) await app.close();
  }, 15000);

  // ─── ACCESS CONTROL ─────────────────────────────────────────

  describe('Access Control', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/chat/rooms').expect(401);
    });
  });

  // ─── DIRECT ROOMS ──────────────────────────────────────────

  describe('POST /api/chat/rooms/direct', () => {
    it('should create a direct room between two users', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat/rooms/direct')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: userBId })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe('DIRECT');
      expect(res.body.members).toHaveLength(2);
      directRoomId = res.body.id;
    });

    it('should return same room on duplicate direct request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat/rooms/direct')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: userBId })
        .expect(201);

      expect(res.body.id).toBe(directRoomId);
    });

    it('should return same room when other user creates direct', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat/rooms/direct')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userAId })
        .expect(201);

      expect(res.body.id).toBe(directRoomId);
    });

    it('should reject self-chat', async () => {
      await request(app.getHttpServer())
        .post('/api/chat/rooms/direct')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: userAId })
        .expect(400);
    });

    it('should reject invalid target user', async () => {
      await request(app.getHttpServer())
        .post('/api/chat/rooms/direct')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: 'nonexistent_id' })
        .expect(404);
    });
  });

  // ─── GROUP ROOMS ────────────────────────────────────────────

  describe('POST /api/chat/rooms/group', () => {
    it('should create a group room', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat/rooms/group')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Test Group', memberIds: [userBId, userCId] })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe('GROUP');
      expect(res.body.name).toBe('Test Group');
      expect(res.body.members).toHaveLength(3); // A + B + C
      groupRoomId = res.body.id;
    });

    it('should auto-include creator in members', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat/rooms/group')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Auto Include Test', memberIds: [userBId] })
        .expect(201);

      const memberIds = res.body.members.map((m: any) => m.userId);
      expect(memberIds).toContain(userAId);
      expect(memberIds).toContain(userBId);

      // Cleanup this extra room
      await prisma.chatMember.deleteMany({ where: { roomId: res.body.id } });
      await prisma.chatRoom.delete({ where: { id: res.body.id } });
    });
  });

  // ─── GET ROOMS ──────────────────────────────────────────────

  describe('GET /api/chat/rooms', () => {
    it('should return rooms for user A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2); // direct + group
      const roomIds = res.body.map((r: any) => r.id);
      expect(roomIds).toContain(directRoomId);
      expect(roomIds).toContain(groupRoomId);
    });

    it('user C should not see direct room of A-B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(200);

      const roomIds = res.body.map((r: any) => r.id);
      expect(roomIds).not.toContain(directRoomId);
      expect(roomIds).toContain(groupRoomId);
    });
  });

  // ─── GET ROOM BY ID ────────────────────────────────────────

  describe('GET /api/chat/rooms/:roomId', () => {
    it('should return room details for member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.id).toBe(directRoomId);
      expect(res.body.members).toHaveLength(2);
    });

    it('should return 404 for non-member', async () => {
      await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(404);
    });
  });

  // ─── SEND MESSAGES ─────────────────────────────────────────

  describe('POST /api/chat/rooms/:roomId/messages', () => {
    it('should send a message', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Halo dari User A!' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('Halo dari User A!');
      expect(res.body.senderId).toBe(userAId);
      expect(res.body.type).toBe('TEXT');
      messageId = res.body.id;
    });

    it('should send message from other member', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Halo balik dari B!' })
        .expect(201);

      expect(res.body.senderId).toBe(userBId);
    });

    it('should reject message from non-member', async () => {
      await request(app.getHttpServer())
        .post(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ content: 'Intruder!' })
        .expect(403);
    });

    it('should support image type', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/chat/rooms/${groupRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'image.jpg', type: 'IMAGE', metadata: { url: 'https://example.com/img.jpg' } })
        .expect(201);

      expect(res.body.type).toBe('IMAGE');
      expect(res.body.metadata).toBeDefined();
    });
  });

  // ─── GET MESSAGES ───────────────────────────────────────────

  describe('GET /api/chat/rooms/:roomId/messages', () => {
    it('should return messages in room', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body.total).toBe(2);
      expect(res.body.messages).toHaveLength(2);
    });

    it('should paginate messages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}/messages`)
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.messages).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it('should reject non-member', async () => {
      await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(403);
    });
  });

  // ─── READ RECEIPTS ─────────────────────────────────────────

  describe('POST /api/chat/rooms/:roomId/read', () => {
    it('should mark messages as read', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/chat/rooms/${directRoomId}/read`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body).toHaveProperty('lastRead');
      expect(res.body.lastRead).not.toBeNull();
    });

    it('should reflect in unread count', async () => {
      // A has read all, so unread = 0 for A
      const res = await request(app.getHttpServer())
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const directRoom = res.body.find((r: any) => r.id === directRoomId);
      expect(directRoom.unreadCount).toBe(0);
    });

    it('should show unread for user who has not read', async () => {
      // B has not marked read, A sent 1 message → B has 1 unread
      const res = await request(app.getHttpServer())
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const directRoom = res.body.find((r: any) => r.id === directRoomId);
      expect(directRoom.unreadCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── DELETE MESSAGE ─────────────────────────────────────────

  describe('DELETE /api/chat/messages/:messageId', () => {
    it('should reject deletion by non-sender', async () => {
      await request(app.getHttpServer())
        .delete(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('should soft delete message by sender', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.deletedAt).not.toBeNull();
    });

    it('deleted message should not appear in history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/chat/rooms/${directRoomId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Was 2, one deleted → 1 remaining
      expect(res.body.total).toBe(1);
    });
  });

  // ─── GROUP MEMBER MANAGEMENT ────────────────────────────────

  describe('Group member management', () => {
    it('should reject add member by non-admin', async () => {
      // userB is member, not admin
      await request(app.getHttpServer())
        .post(`/api/chat/rooms/${groupRoomId}/members`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ userId: userCId })
        .expect(403);
    });

    it('should reject adding existing member', async () => {
      await request(app.getHttpServer())
        .post(`/api/chat/rooms/${groupRoomId}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userBId })
        .expect(400);
    });

    it('should remove member by admin', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/chat/rooms/${groupRoomId}/members/${userCId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
    });

    it('should add member back by admin', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/chat/rooms/${groupRoomId}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userCId })
        .expect(201);

      expect(res.body).toHaveProperty('userId', userCId);
    });

    it('should reject remove from direct room', async () => {
      await request(app.getHttpServer())
        .delete(`/api/chat/rooms/${directRoomId}/members/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });

    it('member can leave group themselves', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/chat/rooms/${groupRoomId}/members/${userCId}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
    });
  });

  // ─── LAST MESSAGE IN ROOM LIST ─────────────────────────────

  describe('Room list metadata', () => {
    it('should include lastMessage in room list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const directRoom = res.body.find((r: any) => r.id === directRoomId);
      expect(directRoom).toHaveProperty('lastMessage');
      expect(directRoom).toHaveProperty('unreadCount');
    });
  });
});
