import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ─── ROOMS ──────────────────────────────────────────────────

  async getOrCreateDirectRoom(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Tidak bisa chat dengan diri sendiri');
    }

    // Check target user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException('User tidak ditemukan');

    // Find existing direct room between these two users
    const existingRoom = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });

    if (existingRoom) return existingRoom;

    // Create new direct room
    return this.prisma.chatRoom.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId },
            { userId: targetUserId },
          ],
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });
  }

  async createGroupRoom(userId: string, name: string, memberIds: string[], type: string = 'GROUP') {
    // Ensure creator is included
    const allMemberIds = Array.from(new Set([userId, ...memberIds]));

    return this.prisma.chatRoom.create({
      data: {
        name,
        type: type as any,
        members: {
          create: allMemberIds.map((id) => ({
            userId: id,
            role: id === userId ? 'admin' : 'member',
          })),
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });
  }

  async getUserRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true, type: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add unread count per room
    const result = await Promise.all(
      rooms.map(async (room: any) => {
        const member = room.members.find((m: any) => m.userId === userId);
        const unreadCount = member?.lastRead
          ? await this.prisma.chatMessage.count({
              where: {
                roomId: room.id,
                createdAt: { gt: member.lastRead },
                senderId: { not: userId },
                deletedAt: null,
              },
            })
          : await this.prisma.chatMessage.count({
              where: {
                roomId: room.id,
                senderId: { not: userId },
                deletedAt: null,
              },
            });

        return {
          ...room,
          lastMessage: room.messages[0] || null,
          messages: undefined,
          unreadCount,
        };
      }),
    );

    return result;
  }

  async getRoomById(userId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });

    if (!room) throw new NotFoundException('Room tidak ditemukan');
    return room;
  }

  // ─── MESSAGES ───────────────────────────────────────────────

  async sendMessage(userId: string, roomId: string, content: string, type: string = 'TEXT', metadata?: any) {
    // Verify membership
    const member = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new ForbiddenException('Bukan anggota room ini');

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId: userId,
        content,
        type: type as any,
        metadata,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update room's updatedAt
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(userId: string, roomId: string, query: { page?: number; limit?: number }) {
    // Verify membership
    const member = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new ForbiddenException('Bukan anggota room ini');

    const page = query.page || 1;
    const limit = query.limit || 30;
    const skip = (page - 1) * limit;

    const [messages, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where: { roomId, deletedAt: null },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatMessage.count({ where: { roomId, deletedAt: null } }),
    ]);

    return { messages, total, page, limit };
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Pesan tidak ditemukan');
    if (message.senderId !== userId) throw new ForbiddenException('Hanya pengirim yang bisa menghapus');

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── READ RECEIPTS ─────────────────────────────────────────

  async markAsRead(userId: string, roomId: string) {
    const member = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new ForbiddenException('Bukan anggota room ini');

    return this.prisma.chatMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastRead: new Date() },
    });
  }

  // ─── MEMBERS ────────────────────────────────────────────────

  async addMember(userId: string, roomId: string, newUserId: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room tidak ditemukan');
    if (room.type === 'DIRECT') throw new BadRequestException('Tidak bisa menambah anggota ke direct chat');

    // Check requester is admin of the room
    const requester = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!requester || requester.role !== 'admin') {
      throw new ForbiddenException('Hanya admin room yang bisa menambah anggota');
    }

    // Check new user exists
    const newUser = await this.prisma.user.findUnique({ where: { id: newUserId } });
    if (!newUser) throw new NotFoundException('User tidak ditemukan');

    // Check not already a member
    const existing = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: newUserId } },
    });
    if (existing) throw new BadRequestException('User sudah menjadi anggota');

    return this.prisma.chatMember.create({
      data: { roomId, userId: newUserId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
  }

  async removeMember(userId: string, roomId: string, targetUserId: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room tidak ditemukan');
    if (room.type === 'DIRECT') throw new BadRequestException('Tidak bisa menghapus anggota dari direct chat');

    // Check requester is admin or removing self
    const requester = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!requester) throw new ForbiddenException('Bukan anggota room ini');
    if (userId !== targetUserId && requester.role !== 'admin') {
      throw new ForbiddenException('Hanya admin room yang bisa menghapus anggota');
    }

    const target = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('User bukan anggota room');

    await this.prisma.chatMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    return { message: 'Anggota berhasil dihapus' };
  }
}
