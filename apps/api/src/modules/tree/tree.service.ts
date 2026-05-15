import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateTreeDto } from './dto/create-tree.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateCardStyleDto } from './dto/card-style.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class TreeService {
  private readonly logger = new Logger(TreeService.name);

  constructor(private prisma: PrismaService) {}

  // ─── TREE CRUD ──────────────────────────────────────────────

  async findAll(userId: string) {
    return this.prisma.familyTree.findMany({
      where: { userId },
      include: {
        _count: { select: { members: true } },
        cardStyle: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findPublicTrees(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [trees, total] = await Promise.all([
      this.prisma.familyTree.findMany({
        where: { isPublic: true },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { members: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.familyTree.count({ where: { isPublic: true } }),
    ]);
    return { trees, total, page, totalPages: Math.ceil(total / limit) };
  }

  async create(userId: string, dto: CreateTreeDto) {
    const tree = await this.prisma.familyTree.create({
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        userId,
      },
    });

    // Auto-create the creator as the first member
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.prisma.familyMember.create({
        data: {
          treeId: tree.id,
          userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isCreator: true,
          familyRole: 'Saya',
        },
      });
    }

    return tree;
  }

  async findOne(id: string, userId?: string) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            parent: { select: { id: true, name: true } },
            spouse: { select: { id: true, name: true } },
            children: { select: { id: true, name: true, gender: true, childOrder: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        cardStyle: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!tree) {
      throw new NotFoundException('Pohon keluarga tidak ditemukan');
    }

    // If not public, only owner can view
    if (!tree.isPublic && userId && tree.userId !== userId) {
      throw new ForbiddenException('Akses ditolak');
    }

    return tree;
  }

  async update(id: string, userId: string, dto: UpdateTreeDto) {
    const tree = await this.ensureTreeOwner(id, userId);

    return this.prisma.familyTree.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.ensureTreeOwner(id, userId);
    await this.prisma.familyTree.delete({ where: { id } });
    return { message: 'Pohon keluarga berhasil dihapus' };
  }

  // ─── MEMBERS ────────────────────────────────────────────────

  async getMembers(treeId: string, userId?: string) {
    await this.ensureTreeAccess(treeId, userId);

    return this.prisma.familyMember.findMany({
      where: { treeId },
      include: {
        parent: { select: { id: true, name: true } },
        spouse: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true, gender: true, childOrder: true },
          orderBy: { childOrder: 'asc' },
        },
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(treeId: string, userId: string, dto: CreateMemberDto) {
    await this.ensureTreeOwner(treeId, userId);

    // Validate parentId belongs to the same tree
    if (dto.parentId) {
      const parent = await this.prisma.familyMember.findFirst({
        where: { id: dto.parentId, treeId },
      });
      if (!parent) throw new BadRequestException('Parent tidak ditemukan di pohon ini');
    }

    // Validate spouseId belongs to the same tree
    if (dto.spouseId) {
      const spouse = await this.prisma.familyMember.findFirst({
        where: { id: dto.spouseId, treeId },
      });
      if (!spouse) throw new BadRequestException('Spouse tidak ditemukan di pohon ini');
    }

    const member = await this.prisma.familyMember.create({
      data: {
        treeId,
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        birthPlace: dto.birthPlace,
        deathDate: dto.deathDate ? new Date(dto.deathDate) : null,
        photo: dto.photo,
        phone: dto.phone,
        email: dto.email,
        isWhatsapp: dto.isWhatsapp ?? false,
        familyRole: dto.familyRole,
        childOrder: dto.childOrder,
        parentId: dto.parentId || null,
        spouseId: dto.spouseId || null,
        userId: dto.userId || null,
      },
      include: {
        parent: { select: { id: true, name: true } },
        spouse: { select: { id: true, name: true } },
      },
    });

    // If linking spouse, update the reverse relation
    if (dto.spouseId) {
      await this.prisma.familyMember.update({
        where: { id: dto.spouseId },
        data: { spouseId: member.id },
      });
    }

    return member;
  }

  async getMember(treeId: string, memberId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, treeId },
      include: {
        parent: { select: { id: true, name: true, gender: true } },
        spouse: { select: { id: true, name: true, gender: true } },
        children: {
          select: { id: true, name: true, gender: true, childOrder: true, birthDate: true },
          orderBy: { childOrder: 'asc' },
        },
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');
    return member;
  }

  async updateMember(treeId: string, memberId: string, userId: string, dto: UpdateMemberDto) {
    await this.ensureTreeOwner(treeId, userId);

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, treeId },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');

    // Validate parentId
    if (dto.parentId !== undefined && dto.parentId) {
      if (dto.parentId === memberId) throw new BadRequestException('Anggota tidak bisa menjadi parent sendiri');
      const parent = await this.prisma.familyMember.findFirst({ where: { id: dto.parentId, treeId } });
      if (!parent) throw new BadRequestException('Parent tidak ditemukan di pohon ini');
    }

    // Validate spouseId
    if (dto.spouseId !== undefined && dto.spouseId) {
      if (dto.spouseId === memberId) throw new BadRequestException('Anggota tidak bisa menjadi spouse sendiri');
      const spouse = await this.prisma.familyMember.findFirst({ where: { id: dto.spouseId, treeId } });
      if (!spouse) throw new BadRequestException('Spouse tidak ditemukan di pohon ini');
    }

    const oldSpouseId = member.spouseId;
    const newSpouseId = dto.spouseId !== undefined ? dto.spouseId : member.spouseId;

    const updated = await this.prisma.familyMember.update({
      where: { id: memberId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.birthPlace !== undefined && { birthPlace: dto.birthPlace }),
        ...(dto.deathDate !== undefined && { deathDate: dto.deathDate ? new Date(dto.deathDate) : null }),
        ...(dto.photo !== undefined && { photo: dto.photo }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.isWhatsapp !== undefined && { isWhatsapp: dto.isWhatsapp }),
        ...(dto.familyRole !== undefined && { familyRole: dto.familyRole }),
        ...(dto.childOrder !== undefined && { childOrder: dto.childOrder }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
        ...(dto.spouseId !== undefined && { spouseId: dto.spouseId || null }),
        ...(dto.userId !== undefined && { userId: dto.userId || null }),
      },
      include: {
        parent: { select: { id: true, name: true } },
        spouse: { select: { id: true, name: true } },
      },
    });

    // Handle bidirectional spouse linking
    if (dto.spouseId !== undefined && dto.spouseId !== oldSpouseId) {
      // Unlink old spouse
      if (oldSpouseId) {
        const oldSpouse = await this.prisma.familyMember.findUnique({ where: { id: oldSpouseId } });
        if (oldSpouse && oldSpouse.spouseId === memberId) {
          await this.prisma.familyMember.update({
            where: { id: oldSpouseId },
            data: { spouseId: null },
          });
        }
      }
      // Link new spouse
      if (newSpouseId) {
        await this.prisma.familyMember.update({
          where: { id: newSpouseId },
          data: { spouseId: memberId },
        });
      }
    }

    return updated;
  }

  async removeMember(treeId: string, memberId: string, userId: string) {
    await this.ensureTreeOwner(treeId, userId);

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, treeId },
      include: { children: { select: { id: true } } },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');

    // Prevent deleting members with children — must reassign first
    if (member.children.length > 0) {
      throw new BadRequestException(
        'Tidak bisa menghapus anggota yang memiliki anak. Pindahkan anak ke parent lain terlebih dahulu.',
      );
    }

    // Unlink spouse if any
    if (member.spouseId) {
      const spouse = await this.prisma.familyMember.findUnique({ where: { id: member.spouseId } });
      if (spouse && spouse.spouseId === memberId) {
        await this.prisma.familyMember.update({
          where: { id: member.spouseId },
          data: { spouseId: null },
        });
      }
    }

    await this.prisma.familyMember.delete({ where: { id: memberId } });
    return { message: 'Anggota berhasil dihapus' };
  }

  // ─── CARD STYLE ─────────────────────────────────────────────

  async updateCardStyle(treeId: string, userId: string, dto: UpdateCardStyleDto) {
    await this.ensureTreeOwner(treeId, userId);

    return this.prisma.cardStyle.upsert({
      where: { treeId },
      create: { treeId, ...dto },
      update: dto,
    });
  }

  // ─── INVITATIONS ────────────────────────────────────────────

  async createInvitation(treeId: string, userId: string, dto: InviteMemberDto) {
    await this.ensureTreeOwner(treeId, userId);

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email atau nomor telepon harus diisi');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    return this.prisma.treeInvitation.create({
      data: {
        treeId,
        email: dto.email,
        phone: dto.phone,
        token,
        expiresAt,
      },
    });
  }

  async getInvitations(treeId: string, userId: string) {
    await this.ensureTreeOwner(treeId, userId);

    return this.prisma.treeInvitation.findMany({
      where: { treeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.treeInvitation.findUnique({
      where: { token },
      include: { tree: true },
    });

    if (!invitation) throw new NotFoundException('Undangan tidak ditemukan');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Undangan sudah digunakan');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Undangan sudah kadaluarsa');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    // Check if user is already a member
    const existing = await this.prisma.familyMember.findFirst({
      where: { treeId: invitation.treeId, userId },
    });
    if (existing) throw new BadRequestException('Anda sudah menjadi anggota pohon ini');

    // Create member + accept invitation in transaction
    const [member] = await this.prisma.$transaction([
      this.prisma.familyMember.create({
        data: {
          treeId: invitation.treeId,
          userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      }),
      this.prisma.treeInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return { message: 'Undangan diterima', member };
  }

  async cancelInvitation(treeId: string, invitationId: string, userId: string) {
    await this.ensureTreeOwner(treeId, userId);

    const invitation = await this.prisma.treeInvitation.findFirst({
      where: { id: invitationId, treeId },
    });
    if (!invitation) throw new NotFoundException('Undangan tidak ditemukan');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Hanya undangan pending yang bisa dibatalkan');

    return this.prisma.treeInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── HUB CONNECTIONS ────────────────────────────────────────

  async requestHubConnection(
    sourceTreeId: string,
    targetTreeId: string,
    userId: string,
    type: 'MARRIAGE' | 'SIBLING' | 'PARENT_CHILD' | 'EXTENDED',
  ) {
    await this.ensureTreeOwner(sourceTreeId, userId);

    if (sourceTreeId === targetTreeId) {
      throw new BadRequestException('Tidak bisa menghubungkan pohon ke dirinya sendiri');
    }

    const targetTree = await this.prisma.familyTree.findUnique({ where: { id: targetTreeId } });
    if (!targetTree) throw new NotFoundException('Pohon target tidak ditemukan');

    const existing = await this.prisma.familyHubConnection.findFirst({
      where: {
        OR: [
          { sourceTreeId, targetTreeId },
          { sourceTreeId: targetTreeId, targetTreeId: sourceTreeId },
        ],
      },
    });
    if (existing) throw new BadRequestException('Koneksi sudah ada');

    return this.prisma.familyHubConnection.create({
      data: { sourceTreeId, targetTreeId, type },
    });
  }

  async getHubConnections(treeId: string) {
    return this.prisma.familyHubConnection.findMany({
      where: {
        OR: [{ sourceTreeId: treeId }, { targetTreeId: treeId }],
      },
      include: {
        sourceTree: { select: { id: true, name: true, userId: true } },
        targetTree: { select: { id: true, name: true, userId: true } },
      },
    });
  }

  async respondHubConnection(connectionId: string, userId: string, accept: boolean) {
    const connection = await this.prisma.familyHubConnection.findUnique({
      where: { id: connectionId },
      include: { targetTree: true },
    });
    if (!connection) throw new NotFoundException('Koneksi tidak ditemukan');
    if (connection.targetTree.userId !== userId) throw new ForbiddenException('Hanya pemilik pohon target yang bisa merespons');
    if (connection.status !== 'PENDING') throw new BadRequestException('Koneksi sudah direspons');

    return this.prisma.familyHubConnection.update({
      where: { id: connectionId },
      data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
    });
  }

  // ─── FAMILY GRAPH / TRAVERSAL ───────────────────────────────

  async getFamilyGraph(treeId: string, userId?: string) {
    await this.ensureTreeAccess(treeId, userId);

    const members = await this.prisma.familyMember.findMany({
      where: { treeId },
      select: {
        id: true,
        name: true,
        gender: true,
        birthDate: true,
        deathDate: true,
        photo: true,
        familyRole: true,
        childOrder: true,
        parentId: true,
        spouseId: true,
        isCreator: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build nodes and edges for tree visualization
    const nodes = members.map((m: any) => ({
      id: m.id,
      name: m.name,
      gender: m.gender,
      birthDate: m.birthDate,
      deathDate: m.deathDate,
      photo: m.photo,
      familyRole: m.familyRole,
      childOrder: m.childOrder,
      isCreator: m.isCreator,
    }));

    const edges: Array<{ source: string; target: string; type: 'parent' | 'spouse' }> = [];

    for (const m of members) {
      if (m.parentId) {
        edges.push({ source: m.parentId, target: m.id, type: 'parent' });
      }
      if (m.spouseId && m.id < m.spouseId) {
        // Only add once per spouse pair (alphabetical ID order)
        edges.push({ source: m.id, target: m.spouseId, type: 'spouse' });
      }
    }

    return { nodes, edges };
  }

  async getAncestors(treeId: string, memberId: string, maxDepth = 10) {
    const ancestors: any[] = [];
    let currentId: string | null = memberId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const member: {
        id: string; name: string; gender: string | null;
        birthDate: Date | null; deathDate: Date | null;
        photo: string | null; familyRole: string | null;
        parentId: string | null; spouseId: string | null;
        spouse: { id: string; name: string; gender: string | null } | null;
      } | null = await this.prisma.familyMember.findFirst({
        where: { id: currentId, treeId },
        select: {
          id: true, name: true, gender: true, birthDate: true, deathDate: true,
          photo: true, familyRole: true, parentId: true, spouseId: true,
          spouse: { select: { id: true, name: true, gender: true } },
        },
      });
      if (!member) break;
      if (depth > 0) ancestors.push({ ...member, depth });
      currentId = member.parentId;
      depth++;
    }

    return ancestors;
  }

  async getDescendants(treeId: string, memberId: string, maxDepth = 10) {
    const result: any[] = [];

    const traverse = async (id: string, depth: number) => {
      if (depth > maxDepth) return;

      const children = await this.prisma.familyMember.findMany({
        where: { treeId, parentId: id },
        select: {
          id: true, name: true, gender: true, birthDate: true, deathDate: true,
          photo: true, familyRole: true, childOrder: true, spouseId: true,
          spouse: { select: { id: true, name: true, gender: true } },
        },
        orderBy: { childOrder: 'asc' },
      });

      for (const child of children) {
        result.push({ ...child, depth });
        await traverse(child.id, depth + 1);
      }
    };

    await traverse(memberId, 1);
    return result;
  }

  async getStatistics(treeId: string, userId?: string) {
    await this.ensureTreeAccess(treeId, userId);

    const members = await this.prisma.familyMember.findMany({
      where: { treeId },
      select: { gender: true, birthDate: true, deathDate: true },
    });

    const total = members.length;
    const male = members.filter((m: any) => m.gender === 'male').length;
    const female = members.filter((m: any) => m.gender === 'female').length;
    const living = members.filter((m: any) => !m.deathDate).length;
    const deceased = members.filter((m: any) => m.deathDate).length;

    // Count generations (depth of tree)
    const allMembers = await this.prisma.familyMember.findMany({
      where: { treeId },
      select: { id: true, parentId: true },
    });
    const parentMap = new Map(allMembers.map((m: { id: string; parentId: string | null }) => [m.id, m.parentId]));

    let maxGeneration = 0;
    for (const m of allMembers) {
      let depth = 0;
      let pid: string | null | undefined = m.id;

      while (pid && depth < 100) {
        depth++;
        pid = parentMap.get(pid) as string | null | undefined;
      }
      maxGeneration = Math.max(maxGeneration, depth);
    }

    return {
      totalMembers: total,
      male,
      female,
      unknownGender: total - male - female,
      living,
      deceased,
      generations: maxGeneration + 1,
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async ensureTreeOwner(treeId: string, userId: string) {
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');
    if (tree.userId !== userId) throw new ForbiddenException('Akses ditolak');
    return tree;
  }

  private async ensureTreeAccess(treeId: string, userId?: string) {
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');
    if (!tree.isPublic && userId && tree.userId !== userId) {
      throw new ForbiddenException('Akses ditolak');
    }
    return tree;
  }
}
