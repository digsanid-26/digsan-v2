import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from '../notification/email.service';
import { NotificationService } from '../notification/notification.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { slugify } from '../../common/utils/slug.util';
import { CreateTreeDto } from './dto/create-tree.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateCardStyleDto } from './dto/card-style.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class TreeService {
  private readonly logger = new Logger(TreeService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private config: ConfigService,
    private notifications: NotificationService,
    private gamification: GamificationService,
    private whatsapp: WhatsappService,
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

  async update(id: string, userId: string, dto: UpdateTreeDto, roles?: string[]) {
    const tree = await this.ensureTreeOwner(id, userId, roles);

    // Connected users (sharedFamilySlug set) cannot edit the family node.
    const config = (tree.layoutConfig as any) ?? {};
    if (config.sharedFamilySlug && !roles?.includes('super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat mengedit Family Node');
    }

    return this.prisma.familyTree.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.familyImage !== undefined && { familyImage: dto.familyImage }),
        ...(dto.familyBio !== undefined && { familyBio: dto.familyBio }),
        ...(dto.marriageDate !== undefined && { marriageDate: new Date(dto.marriageDate) }),
        ...(dto.marriageStatus !== undefined && { marriageStatus: dto.marriageStatus }),
        ...(dto.headName !== undefined && { headName: dto.headName }),
      },
    });
  }

  async remove(id: string, userId: string, roles?: string[]) {
    await this.ensureTreeOwner(id, userId, roles);
    await this.prisma.familyTree.delete({ where: { id } });
    return { message: 'Pohon keluarga berhasil dihapus' };
  }

  /**
   * Auto-detect the CORE family of a tree — the head, their spouse(s) and their
   * children — from the config-driven layout JSON used by /tree.
   *
   * These are the "anggota tetap" of the Family Node: they always belong to the
   * node and therefore share its single public family page. They are derived
   * (not stored) so the Family Node stays in sync with /tree automatically.
   */
  private deriveCoreMembers(tree: any, ownerName: string) {
    const config = (tree.layoutConfig as Record<string, any>) ?? {};
    const layout = (tree.layoutMembers as Record<string, any>) ?? {};
    const out: any[] = [];

    const push = (nodeId: string, fallbackName: string, familyRole: string, order: number) => {
      const m = layout[nodeId];
      const name = m?.name || fallbackName;
      if (!name) return;
      out.push({
        id: `layout:${nodeId}`,
        nodeId,
        treeId: tree.id,
        userId: m?.linkedUserId ?? null,
        name,
        gender: m?.gender || null,
        photo: m?.photo ?? null,
        email: m?.email || null,
        phone: m?.phone || null,
        familyRole,
        childOrder: order,
        accountStatus: m?.linkedUserId ? 'ACTIVE' : m?.earlyAccess ? 'EARLY_ACCESS' : 'PASSIVE',
        isCore: true,
        source: 'layout',
      });
    };

    // Head of the family (the tree owner)
    push('self', ownerName || 'Kepala Keluarga', 'Kepala Keluarga', 0);

    // Spouse(s)
    const spouseCount = Number(config.spouseCount ?? 0);
    for (let i = 0; i < spouseCount; i++) {
      push(`spouse-${i}`, spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', 'Pasangan', 1);
    }

    // Children from the config counts
    const childCount = Number(config.childCount ?? 0);
    for (let i = 0; i < childCount; i++) {
      push(`child-${i}`, `Anak ${i + 1}`, 'Anak', 2 + i);
    }

    // Children added explicitly via the tree UI (recursive circles) that hang
    // directly off the head or their spouse — still part of the core family.
    const spouseIds = new Set(Array.from({ length: spouseCount }, (_, i) => `spouse-${i}`));
    for (const [nodeId, m] of Object.entries(layout)) {
      if (!m || m.group !== 'child') continue;
      if (/^child-\d+$/.test(nodeId)) continue; // already covered by the counts
      const parent = m.parentId;
      if (parent === 'self' || (parent && spouseIds.has(parent))) {
        push(nodeId, m.name || 'Anak', 'Anak', 2 + childCount + out.length);
      }
    }

    return out;
  }

  /** Get the Family Node profile (for the edit page). */
  async getFamilyNode(id: string, userId: string, roles?: string[]) {
    const tree = await this.ensureTreeOwner(id, userId, roles);

    // Connected users (sharedFamilySlug set) see the inviter's family node
    // as read-only — unless they have super_user role.
    const config = (tree.layoutConfig as any) ?? {};
    const sharedSlug = config.sharedFamilySlug as string | undefined;
    const isSuperUser = !!roles?.includes('super_user');
    let canEdit = true;
    let sourceTree = tree;

    if (sharedSlug) {
      canEdit = isSuperUser;
      const inviterTree = await this.prisma.familyTree.findFirst({
        where: { slug: sharedSlug },
      });
      if (inviterTree) sourceTree = inviterTree;
    } else if (tree.userId === userId) {
      // Fallback for old data: check if this user is a linked member
      // in someone else's tree (linked before sharedFamilySlug feature).
      const inviterTree = await this.findInviterTree(userId);
      if (inviterTree && inviterTree.id !== tree.id) {
        canEdit = isSuperUser;
        sourceTree = inviterTree;
        // Fix: backfill sharedFamilySlug so future requests skip the search
        const inviterSlug = (inviterTree.layoutConfig as any)?.sharedFamilySlug
          || (inviterTree.layoutConfig as any)?.slug
          || inviterTree.slug;
        if (inviterSlug) {
          this.prisma.familyTree.update({
            where: { id: tree.id },
            data: {
              layoutConfig: { ...config, sharedFamilySlug: inviterSlug } as any,
            },
          }).catch((err) => this.logger.error(`Failed to backfill sharedFamilySlug: ${err}`));
        }
      }
    }

    const stored = await this.prisma.familyMember.findMany({
      where: { treeId: sourceTree.id },
      orderBy: [{ childOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Auto-detect the core family (suami/istri/anak-anak) from the layout JSON
    // so the Family Node lists them without any manual grouping step.
    const owner = await this.prisma.user.findUnique({
      where: { id: sourceTree.userId },
      select: { name: true },
    });
    const core = this.deriveCoreMembers(sourceTree, owner?.name || '');

    // Merge: stored FamilyMember rows win over derived ones for the same person
    // (matched on linked account, else on a normalised name).
    const key = (m: any) => (m.userId ? `u:${m.userId}` : `n:${(m.name || '').trim().toLowerCase()}`);
    const seen = new Set(stored.map(key));
    const members = [
      ...stored.map((m) => ({ ...m, isCore: false, source: 'record' })),
      ...core.filter((m) => !seen.has(key(m))),
    ];

    return {
      id: sourceTree.id,
      name: sourceTree.name,
      slug: sourceTree.slug,
      description: sourceTree.description,
      isPublic: sourceTree.isPublic,
      coverImage: sourceTree.coverImage,
      familyImage: sourceTree.familyImage,
      familyBio: sourceTree.familyBio,
      marriageDate: sourceTree.marriageDate,
      marriageStatus: sourceTree.marriageStatus,
      headName: sourceTree.headName,
      config: sourceTree.layoutConfig ?? null,
      layoutMembers: sourceTree.layoutMembers ?? null,
      members,
      canEdit,
    };
  }

  // ─── LAYOUT (config-driven explorer sync) ───────────────────

  /** Find a tree where the given user is a linked member (linkedUserId in layoutMembers).
   *  Used as fallback for old data created before sharedFamilySlug feature. */
  private async findInviterTree(userId: string) {
    // Get all trees that are NOT owned by this user
    const trees = await this.prisma.familyTree.findMany({
      where: { userId: { not: userId } },
    });

    for (const t of trees) {
      const members = (t.layoutMembers as Record<string, any>) ?? {};
      for (const [, m] of Object.entries(members)) {
        if ((m as any)?.linkedUserId === userId) {
          return t;
        }
      }
    }
    return null;
  }

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
    const newTree = await this.prisma.familyTree.create({
      data: { name: 'Pohon Keluarga Saya', userId },
    });

    // Auto-assign super_user role to the tree creator (first-time tree owner)
    await this.assignSuperUserRole(userId);

    return newTree;
  }

  /** Like getOrCreateDefaultTree but ONLY returns trees owned by the user.
   *  Never returns a tree the user is merely a member of.
   *  Used when we need to modify the user's own tree (e.g. syncLinkedUser). */
  private async getOrCreateOwnedTree(userId: string) {
    const owned = await this.prisma.familyTree.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (owned) return owned;

    const newTree = await this.prisma.familyTree.create({
      data: { name: 'Pohon Keluarga Saya', userId },
    });
    await this.assignSuperUserRole(userId);
    return newTree;
  }

  /** Assign the super_user role to a user if they don't already have it. */
  private async assignSuperUserRole(userId: string) {
    const role = await this.prisma.role.findUnique({ where: { name: 'super_user' } });
    if (!role) return;
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    }).catch(() => {});
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
    const sharedFamilySlug = tree.layoutConfig?.sharedFamilySlug as string | undefined;

    if (!slug) {
      if (sharedFamilySlug) {
        // This tree belongs to a connected user (linked to an inviter's family).
        // Use the inviter's shared slug — one family = one public page.
        slug = sharedFamilySlug;
      } else {
        // This is a standalone tree owner — create a unique slug.
        try {
          slug = await this.uniqueTreeSlug(desiredBase, tree.id);
          await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
          this.logger.log(`Created slug "${slug}" for tree ${tree.id} (base: "${desiredBase}")`);
        } catch (err) {
          this.logger.error(`Failed to create slug for tree ${tree.id}: ${err}`);
          slug = null;
        }
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

  /** Recover slugs for trees that had them wiped by the syncLinkedUser bug.
   *  Recreate slugs for trees with null slug. For trees with sharedFamilySlug,
   *  check if the shared slug still exists — if not, the sharedFamilySlug is
   *  stale (from the old syncLinkedUser bug) and is cleared before recovering.
   *  Returns count of recovered slugs. */
  async recoverSlugs(): Promise<{ recovered: number; details: { treeId: string; slug: string }[] }> {
    const trees = await this.prisma.familyTree.findMany({
      where: { slug: null },
    });
    const details: { treeId: string; slug: string }[] = [];
    for (const tree of trees) {
      const config = (tree.layoutConfig as any) ?? {};
      if (config.sharedFamilySlug) {
        // Check if the shared slug actually points to an existing tree.
        // If it does, this is a legitimate connected user — skip.
        // If it doesn't, the sharedFamilySlug is stale (from the old
        // syncLinkedUser bug that nulled the inviter's own slug) — clear it
        // and recover the slug.
        const inviter = await this.prisma.familyTree.findUnique({
          where: { slug: config.sharedFamilySlug },
          select: { id: true },
        }).catch(() => null);
        if (inviter) continue; // Legitimate connected user
        // Stale sharedFamilySlug — clear it
        this.logger.log(`Clearing stale sharedFamilySlug "${config.sharedFamilySlug}" from tree ${tree.id} (no tree has that slug)`);
        await this.prisma.familyTree.update({
          where: { id: tree.id },
          data: { layoutConfig: { ...config, sharedFamilySlug: null } as any },
        });
      }
      try {
        const familyName = config.mainFamilyName || tree.name || 'keluarga';
        const desiredBase = `${familyName}-fam`;
        const slug = await this.uniqueTreeSlug(desiredBase, tree.id);
        await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
        details.push({ treeId: tree.id, slug });
        this.logger.log(`Recovered slug "${slug}" for tree ${tree.id}`);
      } catch (err) {
        this.logger.error(`Failed to recover slug for tree ${tree.id}: ${err}`);
      }
    }
    return { recovered: details.length, details };
  }

  /** Get the saved explorer layout (config + members) for the current user. */
  async getLayout(userId: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    const identity = await this.ensureIdentity(tree);

    // Check if this user is a connected member (not the tree owner)
    const isTreeOwner = tree.userId === userId;
    let connectedFamily: { familyName: string; slug: string; ownerId: string; ownerName: string } | null = null;

    if (!isTreeOwner) {
      // User is a member of someone else's tree — return inviter's family info
      const inviterConfig = (tree.layoutConfig as any) ?? {};
      const sharedSlug = inviterConfig.sharedFamilySlug || identity.slug || '';
      const ownerName = identity.owner?.name || '';
      const familyName = inviterConfig.mainFamilyName
        || (tree.name && tree.name !== 'Pohon Keluarga Saya' ? tree.name : null)
        || (ownerName ? `Keluarga ${ownerName}` : 'Keluarga');
      connectedFamily = {
        familyName,
        slug: sharedSlug,
        ownerId: tree.userId,
        ownerName,
      };
    }

    // For connected users (tree owners with sharedFamilySlug set by syncLinkedUser),
    // resolve the inviter's family info for the "connected to" UI.
    if (isTreeOwner) {
      const config = (tree.layoutConfig as any) ?? {};
      if (config.sharedFamilySlug) {
        // This user is connected to another family — resolve inviter info
        const inviterTree = await this.prisma.familyTree.findUnique({
          where: { slug: config.sharedFamilySlug },
          select: { name: true, userId: true, layoutConfig: true },
        }).catch(() => null);
        if (inviterTree) {
          const inviterConfig = (inviterTree.layoutConfig as any) ?? {};
          const inviterOwner = await this.prisma.user.findUnique({
            where: { id: inviterTree.userId },
            select: { name: true },
          }).catch(() => null);
          connectedFamily = {
            familyName: inviterConfig.mainFamilyName || inviterTree.name || 'Keluarga',
            slug: config.sharedFamilySlug,
            ownerId: inviterTree.userId,
            ownerName: inviterOwner?.name || '',
          };
        }
      }
    }

    // For connected users, return the shared slug as the main slug
    const effectiveSlug = !isTreeOwner
      ? (connectedFamily?.slug || identity.slug)
      : identity.slug;

    return {
      treeId: tree.id,
      slug: effectiveSlug,
      owner: identity.owner,
      config: tree.layoutConfig ?? null,
      members: tree.layoutMembers ?? null,
      updatedAt: tree.updatedAt,
      isTreeOwner,
      connectedFamily,
    };
  }

  /** Manually create or update the family slug. */
  async setSlug(userId: string, desiredSlug?: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat mengatur slug');
    }
    const familyName = (tree.layoutConfig as any)?.mainFamilyName || tree.name || 'keluarga';
    const base = desiredSlug?.trim() || `${familyName}-fam`;
    const slug = await this.uniqueTreeSlug(base, tree.id);
    await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
    this.logger.log(`Slug manually set to "${slug}" for tree ${tree.id}`);

    // Propagate new slug to all connected members' trees
    const membersData = (tree.layoutMembers as Record<string, any>) ?? {};
    const linkedUserIds = new Set<string>();
    for (const [, m] of Object.entries(membersData)) {
      if ((m as any)?.linkedUserId) linkedUserIds.add((m as any).linkedUserId);
    }
    for (const linkedUserId of linkedUserIds) {
      try {
        const linkedTree = await this.prisma.familyTree.findFirst({ where: { userId: linkedUserId } });
        if (linkedTree && linkedTree.userId === linkedUserId) {
          const linkedConfig = (linkedTree.layoutConfig as any) ?? {};
          await this.prisma.familyTree.update({
            where: { id: linkedTree.id },
            data: {
              layoutConfig: { ...linkedConfig, sharedFamilySlug: slug } as any,
              slug: null,
            },
          });
          this.logger.log(`Propagated slug "${slug}" to linked user ${linkedUserId}'s tree (slug nulled, shared slug set)`);
        }
      } catch (err) {
        this.logger.error(`Failed to propagate slug to linked user ${linkedUserId}: ${err}`);
      }
    }

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

  /** Set slug on a specific tree (for Family Node page). */
  async setSlugForTree(treeId: string, userId: string, desiredSlug?: string, roles?: string[]) {
    const tree = await this.ensureTreeOwner(treeId, userId, roles);

    const config = (tree.layoutConfig as any) ?? {};
    if (config.sharedFamilySlug && !roles?.includes('super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat mengatur slug Family Node ini');
    }

    const familyName = config.mainFamilyName || tree.name || 'keluarga';
    const base = desiredSlug?.trim() || `${familyName}-fam`;
    const slug = await this.uniqueTreeSlug(base, tree.id);
    await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
    this.logger.log(`Slug set to "${slug}" for tree ${tree.id} (via Family Node page)`);

    // Propagate to connected members
    const membersData = (tree.layoutMembers as Record<string, any>) ?? {};
    const linkedUserIds = new Set<string>();
    for (const [, m] of Object.entries(membersData)) {
      if ((m as any)?.linkedUserId) linkedUserIds.add((m as any).linkedUserId);
    }
    for (const linkedUserId of linkedUserIds) {
      try {
        const linkedTree = await this.prisma.familyTree.findFirst({ where: { userId: linkedUserId } });
        if (linkedTree) {
          const linkedConfig = (linkedTree.layoutConfig as any) ?? {};
          await this.prisma.familyTree.update({
            where: { id: linkedTree.id },
            data: {
              layoutConfig: { ...linkedConfig, sharedFamilySlug: slug } as any,
              slug: null,
            },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to propagate slug to linked user ${linkedUserId}: ${err}`);
      }
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: tree.userId },
      select: { id: true, name: true, username: true, avatar: true },
    });
    return { slug, owner: owner ? { name: owner.name, username: owner.username, avatar: owner.avatar } : null };
  }

  /** Persist the explorer layout (config + members) for the current user. */
  async saveLayout(userId: string, config: unknown, members: unknown) {
    const tree = await this.getOrCreateDefaultTree(userId);

    // Only the tree owner can save layout changes.
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat menyimpan perubahan bagan');
    }

    // Detect newly linked users in members data to send consent notifications
    if (members && typeof members === 'object') {
      const oldMembers = (tree.layoutMembers as Record<string, any>) ?? {};
      const newMembers = members as Record<string, any>;
      const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

      for (const [nodeId, member] of Object.entries(newMembers)) {
        const m = member as any;
        const oldM = oldMembers[nodeId] as any;
        // If this member has a linkedUserId that wasn't there before, send notification
        if (m?.linkedUserId && m.linkedUserId !== oldM?.linkedUserId) {
          const linkedUser = await this.prisma.user.findUnique({
            where: { id: m.linkedUserId },
            select: { id: true, name: true },
          }).catch(() => null);

          if (linkedUser) {
            // Send consent/approval notification to the linked user
            this.notifications.create({
              userId: linkedUser.id,
              type: 'MEMBER_ADDED' as any,
              title: 'Konfirmasi Hubungan Keluarga',
              message: `${owner?.name || 'Seseorang'} mengidentifikasi Anda sebagai anggota keluarga dalam silsilah "${(config as any)?.mainFamilyName || tree.name}". Silakan konfirmasi hubungan keluarga ini.`,
              data: { treeId: tree.id, nodeId, linkedUserId: m.linkedUserId, action: 'confirm_relationship' },
            }).catch((err) => {
              this.logger.error(`Failed to send relationship notification: ${err.message}`);
            });
            this.notifications.sendPushSafe(
              linkedUser.id,
              'Konfirmasi Keluarga',
              `${owner?.name || 'Seseorang'} mengidentifikasi Anda sebagai anggota keluarganya`,
            ).catch(() => {});
            this.logger.log(`Sent relationship confirmation notification to user ${linkedUser.id} for node ${nodeId}`);
          }
        }
      }
    }

    const updated = await this.prisma.familyTree.update({
      where: { id: tree.id },
      data: {
        ...(config !== undefined && { layoutConfig: config as any }),
        ...(members !== undefined && { layoutMembers: members as any }),
      },
    });
    const identity = await this.ensureIdentity(updated);

    // ─── Propagate family name & slug to all connected members' trees ───
    if (config && identity.slug) {
      const newFamilyName = (config as any)?.mainFamilyName as string | undefined;
      if (newFamilyName) {
        const membersData = (members as Record<string, any>) ?? (tree.layoutMembers as Record<string, any>) ?? {};
        const linkedUserIds = new Set<string>();
        for (const [, m] of Object.entries(membersData)) {
          if ((m as any)?.linkedUserId) linkedUserIds.add((m as any).linkedUserId);
        }
        for (const linkedUserId of linkedUserIds) {
          try {
            const linkedTree = await this.prisma.familyTree.findFirst({ where: { userId: linkedUserId } });
            if (linkedTree && linkedTree.userId === linkedUserId) {
              const linkedConfig = (linkedTree.layoutConfig as any) ?? {};
              await this.prisma.familyTree.update({
                where: { id: linkedTree.id },
                data: {
                  layoutConfig: { ...linkedConfig, mainFamilyName: newFamilyName, sharedFamilySlug: identity.slug } as any,
                  ...(linkedTree.userId === linkedUserId && { slug: null }),
                },
              });
              this.logger.log(`Propagated familyName="${newFamilyName}" slug="${identity.slug}" to linked user ${linkedUserId}'s tree`);
            }
          } catch (err) {
            this.logger.error(`Failed to propagate to linked user ${linkedUserId}: ${err}`);
          }
        }
      }
    }

    return {
      treeId: updated.id,
      slug: identity.slug,
      owner: identity.owner,
      config: updated.layoutConfig ?? null,
      members: updated.layoutMembers ?? null,
      updatedAt: updated.updatedAt,
    };
  }

  // ─── SYNC LINKED USER INFO ──────────────────────────────────

  /** Sync avatar and info from a linked user's account into the member node.
   *  Also syncs the linked user's family tree to follow the inviter's slug and family name. */
  async syncLinkedUser(userId: string, nodeId: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat menyinkronkan');
    }

    const members = (tree.layoutMembers as Record<string, any>) ?? {};
    const member = members[nodeId];
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');
    if (!member.linkedUserId) throw new BadRequestException('Anggota ini belum terhubung dengan user manapun');

    const linkedUser = await this.prisma.user.findUnique({
      where: { id: member.linkedUserId },
      select: { id: true, name: true, avatar: true, email: true, phone: true, username: true },
    });
    if (!linkedUser) throw new NotFoundException('User terhubung tidak ditemukan');

    // Update member node with linked user's info
    members[nodeId] = {
      ...member,
      name: linkedUser.name || member.name,
      photo: linkedUser.avatar || member.photo || null,
      email: linkedUser.email || member.email || '',
      phone: linkedUser.phone || member.phone || '',
      verified: true,
    };

    const updated = await this.prisma.familyTree.update({
      where: { id: tree.id },
      data: { layoutMembers: members as any },
    });

    const identity = await this.ensureIdentity(updated);

    // ─── Sync linked user's family tree to share inviter's family page ───
    const inviterSlug = identity.slug;
    const inviterMembers = (tree.layoutMembers as Record<string, any>) ?? {};

    // Only sync the linked user's own node + their children to the linked tree.
    // Do NOT copy the inviter's parents, siblings, or other relatives.
    const spouseId = member.spouseId || null;
    const syncedMembers: Record<string, any> = {};
    for (const [id, m] of Object.entries(inviterMembers)) {
      const isSelf = id === nodeId;
      const isSpouse = id === spouseId;
      const isChild = m?.parentId === nodeId || m?.parentId === spouseId;
      if (isSelf || isSpouse || isChild) {
        syncedMembers[id] = m;
      }
    }

    let linkedTreeSlug: string | null = null;
    try {
      // Find or create the linked user's OWN tree (never the inviter's)
      const linkedTree = await this.getOrCreateOwnedTree(linkedUser.id);

      // Merge synced members into the linked user's existing layoutMembers
      // (preserve any members the linked user may have added on their own)
      const linkedConfig = (linkedTree.layoutConfig as any) ?? {};
      const linkedMembers = (linkedTree.layoutMembers as Record<string, any>) ?? {};
      const mergedMembers = { ...linkedMembers, ...syncedMembers };

      // Store sharedFamilySlug and null the linked user's own slug so they
      // share the inviter's public family page (one family = one slug).
      // Do NOT overwrite the linked user's own mainFamilyName.
      const updatedLinkedConfig = {
        ...linkedConfig,
        sharedFamilySlug: inviterSlug || null,
      };

      const updateData: any = {
        layoutConfig: updatedLinkedConfig as any,
        layoutMembers: mergedMembers as any,
      };
      if (linkedTree.userId === linkedUser.id) {
        updateData.slug = null;
      }
      await this.prisma.familyTree.update({
        where: { id: linkedTree.id },
        data: updateData,
      });

      linkedTreeSlug = inviterSlug;
      this.logger.log(`Synced linked user ${linkedUser.id} tree: sharedSlug="${inviterSlug}" (slug nulled)`);

      // Award network_add points to the inviter (tree owner)
      this.gamification.awardNetworkAddPoints(tree.userId, linkedUser.id).catch((err) => {
        this.logger.error(`Failed to award network_add points: ${err}`);
      });
    } catch (err) {
      this.logger.error(`Failed to sync linked user's tree: ${err}`);
    }

    return {
      treeId: updated.id,
      slug: identity.slug,
      nodeId,
      member: members[nodeId],
      synced: {
        name: linkedUser.name,
        avatar: linkedUser.avatar,
        email: linkedUser.email,
        phone: linkedUser.phone,
        linkedTreeSlug,
      },
    };
  }

  // ─── PUBLIC FAMILY / PROFILE PAGES ──────────────────────────

  /** Public family page data resolved by tree slug. */
  async getPublicFamily(slug: string) {
    let tree = await this.prisma.familyTree.findUnique({
      where: { slug },
      include: { user: { select: { name: true, username: true, avatar: true, bio: true } } },
    });

    // Fallback 1: try slug + "-fam" suffix (auto-generated slug pattern)
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({
        where: { slug: `${slug}-fam` },
        include: { user: { select: { name: true, username: true, avatar: true, bio: true } } },
      });
      if (tree) this.logger.log(`Resolved slug "${slug}" → "${tree.slug}" via -fam fallback`);
    }

    // Fallback 2: slug was wiped to null by the syncLinkedUser bug.
    // Try to find a tree with null slug whose family name matches, then regenerate.
    if (!tree) {
      const candidates = await this.prisma.familyTree.findMany({
        where: { slug: null },
        include: { user: { select: { name: true, username: true, avatar: true, bio: true } } },
      });
      for (const t of candidates) {
        const config = (t.layoutConfig as any) ?? {};
        if (config.sharedFamilySlug) {
          // Check if the shared slug points to an existing tree.
          const inviter = await this.prisma.familyTree.findUnique({
            where: { slug: config.sharedFamilySlug },
            select: { id: true },
          }).catch(() => null);
          if (inviter) continue; // Legitimate connected user
          // Stale sharedFamilySlug — clear it and try to recover
          this.logger.log(`Clearing stale sharedFamilySlug "${config.sharedFamilySlug}" from tree ${t.id} during public access`);
          await this.prisma.familyTree.update({
            where: { id: t.id },
            data: { layoutConfig: { ...config, sharedFamilySlug: null } as any },
          });
        }
        const familyName = (config.mainFamilyName as string) || t.name || '';
        const desiredBase = `${familyName}-fam`;
        // Match if the family name slugified equals the requested slug
        // e.g. "Farisma" → "farisma" or "farisma-fam"
        const slugified = familyName.toLowerCase().trim().replace(/\s+/g, '-');
        if (slugified === slug || slugified === slug.replace(/-fam$/, '')) {
          // Regenerate slug for this tree
          try {
            const newSlug = await this.uniqueTreeSlug(desiredBase, t.id);
            await this.prisma.familyTree.update({ where: { id: t.id }, data: { slug: newSlug } });
            this.logger.log(`Recovered slug "${newSlug}" for tree ${t.id} on public access (was null)`);
            tree = { ...t, slug: newSlug };
          } catch (err) {
            this.logger.error(`Failed to recover slug for tree ${t.id}: ${err}`);
          }
          break;
        }
      }
    }

    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');
    const mainFamilyName = (tree.layoutConfig as any)?.mainFamilyName as string | undefined;
    return {
      slug: tree.slug,
      name: mainFamilyName?.trim() || tree.user?.name || tree.name,
      description: tree.description,
      coverImage: tree.coverImage,
      familyImage: tree.familyImage,
      familyBio: tree.familyBio,
      marriageDate: tree.marriageDate,
      marriageStatus: tree.marriageStatus,
      headName: tree.headName,
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

    let tree = await this.prisma.familyTree.findUnique({ where: { slug } });
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({ where: { slug: `${slug}-fam` } });
    }
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
    let tree = await this.prisma.familyTree.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, layoutConfig: true, userId: true },
    });
    // Fallback: try slug + "-fam"
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({
        where: { slug: `${slug}-fam` },
        select: { id: true, slug: true, name: true, layoutConfig: true, userId: true },
      });
    }
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, avatar: true, bio: true, status: true, createdAt: true, birthDate: true, birthPlace: true, education: true, occupation: true, hobbies: true },
    });
    if (!user) throw new NotFoundException('Profil tidak ditemukan');

    // Is this user the owner (self) of the family? Expose their layout member.
    const isOwner = user.id === tree.userId;
    const members = (await this.prisma.familyTree.findUnique({ where: { id: tree.id }, select: { layoutMembers: true } }))?.layoutMembers as any;
    // The owner is always the 'self' node; anyone else (e.g. an early-access
    // member) is resolved by the link stored on their layout node.
    const nodeId = isOwner ? 'self' : this.findLayoutNodeForUser(members, user.id);
    const node = nodeId && members ? members[nodeId] ?? null : null;
    if (!isOwner && !node) throw new NotFoundException('Profil tidak ditemukan di keluarga ini');

    return {
      family: { slug: tree.slug, name: (tree.layoutConfig as any)?.mainFamilyName || tree.name },
      profile: {
        name: user.name,
        username: user.username,
        avatar: user.avatar || node?.photo || null,
        bio: user.bio,
        isOwner,
        nodeId,
        familyRole: node?.role || null,
        gender: node?.gender || null,
        alive: node?.alive !== false,
        earlyAccess: user.status === 'EARLY_ACCESS',
        joinedAt: user.createdAt,
        birthDate: user.birthDate,
        birthPlace: user.birthPlace,
        education: user.education,
        occupation: user.occupation,
        hobbies: user.hobbies,
      },
    };
  }

  // ─── PUBLIC LINK TOKENS ─────────────────────────────────────

  /** Check if a user is the owner of a tree by slug. */
  async isTreeOwner(slug: string, userId: string): Promise<boolean> {
    let tree = await this.prisma.familyTree.findUnique({ where: { slug }, select: { userId: true } });
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({ where: { slug: `${slug}-fam` }, select: { userId: true } });
    }
    return tree?.userId === userId;
  }

  /** Check if a user is a member (or owner) of a tree by slug. */
  async isTreeMember(slug: string, userId: string): Promise<boolean> {
    let tree = await this.prisma.familyTree.findUnique({
      where: { slug },
      select: { id: true, userId: true, layoutMembers: true },
    });
    // Fallback: try slug + "-fam"
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({
        where: { slug: `${slug}-fam` },
        select: { id: true, userId: true, layoutMembers: true },
      });
    }
    if (!tree) return false;
    if (tree.userId === userId) return true;
    const member = await this.prisma.familyMember.findFirst({
      where: { treeId: tree.id, userId },
      select: { id: true },
    });
    if (member) return true;
    // Early-access members are linked on the layout blob rather than via a
    // FamilyMember row, so they'd otherwise be locked out of their own family.
    return this.findLayoutNodeForUser(tree.layoutMembers, userId) !== null;
  }

  /** Find the layout node id a user is linked to, or null. */
  private findLayoutNodeForUser(layoutMembers: unknown, userId: string): string | null {
    const layout = (layoutMembers as Record<string, any>) ?? {};
    for (const [nodeId, m] of Object.entries(layout)) {
      if (m && typeof m === 'object' && (m.linkedUserId === userId || m.claimedByUserId === userId)) return nodeId;
    }
    return null;
  }

  /** Check if a user has super_user role. */
  async isSuperUser(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });
    return userRoles.some((ur) => ur.role.name === 'super_user');
  }

  /** Get the configured expiry hours for public links (default 8, admin-configurable). */
  private async getPublicLinkExpiryHours(): Promise<number> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key: 'public_link_expiry_hours' },
    });
    const val = setting ? parseInt(setting.value, 10) : 8;
    return isNaN(val) || val <= 0 ? 8 : val;
  }

  /** Generate a time-limited token for a public family/profile page. */
  async generatePublicLinkToken(userId: string, slug: string, username?: string) {
    let tree = await this.prisma.familyTree.findUnique({ where: { slug } });
    if (!tree && !slug.endsWith('-fam')) {
      tree = await this.prisma.familyTree.findUnique({ where: { slug: `${slug}-fam` } });
    }
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');

    // Only the tree owner can generate tokens for their family
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik keluarga yang dapat membuat link publik');
    }

    const hours = await this.getPublicLinkExpiryHours();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);

    const record = await this.prisma.publicLinkToken.create({
      data: { token, slug, username: username || null, userId, expiresAt },
    });

    return { token: record.token, expiresAt: record.expiresAt, slug, username: username || null };
  }

  /** Validate a public link token. Returns true if valid, throws if expired/invalid. */
  async validatePublicLinkToken(token: string, slug: string, username?: string): Promise<boolean> {
    const record = await this.prisma.publicLinkToken.findUnique({ where: { token } });
    if (!record) throw new ForbiddenException('Token link publik tidak valid');
    // Accept both exact slug and slug-fam variant (slug may have been regenerated)
    if (record.slug !== slug && record.slug !== `${slug}-fam` && `${record.slug}-fam` !== slug) {
      throw new ForbiddenException('Token tidak sesuai untuk keluarga ini');
    }
    if (username && record.username && record.username !== username) {
      throw new ForbiddenException('Token tidak sesuai untuk profil ini');
    }
    if (record.expiresAt < new Date()) {
      throw new ForbiddenException('Token link publik telah kedaluwarsa. Silakan minta link baru.');
    }
    return true;
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

  async addMember(treeId: string, userId: string, dto: CreateMemberDto, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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

  async updateMember(treeId: string, memberId: string, userId: string, dto: UpdateMemberDto, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, treeId },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');

    // If the member is linked to an active user account, require consent
    // (super-user can edit freely only for non-active/unlinked members)
    if (member.userId && member.userId !== userId) {
      const linkedUser = await this.prisma.user.findUnique({
        where: { id: member.userId },
        select: { status: true },
      });
      if (linkedUser && linkedUser.status === 'ACTIVE') {
        // Check if consent has been granted
        const consent = await this.prisma.guardianConsent.findFirst({
          where: {
            treeId,
            nodeId: memberId,
            requesterId: userId,
            targetUserId: member.userId,
            status: 'GRANTED',
          },
        });
        if (!consent) {
          throw new ForbiddenException(
            'Anggota ini telah memiliki akun aktif. Anda perlu meminta izin terlebih dahulu untuk mengedit profil/silsilahnya.',
          );
        }
      }
    }

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

  async removeMember(treeId: string, memberId: string, userId: string, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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

  async updateCardStyle(treeId: string, userId: string, dto: UpdateCardStyleDto, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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

  async createInvitation(treeId: string, userId: string, dto: InviteMemberDto, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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

    // Auto-generate a public link token so the invitee can view the family page
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { slug: true } });
    let publicLinkToken: string | null = null;
    if (tree?.slug) {
      const plt = await this.generatePublicLinkToken(userId, tree.slug);
      publicLinkToken = plt.token;
    }

    // Fire the email (best-effort — EmailService logs when SMTP is unset).
    if (dto.email) {
      try {
        const [treeRow, inviter] = await Promise.all([
          this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } }),
        ]);
        const webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
        const acceptUrl = `${webUrl}/invite/${token}`;
        await this.email.sendTreeInvitationEmail(
          dto.email,
          inviter?.name || 'Seseorang',
          treeRow?.name || 'Keluarga',
          acceptUrl,
          dto.message,
          inviter?.avatar || null,
          webUrl,
        );
      } catch (err) {
        this.logger.error(`Failed to send invitation email: ${err}`);
      }
    }

    // Fire WhatsApp invitation (best-effort — WhatsappService logs when FONNTE_API_KEY is unset).
    if (dto.phone) {
      try {
        const [treeRow, inviter] = await Promise.all([
          this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        ]);
        const webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
        const acceptUrl = `${webUrl}/invite/${token}`;
        this.whatsapp
          .sendTreeInvitation(dto.phone, inviter?.name || 'Seseorang', treeRow?.name || 'Keluarga', acceptUrl, dto.message)
          .catch((err) => this.logger.error(`Failed to send WA invitation: ${err}`));
      } catch (err) {
        this.logger.error(`Failed to prepare WA invitation: ${err}`);
      }
    }

    // Create in-app notification if the invitee has an account (by email or phone)
    let invitee: { id: string } | null = null;
    if (dto.email) {
      invitee = await this.prisma.user.findFirst({ where: { email: { equals: dto.email, mode: 'insensitive' } } });
    }
    if (!invitee && dto.phone) {
      invitee = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    }
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

    return { ...invitation, publicLinkToken };
  }

  async getInvitations(treeId: string, userId: string, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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

  async cancelInvitation(treeId: string, invitationId: string, userId: string, roles?: string[]) {
    await this.ensureTreeOwner(treeId, userId, roles);

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
    roles?: string[],
  ) {
    await this.ensureTreeOwner(sourceTreeId, userId, roles);

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

  // ─── SUPER USER: EARLY ACCESS & NODE LIST ───────────────────

  /**
   * Super User creates an email+password early access account for a FamilyMember (table-based).
   * The new user gets EARLY_ACCESS status (can login without verification to fill profile).
   */
  async createEarlyAccess(
    treeId: string,
    memberId: string,
    userId: string,
    roles: string[],
    email: string,
    password: string,
    phone?: string,
  ) {
    if (!roles?.includes('super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat membuat early access');
    }

    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, treeId },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');

    if (member.userId) {
      throw new BadRequestException('Anggota ini sudah memiliki akun terhubung');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar');
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        throw new ConflictException('Nomor telepon sudah terdaftar');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // A username is what makes /family/{slug}/{username} resolvable, so every
    // early-access member gets one up front.
    const username = await this.uniqueUsername(member.name);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        name: member.name,
        username,
        passwordHash,
        phone: phone || null,
        status: 'EARLY_ACCESS',
      },
    });

    // Assign default 'user' role
    const userRole = await this.prisma.role.findUnique({ where: { name: 'user' } });
    if (userRole) {
      await this.prisma.userRole.create({
        data: { userId: newUser.id, roleId: userRole.id },
      });
    }

    // Link member to the new user
    await this.prisma.familyMember.update({
      where: { id: memberId },
      data: {
        userId: newUser.id,
        email,
        phone: phone || member.phone,
      },
    });

    return {
      message: 'Early access berhasil dibuat',
      publicProfileUrl: tree.slug ? `/family/${tree.slug}/${newUser.username}` : null,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, username: newUser.username, status: newUser.status },
    };
  }

  /**
   * Super User creates an email+password early access account for a layout node.
   * Works with config-driven layout node IDs (e.g. 'parent-0', 'child-1').
   * The new user gets EARLY_ACCESS status (can login without verification to fill profile).
   */
  async createEarlyAccessForNode(
    userId: string,
    roles: string[],
    nodeId: string,
    email: string,
    password: string,
    phone?: string,
  ) {
    if (!roles?.includes('super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat membuat early access');
    }

    const tree = await this.getOrCreateDefaultTree(userId);

    const members = (tree.layoutMembers as Record<string, any>) ?? {};
    const member = members[nodeId];
    if (!member) throw new NotFoundException('Node tidak ditemukan dalam silsilah');

    if (member.linkedUserId || member.claimedByUserId) {
      throw new BadRequestException('Node ini sudah memiliki akun terhubung');
    }

    if (nodeId === 'self') {
      throw new BadRequestException('Tidak bisa membuat early access untuk diri sendiri');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar');
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        throw new ConflictException('Nomor telepon sudah terdaftar');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const memberName = member.name || nodeId;

    // A username is what makes /family/{slug}/{username} resolvable, so every
    // early-access member gets one up front.
    const username = await this.uniqueUsername(memberName);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        name: memberName,
        username,
        passwordHash,
        phone: phone || null,
        status: 'EARLY_ACCESS',
      },
    });

    // Assign default 'user' role
    const userRole = await this.prisma.role.findUnique({ where: { name: 'user' } });
    if (userRole) {
      await this.prisma.userRole.create({
        data: { userId: newUser.id, roleId: userRole.id },
      });
    }

    // Link layout member to the new user. `earlyAccess` + `username` are what
    // the public pages and the super_user login button key off.
    members[nodeId] = {
      ...member,
      linkedUserId: newUser.id,
      earlyAccess: true,
      username,
      email,
      phone: phone || member.phone || null,
    };

    await this.prisma.familyTree.update({
      where: { id: tree.id },
      data: { layoutMembers: members as any },
    });

    return {
      message: 'Early access berhasil dibuat',
      nodeId,
      publicProfileUrl: tree.slug ? `/family/${tree.slug}/${username}` : null,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, username, status: newUser.status },
    };
  }

  /**
   * Super User gets a list of all nodes (family members) across trees they own,
   * with full info: name, email, phone, account status.
   */
  async getSuperUserNodes(userId: string, roles: string[]) {
    if (!roles?.includes('super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat mengakses daftar ini');
    }

    const trees = await this.prisma.familyTree.findMany({
      where: { userId },
      select: { id: true, name: true, slug: true, layoutMembers: true },
    });

    const treeIds = trees.map((t) => t.id);

    const members = await this.prisma.familyMember.findMany({
      where: { treeId: { in: treeIds } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        accountStatus: true,
        gender: true,
        familyRole: true,
        isCreator: true,
        tree: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, email: true, status: true, lastLoginAt: true } },
      },
      orderBy: [{ treeId: 'asc' }, { createdAt: 'asc' }],
    });

    const dbRows = members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email || m.user?.email || null,
      phone: m.phone || null,
      gender: m.gender,
      familyRole: m.familyRole,
      isCreator: m.isCreator,
      accountStatus: m.accountStatus || (m.user ? m.user.status : 'NONE'),
      treeName: m.tree.name,
      treeSlug: m.tree.slug,
      hasAccount: !!m.user,
      lastLoginAt: m.user?.lastLoginAt || null,
      source: 'record' as 'record' | 'canvas',
      nodeId: null as string | null,
    }));

    // ─── Circles drawn on the explorer canvas (layoutMembers JSON) ───
    // Every circle the super_user creates/edits in /tree is persisted here, so
    // surface them in the same list even before a FamilyMember row exists.
    const GROUP_LABEL: Record<string, string> = {
      self: 'Diri Sendiri', spouse: 'Pasangan', parent: 'Orang Tua',
      grandparent: 'Kakek/Nenek', ancestor: 'Leluhur', kakak: 'Kakak',
      adik: 'Adik', child: 'Anak', uncle: 'Paman/Bibi',
    };
    const linkedUserIds = new Set<string>();
    const layoutRows: typeof dbRows = [];
    for (const t of trees) {
      const layout = (t.layoutMembers as Record<string, any>) ?? {};
      for (const [nodeId, raw] of Object.entries(layout)) {
        const m = raw as any;
        if (!m || typeof m !== 'object' || !m.name) continue;
        if (m.linkedUserId) linkedUserIds.add(m.linkedUserId);
        layoutRows.push({
          id: `${t.id}:${nodeId}`,
          name: m.name,
          email: m.email || null,
          phone: m.phone || null,
          gender: m.gender === 'L' ? 'male' : m.gender === 'P' ? 'female' : null,
          familyRole: m.role || GROUP_LABEL[m.group] || null,
          isCreator: nodeId === 'self',
          accountStatus: m.linkedUserId ? 'LINKED' : 'NONE',
          treeName: t.name,
          treeSlug: t.slug,
          hasAccount: !!m.linkedUserId,
          lastLoginAt: null,
          source: 'canvas',
          nodeId,
        });
      }
    }

    // Enrich linked circles with their real account status / last login.
    if (linkedUserIds.size) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...linkedUserIds] } },
        select: { id: true, email: true, status: true, lastLoginAt: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const t of trees) {
        const layout = (t.layoutMembers as Record<string, any>) ?? {};
        for (const [nodeId, raw] of Object.entries(layout)) {
          const u = (raw as any)?.linkedUserId ? byId.get((raw as any).linkedUserId) : undefined;
          if (!u) continue;
          const row = layoutRows.find((r) => r.id === `${t.id}:${nodeId}`);
          if (row) {
            row.email = row.email || u.email;
            row.accountStatus = u.status;
            row.lastLoginAt = u.lastLoginAt;
          }
        }
      }
    }

    // De-duplicate: a canvas circle whose name already exists as a DB record
    // for the same tree is the same person.
    const seen = new Set(dbRows.map((r) => `${r.treeName}|${r.name.toLowerCase()}`));
    const canvasRows = layoutRows.filter((r) => !seen.has(`${r.treeName}|${r.name.toLowerCase()}`));
    const allRows = [...dbRows, ...canvasRows];

    return {
      trees: trees.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        memberCount: allRows.filter((m) => m.treeName === t.name).length,
        activeCount: allRows.filter((m) => m.treeName === t.name && m.accountStatus === 'ACTIVE').length,
      })),
      members: allRows,
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async ensureTreeOwner(treeId: string, userId: string, roles?: string[]) {
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');
    if (tree.userId !== userId && !roles?.includes('super_user')) {
      throw new ForbiddenException('Akses ditolak');
    }
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
