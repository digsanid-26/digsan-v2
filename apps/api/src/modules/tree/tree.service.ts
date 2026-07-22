import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from '../notification/email.service';
import { NotificationService } from '../notification/notification.service';
import { slugify } from '../../common/utils/slug.util';
import { CreateTreeDto } from './dto/create-tree.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateCardStyleDto } from './dto/card-style.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class TreeService {
  private readonly logger = new Logger(TreeService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private config: ConfigService,
    private notifications: NotificationService,
  ) {}

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

  // ─── LAYOUT (config-driven explorer sync) ───────────────────

  /** Returns the user's default tree (creating one if none exists). */
  private async getOrCreateDefaultTree(userId: string) {
    // 1. Trees owned by the user
    const owned = await this.prisma.familyTree.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (owned) return owned;

    // 2. Trees the user is a member of (invited but not owner)
    const memberOf = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { tree: true },
      orderBy: { createdAt: 'asc' },
    });
    if (memberOf?.tree) return memberOf.tree;

    // 3. Create a new tree
    return this.prisma.familyTree.create({
      data: { name: 'Pohon Keluarga Saya', userId },
    });
  }

  /** Generate a unique tree slug from a base string. */
  private async uniqueTreeSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base);
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.prisma.familyTree.findUnique({ where: { slug: candidate } });
      if (!found || found.id === excludeId) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  /** Generate a unique username from a base string. */
  private async uniqueUsername(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base, 'user');
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!found || found.id === excludeId) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  /**
   * Ensure the tree has a slug (derived from the main family name) and the
   * owner has a username. Runs lazily whenever the layout is read/saved.
   * Never throws — returns best-effort identity so layout operations stay stable.
   */
  private async ensureIdentity(tree: { id: string; slug: string | null; name: string; userId: string; layoutConfig: any }) {
    let slug = tree.slug;
    const familyName = (tree.layoutConfig?.mainFamilyName as string) || tree.name || 'keluarga';
    const desiredBase = `${familyName}-fam`;

    if (!slug) {
      try {
        slug = await this.uniqueTreeSlug(desiredBase, tree.id);
        await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
        this.logger.log(`Created slug "${slug}" for tree ${tree.id} (base: "${desiredBase}")`);
      } catch (err) {
        this.logger.error(`Failed to create slug for tree ${tree.id}: ${err}`);
        slug = null;
      }
    }

    let owner: { name: string; username: string | null; avatar: string | null } | null = null;
    try {
      const ownerRow = await this.prisma.user.findUnique({
        where: { id: tree.userId },
        select: { id: true, name: true, username: true, avatar: true },
      });
      let username = ownerRow?.username || null;
      if (ownerRow && !username) {
        username = await this.uniqueUsername(ownerRow.name, ownerRow.id);
        await this.prisma.user.update({ where: { id: ownerRow.id }, data: { username } });
        this.logger.log(`Created username "${username}" for user ${ownerRow.id}`);
      }
      owner = ownerRow ? { name: ownerRow.name, username, avatar: ownerRow.avatar } : null;
    } catch (err) {
      this.logger.error(`Failed to ensure username for tree ${tree.id}: ${err}`);
    }

    return { slug, owner };
  }

  /** Get the saved explorer layout (config + members) for the current user. */
  async getLayout(userId: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    const identity = await this.ensureIdentity(tree);
    return {
      treeId: tree.id,
      slug: identity.slug,
      owner: identity.owner,
      config: tree.layoutConfig ?? null,
      members: tree.layoutMembers ?? null,
      updatedAt: tree.updatedAt,
    };
  }

  /** Manually create or update the family slug. */
  async setSlug(userId: string, desiredSlug?: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    const familyName = (tree.layoutConfig as any)?.mainFamilyName || tree.name || 'keluarga';
    const base = desiredSlug?.trim() || `${familyName}-fam`;
    const slug = await this.uniqueTreeSlug(base, tree.id);
    await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
    this.logger.log(`Slug manually set to "${slug}" for tree ${tree.id}`);

    const owner = await this.prisma.user.findUnique({
      where: { id: tree.userId },
      select: { id: true, name: true, username: true, avatar: true },
    });
    let username = owner?.username || null;
    if (owner && !username) {
      try {
        username = await this.uniqueUsername(owner.name, owner.id);
        await this.prisma.user.update({ where: { id: owner.id }, data: { username } });
      } catch (err) {
        this.logger.error(`Failed to create username: ${err}`);
      }
    }
    return { slug, owner: owner ? { name: owner.name, username, avatar: owner.avatar } : null };
  }

  /** Persist the explorer layout (config + members) for the current user. */
  async saveLayout(userId: string, config: unknown, members: unknown) {
    const tree = await this.getOrCreateDefaultTree(userId);

    // Only the tree owner can save layout changes.
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat menyimpan perubahan bagan');
    }

    const updated = await this.prisma.familyTree.update({
      where: { id: tree.id },
      data: {
        ...(config !== undefined && { layoutConfig: config as any }),
        ...(members !== undefined && { layoutMembers: members as any }),
      },
    });
    const identity = await this.ensureIdentity(updated);
    return {
      treeId: updated.id,
      slug: identity.slug,
      owner: identity.owner,
      config: updated.layoutConfig ?? null,
      members: updated.layoutMembers ?? null,
      updatedAt: updated.updatedAt,
    };
  }

  // ─── PUBLIC FAMILY / PROFILE PAGES ──────────────────────────

  /** Public family page data resolved by tree slug. */
  async getPublicFamily(slug: string) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { slug },
      include: { user: { select: { name: true, username: true, avatar: true, bio: true } } },
    });
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');
    return {
      slug: tree.slug,
      name: (tree.layoutConfig as any)?.mainFamilyName || tree.name,
      description: tree.description,
      coverImage: tree.coverImage,
      config: tree.layoutConfig ?? null,
      members: tree.layoutMembers ?? null,
      owner: tree.user,
      updatedAt: tree.updatedAt,
    };
  }

  /**
   * A logged-in user claims an unclaimed node on someone else's public
   * family tree (via the "Apakah ini Anda?" flow). Marks the layout member
   * slot as verified and links it to the claiming user's account.
   */
  async claimNode(userId: string, slug: string, nodeId: string) {
    if (nodeId === 'self') {
      throw new BadRequestException('Bagian ini adalah pemilik silsilah, tidak bisa diklaim');
    }

    const tree = await this.prisma.familyTree.findUnique({ where: { slug } });
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');

    const members = { ...((tree.layoutMembers as any) ?? {}) } as Record<string, any>;
    const existing = members[nodeId] ?? {};

    if (existing.verified && existing.claimedByUserId && existing.claimedByUserId !== userId) {
      throw new ConflictException('Bagian silsilah ini sudah diklaim oleh orang lain');
    }

    members[nodeId] = { ...existing, verified: true, claimedByUserId: userId };

    await this.prisma.familyTree.update({
      where: { id: tree.id },
      data: { layoutMembers: members as any },
    });

    return { slug: tree.slug, nodeId, member: members[nodeId] };
  }

  /** Public personal-profile page resolved by tree slug + username. */
  async getPublicProfile(slug: string, username: string) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, layoutConfig: true, userId: true },
    });
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, avatar: true, bio: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Profil tidak ditemukan');

    // Is this user the owner (self) of the family? Expose their layout member.
    const isOwner = user.id === tree.userId;
    const members = (await this.prisma.familyTree.findUnique({ where: { id: tree.id }, select: { layoutMembers: true } }))?.layoutMembers as any;
    const selfMember = isOwner && members ? members['self'] ?? null : null;

    return {
      family: { slug: tree.slug, name: (tree.layoutConfig as any)?.mainFamilyName || tree.name },
      profile: {
        name: user.name,
        username: user.username,
        avatar: user.avatar || selfMember?.photo || null,
        bio: user.bio,
        isOwner,
        joinedAt: user.createdAt,
      },
    };
  }

  // ─── GUARDIANSHIP CONSENT ───────────────────────────────────

  /**
   * A guardian (tree owner) requests permission to manage the sub-tree of a
   * LIVING member (identified by its node key in the layout). Creates or
   * refreshes a PENDING consent and notifies the target account if known.
   */
  async requestConsent(
    userId: string,
    dto: { nodeId: string; targetUserId?: string; targetEmail?: string; targetPhone?: string; note?: string },
  ) {
    const tree = await this.getOrCreateDefaultTree(userId);

    const consent = await this.prisma.guardianConsent.upsert({
      where: { treeId_nodeId_requesterId: { treeId: tree.id, nodeId: dto.nodeId, requesterId: userId } },
      create: {
        treeId: tree.id,
        nodeId: dto.nodeId,
        requesterId: userId,
        targetUserId: dto.targetUserId || null,
        targetEmail: dto.targetEmail || null,
        targetPhone: dto.targetPhone || null,
        note: dto.note || null,
        status: 'PENDING',
      },
      update: {
        // Re-requesting resets a previously rejected/revoked consent.
        targetUserId: dto.targetUserId || null,
        targetEmail: dto.targetEmail || null,
        targetPhone: dto.targetPhone || null,
        note: dto.note || null,
        status: 'PENDING',
        respondedAt: null,
      },
    });

    if (consent.targetUserId) {
      const requester = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      this.notifications.create({
        userId: consent.targetUserId,
        type: 'SYSTEM' as any,
        title: 'Permintaan izin wali',
        message: `${requester?.name || 'Seseorang'} meminta izin untuk mengelola profil dan silsilah Anda.`,
        data: { kind: 'GUARDIAN_CONSENT', consentId: consent.id },
      }).catch(() => {});
      this.notifications.sendPushSafe(consent.targetUserId, 'Permintaan Izin Wali', `${requester?.name || 'Seseorang'} meminta izin mengelola silsilah Anda`).catch(() => {});
    }

    return consent;
  }

  /** Consents created by the current user for their own tree (with statuses). */
  async getTreeConsents(userId: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    return this.prisma.guardianConsent.findMany({
      where: { treeId: tree.id, requesterId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Pending consent requests addressed to the current user (to grant/reject). */
  async getIncomingConsents(userId: string) {
    return this.prisma.guardianConsent.findMany({
      where: { targetUserId: userId, status: 'PENDING' },
      include: { tree: { select: { id: true, name: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Target user grants or rejects a consent request. */
  async respondConsent(userId: string, consentId: string, grant: boolean) {
    const consent = await this.prisma.guardianConsent.findUnique({ where: { id: consentId } });
    if (!consent) throw new NotFoundException('Permintaan izin tidak ditemukan');
    if (consent.targetUserId !== userId) {
      throw new ForbiddenException('Hanya pemilik identitas yang dapat merespons izin ini');
    }
    if (consent.status !== 'PENDING') throw new BadRequestException('Permintaan izin sudah direspons');

    const updated = await this.prisma.guardianConsent.update({
      where: { id: consentId },
      data: { status: grant ? 'GRANTED' : 'REJECTED', respondedAt: new Date() },
    });

    const responder = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    this.notifications.create({
      userId: consent.requesterId,
      type: 'SYSTEM' as any,
      title: grant ? 'Izin wali disetujui' : 'Izin wali ditolak',
      message: `${responder?.name || 'Pengguna'} ${grant ? 'menyetujui' : 'menolak'} permintaan pengelolaan silsilah.`,
      data: { kind: 'GUARDIAN_CONSENT', consentId: consent.id, granted: grant },
    }).catch(() => {});
    this.notifications.sendPushSafe(consent.requesterId, grant ? 'Izin Disetujui' : 'Izin Ditolak', `${responder?.name || 'Pengguna'} ${grant ? 'menyetujui' : 'menolak'} permintaan Anda`).catch(() => {});

    return updated;
  }

  /**
   * Revoke a consent. The target may revoke a granted access; the requester
   * may cancel their own pending/granted request.
   */
  async revokeConsent(userId: string, consentId: string) {
    const consent = await this.prisma.guardianConsent.findUnique({ where: { id: consentId } });
    if (!consent) throw new NotFoundException('Permintaan izin tidak ditemukan');
    if (consent.targetUserId !== userId && consent.requesterId !== userId) {
      throw new ForbiddenException('Akses ditolak');
    }
    return this.prisma.guardianConsent.update({
      where: { id: consentId },
      data: { status: 'REVOKED', respondedAt: new Date() },
    });
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

  /**
   * Send an email invitation for a node in the current user's default tree.
   * Works with the config-driven layout (no explicit treeId needed).
   */
  async inviteByEmail(userId: string, dto: InviteMemberDto) {
    if (!dto.email) throw new BadRequestException('Email harus diisi');
    const tree = await this.getOrCreateDefaultTree(userId);
    return this.createInvitation(tree.id, userId, dto);
  }

  async createInvitation(treeId: string, userId: string, dto: InviteMemberDto) {
    await this.ensureTreeOwner(treeId, userId);

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email atau nomor telepon harus diisi');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await this.prisma.treeInvitation.create({
      data: {
        treeId,
        email: dto.email,
        phone: dto.phone,
        nodeId: dto.nodeId,
        message: dto.message,
        token,
        expiresAt,
      },
    });

    // Fire the email (best-effort — EmailService logs when SMTP is unset).
    if (dto.email) {
      try {
        const [tree, inviter] = await Promise.all([
          this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } }),
        ]);
        const webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
        const acceptUrl = `${webUrl}/invite/${token}`;
        await this.email.sendTreeInvitationEmail(
          dto.email,
          inviter?.name || 'Seseorang',
          tree?.name || 'Keluarga',
          acceptUrl,
          dto.message,
          inviter?.avatar || null,
          webUrl,
        );
      } catch (err) {
        this.logger.error(`Failed to send invitation email: ${err}`);
      }
    }

    // Create in-app notification if the invitee has an account
    if (dto.email) {
      const invitee = await this.prisma.user.findFirst({ where: { email: { equals: dto.email, mode: 'insensitive' } } });
      if (invitee) {
        const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { name: true } });
        const inviter = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        this.notifications.create({
          userId: invitee.id,
          type: 'TREE_INVITATION' as any,
          title: 'Undangan Silsilah Keluarga',
          message: `${inviter?.name || 'Seseorang'} mengundang Anda ke silsilah "${tree?.name || 'Keluarga'}".`,
          data: { invitationId: invitation.id, token, treeId },
        }).catch(() => {});
        this.notifications.sendPushSafe(invitee.id, 'Undangan Silsilah', `${inviter?.name || 'Seseorang'} mengundang Anda ke silsilah keluarga`).catch(() => {});
      }
    }

    return invitation;
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

    // Return tree info so frontend can redirect to the correct tree
    const tree = invitation.tree;
    const identity = await this.ensureIdentity(tree);

    // Notify tree owner that invitation was accepted
    this.notifications.create({
      userId: tree.userId,
      type: 'MEMBER_ADDED' as any,
      title: 'Anggota Baru Bergabung',
      message: `${user.name} telah menerima undangan dan bergabung ke silsilah "${tree.name}".`,
      data: { treeId: tree.id, memberId: member.id, userId },
    }).catch(() => {});
    this.notifications.sendPushSafe(tree.userId, 'Anggota Baru', `${user.name} bergabung ke silsilah Anda`).catch(() => {});

    return { message: 'Undangan diterima', member, treeId: tree.id, slug: identity.slug };
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

  // ─── ONBOARDING SEARCH & PENDING INVITATIONS ──────────────────

  async searchUsersAndFamilies(query: string, currentUserId: string) {
    const q = query.trim();
    if (q.length < 3) return { users: [], families: [] };

    const [users, families] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { not: currentUserId },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          email: true,
        },
        take: 10,
      }),
      this.prisma.familyTree.findMany({
        where: {
          userId: { not: currentUserId },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          userId: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
        take: 10,
      }),
    ]);

    return {
      users: users.map((u) => ({ ...u, type: 'user' as const })),
      families: families.map((f) => ({ ...f, type: 'family' as const })),
    };
  }

  async getPendingInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const invitations = await this.prisma.treeInvitation.findMany({
      where: {
        status: 'PENDING',
        email: { equals: user.email, mode: 'insensitive' },
        expiresAt: { gt: new Date() },
      },
      include: {
        tree: {
          select: {
            id: true,
            name: true,
            slug: true,
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      token: inv.token,
      message: inv.message,
      createdAt: inv.createdAt,
      tree: inv.tree,
    }));
  }
}
