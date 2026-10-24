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
import { GraphSyncService } from '../genealogy/graph-sync.service';
import { GenealogyService } from '../genealogy/genealogy.service';
import { decide as decidePermission } from '../genealogy/permissions.util';
import {
  ANCESTRY_KEY_RE,
  buildConnectedLayout,
  isHouseholdNode,
  isLayoutEmpty,
  projectFamilyConfig,
  projectionScope,
  protectedFieldsChanged,
  revertProtectedFields,
  sanitizeLayoutMembers,
  stripIdentityFields,
  type LayoutMembers,
} from './tree-layout.util';

const ADMIN_ROLES = ['admin', 'super_admin'];
const isAdmin = (roles?: string[]) => !!roles?.some((r) => ADMIN_ROLES.includes(r));

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
    private graphSync: GraphSyncService,
    private genealogy: GenealogyService,
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

    this.graphSync.syncTreeInBackground(tree.id);
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

    // Household members of another family node cannot edit that family node.
    if (!isAdmin(roles) && (await this.isHouseholdMemberElsewhere(tree))) {
      throw new ForbiddenException('Hanya kepala keluarga yang dapat mengedit Family Node');
    }

    const updated = await this.prisma.familyTree.update({
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
    // marriageStatus feeds the owner's first Union in the graph.
    if (dto.marriageStatus !== undefined) this.graphSync.syncTreeInBackground(id);
    return updated;
  }

  async remove(id: string, userId: string, roles?: string[]) {
    await this.ensureTreeOwner(id, userId, roles);
    // Retract this tree's graph assertions first; the cascade would otherwise
    // leave relationships nobody asserts any more.
    if (this.graphSync.enabled) await this.graphSync.retractTree(id);
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

    // Household members (non-head FamilyNodeMember of another anchor) see that
    // anchor's family node read-only — only the head edits it. Being linked as
    // a parent/sibling in someone's tree does NOT make it your family node.
    const config = (tree.layoutConfig as any) ?? {};
    let canEdit = true;
    let sourceTree = tree;

    const anchor = await this.getAnchorFor(tree.userId);
    if (anchor && anchor.treeId !== tree.id && !(await this.isFamilyNodeHead(tree.userId))) {
      const anchorTree = await this.prisma.familyTree.findUnique({ where: { id: anchor.treeId } });
      if (anchorTree) {
        sourceTree = anchorTree;
        canEdit = isAdmin(roles);
      }
    } else if (config.sharedFamilySlug && config.sharedFamilySlug !== tree.slug) {
      // Legacy marker (pre-FamilyNodeMember data).
      const inviterTree = await this.prisma.familyTree.findFirst({ where: { slug: config.sharedFamilySlug } });
      if (inviterTree && inviterTree.id !== tree.id) {
        sourceTree = inviterTree;
        canEdit = isAdmin(roles);
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

  /**
   * Whether the tree's owner belongs to ANOTHER household as a non-head member
   * (e.g. a wife whose family page is her husband's). Such a user may not edit
   * family-node profile data on their personal tree; only the head may.
   */
  private async isHouseholdMemberElsewhere(tree: { id: string; userId: string; slug: string | null; layoutConfig: any }) {
    const anchor = await this.getAnchorFor(tree.userId);
    if (anchor && anchor.treeId !== tree.id) return !(await this.isFamilyNodeHead(tree.userId));
    const shared = tree.layoutConfig?.sharedFamilySlug as string | undefined;
    if (!shared || shared === tree.slug) return false;
    const other = await this.prisma.familyTree.findFirst({ where: { slug: shared }, select: { id: true } });
    return !!other && other.id !== tree.id;
  }

  /** The user's default tree (owned first, else one they were invited into), without creating anything. */
  private async findDefaultTree(userId: string) {
    const owned = await this.prisma.familyTree.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (owned) return owned;

    const memberOf = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { tree: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberOf?.tree ?? null;
  }

  /** Returns the user's default tree (creating one if none exists). Only for write paths. */
  private async getOrCreateDefaultTree(userId: string) {
    const existing = await this.findDefaultTree(userId);
    if (existing) return existing;

    // Create a new tree
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

  /**
   * Assign the super_user role to a first-time tree creator. Early-access
   * accounts (managed on someone's behalf) never receive it automatically.
   */
  private async assignSuperUserRole(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user || user.status === 'EARLY_ACCESS') return;
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

  // ─── FAMILY NODE MEMBERSHIP (one family = one slug) ─────────

  /**
   * The Family Node a user belongs to, if any — i.e. the anchor tree that owns
   * the shared public slug. Returns null for standalone tree owners.
   */
  private async getAnchorFor(userId: string) {
    return this.prisma.familyNodeMember
      .findUnique({
        where: { userId },
        include: { tree: { select: { id: true, slug: true, userId: true } } },
      })
      .catch((err) => {
        this.logger.error(`Failed to resolve family node membership for ${userId}: ${err}`);
        return null;
      });
  }

  /**
   * Whether a user is the head of a Family Node that other people belong to.
   *
   * Such a user owns a live public family page. They must never be demoted
   * into somebody else's node, because that retires the slug the whole
   * household depends on.
   */
  private async isFamilyNodeHead(userId: string): Promise<boolean> {
    const ownedTrees = await this.prisma.familyTree.findMany({
      where: { userId },
      select: { id: true },
    });
    if (ownedTrees.length === 0) return false;
    const ownedIds = ownedTrees.map((t) => t.id);

    const dependents = await this.prisma.familyNodeMember.count({
      where: { treeId: { in: ownedIds }, userId: { not: userId } },
    });
    return dependents > 0;
  }

  /**
   * Record that a user belongs to a Family Node, and retire any competing slug
   * on their personal tree so the household keeps exactly one public page.
   *
   * A user who already heads a Family Node with other members is left untouched:
   * pulling them in would wipe the slug their own household publishes on.
   */
  async joinFamilyNode(treeId: string, userId: string, nodeId: string, role = 'member'): Promise<boolean> {
    // Joining your own anchor tree is a no-op reshuffle; allow it.
    const ownsTarget = await this.prisma.familyTree.findFirst({
      where: { id: treeId, userId },
      select: { id: true },
    });

    if (!ownsTarget && (await this.isFamilyNodeHead(userId))) {
      this.logger.warn(
        `Refusing to join user ${userId} into family node ${treeId}: they already head a family node with members`,
      );
      return false;
    }

    // Never silently move someone out of another household: that household's
    // head linked them first, so a second linker must not "steal" them.
    const current = await this.prisma.familyNodeMember.findUnique({ where: { userId } });
    if (current && current.treeId !== treeId && !current.isHead && !ownsTarget) {
      this.logger.warn(
        `Refusing to move user ${userId} from family node ${current.treeId} to ${treeId}: already a member elsewhere`,
      );
      return false;
    }

    await this.prisma.familyNodeMember.upsert({
      where: { userId },
      update: { treeId, nodeId, role, isHead: !!ownsTarget },
      create: { treeId, userId, nodeId, role, isHead: !!ownsTarget },
    });

    // Retire the joiner's own slug — the anchor tree owns the public page now.
    await this.prisma.familyTree
      .updateMany({ where: { userId, id: { not: treeId } }, data: { slug: null } })
      .catch((err) => this.logger.error(`Failed to retire personal slug for ${userId}: ${err}`));

    this.logger.log(`User ${userId} joined family node ${treeId} as "${nodeId}"`);
    return true;
  }

  /** Remove a user from their Family Node (they get their own page again). */
  async leaveFamilyNode(userId: string) {
    await this.prisma.familyNodeMember.deleteMany({ where: { userId } });
    this.logger.log(`User ${userId} left their family node`);
  }

  /**
   * The set of node ids a member owns inside a shared layout: their own circle
   * plus everything descending from it. Spouse links are treated as
   * co-ownership, so a child whose ``parentId`` points to the partner is
   * included in the other parent's slice as well. Grown iteratively so
   * arbitrarily deep descendant chains are covered.
   */
  private collectOwnSlice(layout: Record<string, any>, rootNodeId: string): Set<string> {
    // Build a bidirectional spouse map so we can treat a partner's children
    // as our own.
    const spouseOf = new Map<string, string>();
    for (const [id, m] of Object.entries(layout)) {
      const sp = m?.spouseId;
      if (sp && typeof sp === 'string') {
        spouseOf.set(id, sp);
        spouseOf.set(sp, id);
      }
    }

    const own = new Set<string>([rootNodeId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [id, m] of Object.entries(layout)) {
        if (own.has(id)) continue;
        const parent = m?.parentId;
        if (parent && (own.has(parent) || (spouseOf.has(parent) && own.has(spouseOf.get(parent)!)))) {
          own.add(id);
          grew = true;
        }
      }
    }
    return own;
  }

  /**
   * Targeted write-back.
   *
   * A Family Node member may edit their OWN slice of the shared layout — their
   * circle and its descendants — without being the head of the household. The
   * head keeps ownership of everything else, so a shared page stays coherent
   * while each person remains the author of their own branch.
   */
  async saveFamilyNodeSlice(userId: string, patch: Record<string, any>, roles?: string[]) {
    const anchor = await this.getAnchorFor(userId);
    if (!anchor) {
      throw new NotFoundException('Anda belum tergabung dalam Family Node manapun');
    }

    let isHead = false;
    const updated = await this.updateLayoutAtomically(anchor.treeId, (tree, layout) => {
      isHead = tree.userId === userId;
      const allowed = (isHead || isAdmin(roles)) ? null : this.collectOwnSlice(layout, anchor.nodeId);

      const rejected = allowed
        ? Object.keys(patch).filter((nodeId) => !allowed.has(nodeId))
        : [];
      if (rejected.length) {
        throw new ForbiddenException(
          `Anda hanya dapat mengubah bagian keluarga Anda sendiri. Ditolak: ${rejected.join(', ')}`,
        );
      }

      const next = { ...layout };
      for (const [nodeId, value] of Object.entries(patch)) {
        // Account links are never writable through a slice — only via approval flows.
        next[nodeId] = { ...next[nodeId], ...stripIdentityFields(value as Record<string, any>, next[nodeId]) };
      }
      return next;
    });

    this.logger.log(
      `User ${userId} wrote ${Object.keys(patch).length} node(s) into family node ${updated.id}`,
    );

    return {
      treeId: updated.id,
      slug: updated.slug,
      nodeId: anchor.nodeId,
      isHead,
      members: updated.layoutMembers,
    };
  }

  /**
   * One-off backfill: derive FamilyNodeMember rows from the pre-existing
   * `linkedUserId` links and legacy `sharedFamilySlug` markers, so households
   * that were already connected collapse onto a single public page.
   *
   * Precedence — a user linked into someone else's tree belongs THERE; only
   * users who are nobody's linked member become head of their own node.
   */
  async backfillFamilyNodeMembers(): Promise<{ linked: number; heads: number; slugsRetired: number }> {
    const trees = await this.prisma.familyTree.findMany({
      select: { id: true, slug: true, userId: true, layoutConfig: true, layoutMembers: true },
      orderBy: { createdAt: 'asc' },
    });
    const bySlug = new Map<string, { id: string; userId: string }>();
    for (const t of trees) if (t.slug) bySlug.set(t.slug, { id: t.id, userId: t.userId });

    const claimed = new Set<string>();
    let linked = 0;
    let heads = 0;
    let slugsRetired = 0;

    // Pass 1 — people linked into another person's HOUSEHOLD (spouse/children).
    // Parents, siblings etc. linked elsewhere keep their own household page.
    const householdNodeOf = (layout: LayoutMembers, uid: string) =>
      Object.entries(layout).find(([id, m]) => (m?.linkedUserId === uid || m?.claimedByUserId === uid) && isHouseholdNode(id, layout))?.[0];
    for (const t of trees) {
      const layout = (t.layoutMembers as LayoutMembers) ?? {};
      for (const [nodeId, m] of Object.entries(layout)) {
        const uid = m?.linkedUserId || m?.claimedByUserId;
        if (!uid || uid === t.userId || claimed.has(uid) || !isHouseholdNode(nodeId, layout)) continue;
        try {
          if (await this.joinFamilyNode(t.id, uid, nodeId, nodeId.startsWith('spouse') ? 'spouse' : 'member')) {
            claimed.add(uid);
            linked += 1;
          }
        } catch (err) {
          this.logger.error(`Backfill: failed to link ${uid} → tree ${t.id}: ${err}`);
        }
      }
    }

    // Pass 2 — legacy sharedFamilySlug markers, honoured only when the anchor
    // really has this user in its household (old code also set them for siblings).
    const byId = new Map(trees.map((t) => [t.id, t]));
    for (const t of trees) {
      if (claimed.has(t.userId)) continue;
      const shared = (t.layoutConfig as any)?.sharedFamilySlug as string | undefined;
      const anchor = shared ? bySlug.get(shared) : undefined;
      if (!anchor || anchor.id === t.id) continue;
      const nodeId = householdNodeOf((byId.get(anchor.id)?.layoutMembers as LayoutMembers) ?? {}, t.userId);
      if (!nodeId) continue;
      try {
        if (await this.joinFamilyNode(anchor.id, t.userId, nodeId, 'member')) {
          claimed.add(t.userId);
          if (t.slug) slugsRetired += 1;
          linked += 1;
        }
      } catch (err) {
        this.logger.error(`Backfill: failed legacy link ${t.userId} → tree ${anchor.id}: ${err}`);
      }
    }

    // Pass 3 — remaining tree owners become head of their own node.
    for (const t of trees) {
      if (claimed.has(t.userId)) continue;
      try {
        await this.prisma.familyNodeMember.upsert({
          where: { userId: t.userId },
          update: { treeId: t.id, nodeId: 'self', role: 'head', isHead: true },
          create: { treeId: t.id, userId: t.userId, nodeId: 'self', role: 'head', isHead: true },
        });
        claimed.add(t.userId);
        heads += 1;
      } catch (err) {
        this.logger.error(`Backfill: failed head membership for ${t.userId}: ${err}`);
      }
    }

    this.logger.log(`Backfill complete: ${linked} linked, ${heads} heads, ${slugsRetired} slugs retired`);
    return { linked, heads, slugsRetired };
  }

  /**
   * Ensure the tree has a slug (derived from the main family name) and the
   * owner has a username. Runs on write paths (layout save, sync, invitation).
   * With `write: false` it only resolves the identity — GET endpoints must
   * never mutate data.
   * Never throws — returns best-effort identity so layout operations stay stable.
   */
  private async ensureIdentity(
    tree: { id: string; slug: string | null; name: string; userId: string; layoutConfig: any },
    opts: { write?: boolean } = {},
  ) {
    const write = opts.write !== false;
    if (!write) return this.resolveIdentity(tree);
    let slug = tree.slug;
    const familyName = (tree.layoutConfig?.mainFamilyName as string) || tree.name || 'keluarga';
    const desiredBase = familyName.endsWith('-fam') ? familyName : `${familyName}-fam`;
    const sharedFamilySlug = tree.layoutConfig?.sharedFamilySlug as string | undefined;

    // Membership wins over everything: if this user belongs to a Family Node
    // anchored on another tree, that anchor's slug is their public page and we
    // must never mint a second one.
    const anchor = await this.getAnchorFor(tree.userId);
    const anchoredElsewhere = !!anchor && anchor.treeId !== tree.id && !!anchor.tree?.slug;
    // A user who heads their own Family Node keeps their own page. Without this
    // guard a wrongly-recorded anchor would silently retire every slug they try
    // to set, so the family page could never be recreated.
    const headsOwnNode = anchoredElsewhere ? await this.isFamilyNodeHead(tree.userId) : false;

    if (anchoredElsewhere && headsOwnNode) {
      this.logger.warn(
        `Tree ${tree.id} owner ${tree.userId} heads their own family node but is anchored to ${anchor!.treeId}; dropping the stale anchor`,
      );
      await this.prisma.familyNodeMember
        .deleteMany({ where: { userId: tree.userId, treeId: anchor!.treeId } })
        .catch((err) => this.logger.error(`Failed to drop stale anchor for ${tree.userId}: ${err}`));

      // The legacy marker points at the other household's page — clear it so a
      // fresh slug is minted below instead of adopting theirs.
      if (sharedFamilySlug) {
        await this.prisma.familyTree
          .update({
            where: { id: tree.id },
            data: { layoutConfig: { ...(tree.layoutConfig ?? {}), sharedFamilySlug: null } as any },
          })
          .catch((err) => this.logger.error(`Failed to clear stale sharedFamilySlug on tree ${tree.id}: ${err}`));
      }
    }

    if (anchoredElsewhere && !headsOwnNode) {
      if (slug && slug !== anchor!.tree!.slug) {
        await this.prisma.familyTree
          .update({ where: { id: tree.id }, data: { slug: null } })
          .catch((err) => this.logger.error(`Failed to retire duplicate slug on tree ${tree.id}: ${err}`));
        this.logger.log(`Retired duplicate slug "${slug}" on tree ${tree.id} (anchored to "${anchor!.tree!.slug}")`);
      }
      slug = anchor!.tree!.slug;
    } else if (!slug) {
      if (sharedFamilySlug && !headsOwnNode) {
        // Legacy path for data created before FamilyNodeMember existed.
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

  /** Read-only counterpart of ensureIdentity: same resolution rules, no writes. */
  private async resolveIdentity(tree: { id: string; slug: string | null; userId: string; layoutConfig: any }) {
    const sharedFamilySlug = tree.layoutConfig?.sharedFamilySlug as string | undefined;
    const anchor = await this.getAnchorFor(tree.userId);
    const anchoredElsewhere = !!anchor && anchor.treeId !== tree.id && !!anchor.tree?.slug;
    const headsOwnNode = anchoredElsewhere ? await this.isFamilyNodeHead(tree.userId) : false;

    let slug = tree.slug;
    if (anchoredElsewhere && !headsOwnNode) slug = anchor!.tree!.slug;
    else if (!slug && sharedFamilySlug && !headsOwnNode) slug = sharedFamilySlug;

    const ownerRow = await this.prisma.user
      .findUnique({ where: { id: tree.userId }, select: { name: true, username: true, avatar: true } })
      .catch(() => null);
    const owner = ownerRow ? { name: ownerRow.name, username: ownerRow.username, avatar: ownerRow.avatar } : null;
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
      // Never re-mint a slug for someone who belongs to another Family Node —
      // that is exactly how duplicate family pages were created.
      const anchor = await this.getAnchorFor(tree.userId);
      if (anchor && anchor.treeId !== tree.id) {
        // Unless they actually head their own node: an earlier bug could
        // demote a head into somebody else's node and wipe the slug their
        // household publishes on. Drop the bad anchor and recover.
        if (await this.isFamilyNodeHead(tree.userId)) {
          this.logger.log(
            `Dropping bad anchor ${anchor.treeId} for head ${tree.userId} and recovering slug for tree ${tree.id}`,
          );
          await this.prisma.familyNodeMember
            .deleteMany({ where: { userId: tree.userId, treeId: anchor.treeId } })
            .catch((err) => this.logger.error(`Failed to drop bad anchor for ${tree.userId}: ${err}`));
        } else {
          this.logger.log(`Skipping slug recovery for tree ${tree.id} (member of family node ${anchor.treeId})`);
          continue;
        }
      }

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
        const desiredBase = familyName.endsWith('-fam') ? familyName : `${familyName}-fam`;
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

  /**
   * Admin repair for data damaged by the old linking rules. Dry-run unless
   * `apply` is true; returns what was (or would be) changed.
   *
   * 1. `sharedFamilySlug` pointing at the tree's own household or at a slug
   *    that no longer exists → cleared.
   * 2. Non-head FamilyNodeMember rows whose circle in the anchor is NOT a
   *    household circle (parents, siblings… merged in by the old sync) or no
   *    longer links to that user → removed, and their legacy marker cleared.
   *    Their own slug can then be restored with POST /trees/recover-slugs.
   */
  async repairFamilyLinks(apply = false) {
    const report = {
      apply,
      clearedMarkers: [] as { treeId: string; sharedFamilySlug: string; reason: string }[],
      removedMemberships: [] as { userId: string; anchorTreeId: string; nodeId: string; reason: string }[],
    };

    const trees = await this.prisma.familyTree.findMany({
      select: { id: true, userId: true, slug: true, layoutConfig: true, layoutMembers: true },
    });
    const bySlug = new Map(trees.filter((t) => t.slug).map((t) => [t.slug!, t]));
    const byId = new Map(trees.map((t) => [t.id, t]));
    const markersToClear = new Map<string, string>();

    for (const t of trees) {
      const shared = (t.layoutConfig as any)?.sharedFamilySlug as string | undefined;
      if (!shared) continue;
      const target = bySlug.get(shared);
      const reason = !target ? 'slug tidak ada' : target.userId === t.userId ? 'menunjuk ke keluarga sendiri' : null;
      if (reason) {
        report.clearedMarkers.push({ treeId: t.id, sharedFamilySlug: shared, reason });
        markersToClear.set(t.id, reason);
      }
    }

    const memberships = await this.prisma.familyNodeMember.findMany({ where: { isHead: false } });
    for (const fm of memberships) {
      const anchor = byId.get(fm.treeId);
      if (!anchor || anchor.userId === fm.userId) continue;
      const layout = (anchor.layoutMembers as LayoutMembers) ?? {};
      const node = layout[fm.nodeId];
      const linksUser = node?.linkedUserId === fm.userId || node?.claimedByUserId === fm.userId;
      const reason = !linksUser
        ? 'lingkaran tidak lagi tertaut ke user ini'
        : !isHouseholdNode(fm.nodeId, layout)
          ? 'bukan anggota rumah tangga (orang tua/saudara/dll.)'
          : null;
      if (!reason) continue;
      report.removedMemberships.push({ userId: fm.userId, anchorTreeId: fm.treeId, nodeId: fm.nodeId, reason });
      for (const own of trees.filter((x) => x.userId === fm.userId)) {
        if ((own.layoutConfig as any)?.sharedFamilySlug && (own.layoutConfig as any).sharedFamilySlug === anchor.slug) {
          markersToClear.set(own.id, 'keanggotaan rumah tangga dihapus');
        }
      }
    }

    if (apply) {
      for (const fm of report.removedMemberships) {
        await this.prisma.familyNodeMember.deleteMany({ where: { userId: fm.userId, treeId: fm.anchorTreeId, isHead: false } });
      }
      for (const treeId of markersToClear.keys()) {
        const t = byId.get(treeId)!;
        await this.prisma.familyTree.update({
          where: { id: treeId },
          data: { layoutConfig: { ...((t.layoutConfig as any) ?? {}), sharedFamilySlug: null } as any },
        });
      }
      this.logger.log(
        `repairFamilyLinks applied: ${markersToClear.size} markers cleared, ${report.removedMemberships.length} memberships removed`,
      );
    }
    return report;
  }

  /** Get the saved explorer layout (config + members) for the current user. */
  async getLayout(userId: string) {
    // Read-only: merely opening /tree must not create a tree, mint slugs or
    // grant roles. The tree is created on the first save.
    const tree = await this.findDefaultTree(userId);
    if (!tree) {
      const anchor = await this.getAnchorFor(userId);
      return {
        treeId: null,
        slug: anchor?.tree?.slug ?? null,
        owner: null,
        config: null,
        members: null,
        updatedAt: null,
        isTreeOwner: true,
        connectedFamily: null,
        familyNode: anchor
          ? { treeId: anchor.treeId, nodeId: anchor.nodeId, role: anchor.role, slug: anchor.tree?.slug ?? null, isHead: false }
          : null,
      };
    }
    const identity = await this.ensureIdentity(tree, { write: false });

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
        // A marker pointing back at the user's own household is stale data, not a connection.
        if (inviterTree && inviterTree.userId !== userId) {
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

    // Explicit Family Node membership — tells the client which shared page this
    // user belongs to and which circle is theirs to edit.
    const anchor = await this.getAnchorFor(userId);
    const familyNode = anchor
      ? {
          treeId: anchor.treeId,
          nodeId: anchor.nodeId,
          role: anchor.role,
          slug: anchor.tree?.slug ?? null,
          isHead: anchor.tree?.userId === userId,
        }
      : null;

    return {
      treeId: tree.id,
      slug: familyNode?.slug ?? effectiveSlug,
      owner: identity.owner,
      config: tree.layoutConfig ?? null,
      members: tree.layoutMembers ?? null,
      updatedAt: tree.updatedAt,
      isTreeOwner,
      connectedFamily,
      familyNode,
    };
  }

  /** Manually create or update the family slug. */
  async setSlug(userId: string, desiredSlug?: string) {
    const tree = await this.getOrCreateDefaultTree(userId);
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat mengatur slug');
    }
    const familyName = (tree.layoutConfig as any)?.mainFamilyName || tree.name || 'keluarga';
    const base = desiredSlug?.trim() || (familyName.endsWith('-fam') ? familyName : `${familyName}-fam`);
    const slug = await this.uniqueTreeSlug(base, tree.id);
    await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
    this.logger.log(`Slug manually set to "${slug}" for tree ${tree.id}`);

    await this.propagateSlugToHousehold(tree.id, tree.userId, slug);

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

  /**
   * Point the legacy `sharedFamilySlug` marker of real household members (rows
   * in FamilyNodeMember for this anchor) at the new slug. Parents, siblings and
   * anyone who heads their own household are never touched, and their family
   * name is never overwritten.
   */
  private async propagateSlugToHousehold(anchorTreeId: string, headUserId: string, slug: string) {
    const memberships = await this.prisma.familyNodeMember.findMany({
      where: { treeId: anchorTreeId, userId: { not: headUserId } },
      select: { userId: true },
    });
    for (const { userId } of memberships) {
      try {
        if (await this.isFamilyNodeHead(userId)) continue;
        const own = await this.prisma.familyTree.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (!own || own.id === anchorTreeId) continue;
        const cfg = (own.layoutConfig as any) ?? {};
        await this.prisma.familyTree.update({
          where: { id: own.id },
          data: { layoutConfig: { ...cfg, sharedFamilySlug: slug } as any, slug: null },
        });
      } catch (err) {
        this.logger.error(`Failed to propagate slug to household member ${userId}: ${err}`);
      }
    }
  }

  /** Set slug on a specific tree (for Family Node page). */
  async setSlugForTree(treeId: string, userId: string, desiredSlug?: string, roles?: string[]) {
    const tree = await this.ensureTreeOwner(treeId, userId, roles);

    const config = (tree.layoutConfig as any) ?? {};
    if (!isAdmin(roles) && (await this.isHouseholdMemberElsewhere(tree))) {
      throw new ForbiddenException('Hanya kepala keluarga yang dapat mengatur slug Family Node ini');
    }

    const familyName = config.mainFamilyName || tree.name || 'keluarga';
    const base = desiredSlug?.trim() || (familyName.endsWith('-fam') ? familyName : `${familyName}-fam`);
    const slug = await this.uniqueTreeSlug(base, tree.id);
    await this.prisma.familyTree.update({ where: { id: tree.id }, data: { slug } });
    this.logger.log(`Slug set to "${slug}" for tree ${tree.id} (via Family Node page)`);

    await this.propagateSlugToHousehold(tree.id, tree.userId, slug);

    const owner = await this.prisma.user.findUnique({
      where: { id: tree.userId },
      select: { id: true, name: true, username: true, avatar: true },
    });
    return { slug, owner: owner ? { name: owner.name, username: owner.username, avatar: owner.avatar } : null };
  }

  /**
   * Persist the explorer layout (config + members) for the current user.
   *
   * Authority rules enforced here (see tree-layout.util):
   * - account links (`linkedUserId`) cannot be written directly; a new link
   *   becomes a NodeLinkRequest the target must approve;
   * - server-controlled fields (verified, earlyAccess, claims) keep their values;
   * - profile fields of a node linked to an ACTIVE account need a granted consent;
   * - `baseUpdatedAt` (optional) rejects stale writes with 409 instead of
   *   silently overwriting someone else's changes.
   * Nothing is written into other users' trees.
   */
  async saveLayout(userId: string, config: unknown, members: unknown, baseUpdatedAt?: string) {
    const tree = await this.getOrCreateDefaultTree(userId);

    // Only the tree owner can save layout changes.
    if (tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat menyimpan perubahan bagan');
    }
    if (baseUpdatedAt && new Date(baseUpdatedAt).getTime() !== tree.updatedAt.getTime()) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Silsilah telah diubah di tempat lain sejak terakhir dimuat. Muat ulang untuk menggabungkan perubahan.',
        updatedAt: tree.updatedAt,
      });
    }

    const oldMembers = (tree.layoutMembers as LayoutMembers) ?? {};
    let nextMembers: LayoutMembers | undefined;
    const linkRequests: { nodeId: string; userId: string }[] = [];
    let cancelledRequests: { nodeId: string; userId: string }[] = [];
    let unlinked: { nodeId: string; userId: string }[] = [];
    const protectedNodes: string[] = [];

    if (members && typeof members === 'object') {
      const res = sanitizeLayoutMembers(oldMembers, members as LayoutMembers, userId);
      if (res.errors.length) throw new BadRequestException(res.errors.join('; '));
      nextMembers = res.members;
      cancelledRequests = res.cancelledRequests;
      unlinked = res.unlinked;

      // Drop link wishes for accounts that do not exist.
      const wanted = [...new Set(res.linkRequests.map((r) => r.userId))];
      const existing = wanted.length
        ? new Set((await this.prisma.user.findMany({ where: { id: { in: wanted } }, select: { id: true } })).map((u) => u.id))
        : new Set<string>();
      for (const r of res.linkRequests) {
        if (existing.has(r.userId)) linkRequests.push(r);
        else delete nextMembers[r.nodeId]?.pendingLinkUserId;
      }

      // F2-05 — a circle may point at an existing Person ("sudah ada di
      // silsilah") only if that Person is in the owner's family neighbourhood,
      // has no account (accounts go through link requests), and is not
      // already used by another circle of this tree.
      const wantGraph = Object.entries(nextMembers).filter(
        ([id, m]) => m && typeof m === 'object' && m.graphPersonId && m.graphPersonId !== oldMembers[id]?.graphPersonId,
      );
      if (wantGraph.length) {
        const scope = await this.genealogy.scopeOf(userId);
        const accounts = new Set(
          (await this.prisma.person.findMany({
            where: { id: { in: wantGraph.map(([, m]) => m.graphPersonId as string) }, userId: { not: null } },
            select: { id: true },
          })).map((p) => p.id),
        );
        for (const [id, m] of wantGraph) {
          const pid = m.graphPersonId as string;
          const usedElsewhere = Object.entries(nextMembers).some(([other, o]) => other !== id && o?.graphPersonId === pid);
          if (!scope.has(pid) || accounts.has(pid) || usedElsewhere) {
            const prev = oldMembers[id]?.graphPersonId;
            if (prev) nextMembers[id] = { ...m, graphPersonId: prev };
            else { const { graphPersonId: _drop, ...rest } = m; nextMembers[id] = rest; }
          }
        }
      }

      // Profile of a person with an account belongs to them (F2-01 matrix):
      // only the account itself, a granted guardian consent, or the guardian
      // of an early-access account may change it directly.
      const linkedNodes = Object.entries(nextMembers).filter(
        ([id, m]) => m?.linkedUserId && m.linkedUserId !== userId && oldMembers[id]?.linkedUserId === m.linkedUserId
          && protectedFieldsChanged(oldMembers[id], m),
      );
      if (linkedNodes.length) {
        const ids = [...new Set(linkedNodes.map(([, m]) => m.linkedUserId as string))];
        const accounts = new Map(
          (await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, createdById: true } })).map((u) => [u.id, u]),
        );
        const granted = new Set(
          (await this.prisma.guardianConsent.findMany({
            where: { treeId: tree.id, requesterId: userId, status: 'GRANTED', targetUserId: { in: ids } },
            select: { nodeId: true, targetUserId: true },
          })).map((c) => `${c.nodeId}:${c.targetUserId}`),
        );
        for (const [id, m] of linkedNodes) {
          const account = accounts.get(m.linkedUserId);
          const verdict = decidePermission({ userId, roles: [] }, 'person.edit', {
            personId: id,
            accountUserId: m.linkedUserId,
            accountStatus: account?.status ?? null,
            accountCreatedById: account?.createdById ?? null,
            vitalStatus: m.alive === false ? 'DECEASED' : 'LIVING',
            mergedIntoId: null,
            stewards: [],
            actorHasConsent: granted.has(`${id}:${m.linkedUserId}`),
            inActorFamily: true,
          });
          if (account && verdict.decision !== 'DIRECT') {
            nextMembers[id] = revertProtectedFields(oldMembers[id], m);
            protectedNodes.push(id);
          }
        }
      }
    }

    const data = {
      ...(config !== undefined && { layoutConfig: config as any }),
      ...(nextMembers !== undefined && { layoutMembers: nextMembers as any }),
    };
    const written = await this.prisma.familyTree.updateMany({ where: { id: tree.id, updatedAt: tree.updatedAt }, data });
    if (written.count !== 1) {
      throw new ConflictException('Silsilah sedang diubah di tempat lain. Muat ulang lalu coba lagi.');
    }
    const updated = await this.prisma.familyTree.findUniqueOrThrow({ where: { id: tree.id } });
    const identity = await this.ensureIdentity(updated);
    this.graphSync.syncTreeInBackground(tree.id);

    await this.applyLinkChanges(tree.id, userId, (config as any)?.mainFamilyName || tree.name, {
      linkRequests,
      cancelledRequests,
      unlinked,
    });

    return {
      treeId: updated.id,
      slug: identity.slug,
      owner: identity.owner,
      config: updated.layoutConfig ?? null,
      members: updated.layoutMembers ?? null,
      updatedAt: updated.updatedAt,
      linkRequests: linkRequests.map((r) => ({ nodeId: r.nodeId, targetUserId: r.userId })),
      protectedNodes,
    };
  }

  /** Persist side effects of link changes made in a layout save. */
  private async applyLinkChanges(
    treeId: string,
    ownerId: string,
    familyName: string,
    changes: {
      linkRequests: { nodeId: string; userId: string }[];
      cancelledRequests: { nodeId: string; userId: string }[];
      unlinked: { nodeId: string; userId: string }[];
    },
  ) {
    for (const r of changes.cancelledRequests) {
      await this.prisma.nodeLinkRequest.updateMany({
        where: { treeId, nodeId: r.nodeId, targetUserId: r.userId, status: 'PENDING' },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
    }

    // Removing a person from the tree also removes them from this household.
    for (const u of changes.unlinked) {
      await this.prisma.familyNodeMember.deleteMany({ where: { treeId, userId: u.userId, isHead: false } });
    }

    if (!changes.linkRequests.length) return;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } });
    for (const r of changes.linkRequests) {
      await this.prisma.nodeLinkRequest.updateMany({
        where: { treeId, nodeId: r.nodeId, status: 'PENDING', targetUserId: { not: r.userId } },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
      const already = await this.prisma.nodeLinkRequest.findFirst({
        where: { treeId, nodeId: r.nodeId, targetUserId: r.userId, status: 'PENDING' },
      });
      const request = already ?? await this.prisma.nodeLinkRequest.create({
        data: { treeId, nodeId: r.nodeId, requesterId: ownerId, targetUserId: r.userId },
      });
      if (already) continue;

      this.notifications.create({
        userId: r.userId,
        type: 'MEMBER_ADDED' as any,
        title: 'Konfirmasi Hubungan Keluarga',
        message: `${owner?.name || 'Seseorang'} mengidentifikasi Anda sebagai anggota keluarga dalam silsilah "${familyName}". Hubungan baru tersambung setelah Anda menyetujuinya.`,
        data: { treeId, nodeId: r.nodeId, linkRequestId: request.id, action: 'link_request' },
      }).catch((err) => this.logger.error(`Failed to send link request notification: ${err.message}`));
      this.notifications.sendPushSafe(
        r.userId,
        'Konfirmasi Keluarga',
        `${owner?.name || 'Seseorang'} mengidentifikasi Anda sebagai anggota keluarganya`,
      ).catch(() => {});
    }
  }

  // ─── LINK REQUESTS (target confirms "this circle is me") ───

  async getIncomingLinkRequests(userId: string) {
    const requests = await this.prisma.nodeLinkRequest.findMany({
      where: { targetUserId: userId, status: 'PENDING' },
      include: { tree: { select: { id: true, name: true, slug: true, userId: true, layoutMembers: true, layoutConfig: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const requesterIds = [...new Set(requests.map((r) => r.requesterId))];
    const requesters = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, avatar: true } }))
        .map((u) => [u.id, u]),
    );
    return requests.map((r) => {
      const node = ((r.tree.layoutMembers as LayoutMembers) ?? {})[r.nodeId] ?? {};
      return {
        id: r.id,
        treeId: r.treeId,
        treeName: (r.tree.layoutConfig as any)?.mainFamilyName || r.tree.name,
        nodeId: r.nodeId,
        nodeName: node.name ?? r.nodeId,
        nodeRole: node.role ?? null,
        requester: requesters.get(r.requesterId) ?? null,
        createdAt: r.createdAt,
      };
    });
  }

  /** The target account approves or rejects being linked to a circle. */
  async respondLinkRequest(userId: string, requestId: string, approve: boolean) {
    const request = await this.prisma.nodeLinkRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Permintaan tidak ditemukan');
    if (request.targetUserId !== userId) throw new ForbiddenException('Hanya orang yang ditautkan yang dapat merespons');
    if (request.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah direspons');

    let stale = false;
    const updated = await this.updateLayoutAtomically(request.treeId, (_tree, layout) => {
      const node = layout[request.nodeId];
      if (!node || node.pendingLinkUserId !== userId) {
        stale = true;
        return layout;
      }
      const next = { ...node };
      delete next.pendingLinkUserId;
      if (approve) {
        const elsewhere = Object.entries(layout).find(
          ([id, m]) => id !== request.nodeId && (m?.linkedUserId === userId || m?.claimedByUserId === userId),
        );
        if (elsewhere) {
          throw new ConflictException(`Anda sudah terhubung di lingkaran lain pada silsilah ini ("${elsewhere[0]}")`);
        }
        next.linkedUserId = userId;
        next.verified = true;
      }
      return { ...layout, [request.nodeId]: next };
    });

    if (stale) {
      await this.prisma.nodeLinkRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', respondedAt: new Date() } });
      throw new BadRequestException('Permintaan ini sudah tidak berlaku (lingkaran telah diubah pemilik silsilah)');
    }

    await this.prisma.nodeLinkRequest.update({
      where: { id: requestId },
      data: { status: approve ? 'APPROVED' : 'REJECTED', respondedAt: new Date() },
    });

    const responder = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    this.notifications.create({
      userId: request.requesterId,
      type: 'MEMBER_ADDED' as any,
      title: approve ? 'Hubungan Keluarga Dikonfirmasi' : 'Hubungan Keluarga Ditolak',
      message: `${responder?.name || 'Pengguna'} ${approve ? 'mengonfirmasi' : 'menolak'} sebagai anggota keluarga pada lingkaran "${request.nodeId}".`,
      data: { treeId: request.treeId, nodeId: request.nodeId, linkRequestId: requestId, approved: approve },
    }).catch(() => {});

    if (!approve) return { id: requestId, status: 'REJECTED' };

    const attached = await this.attachLinkedUser(updated, request.nodeId, { firstLink: true });
    return { id: requestId, status: 'APPROVED', ...attached };
  }

  // ─── SYNC LINKED USER INFO ──────────────────────────────────

  /** Re-sync avatar and info from an already linked (approved) account into the member node. */
  async syncLinkedUser(userId: string, nodeId: string) {
    const tree = await this.findDefaultTree(userId);
    if (!tree || tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik pohon yang dapat menyinkronkan');
    }

    const member = ((tree.layoutMembers as LayoutMembers) ?? {})[nodeId];
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');
    if (!member.linkedUserId) {
      throw new BadRequestException(
        member.pendingLinkUserId
          ? 'Menunggu persetujuan dari pemilik akun sebelum dapat disinkronkan'
          : 'Anggota ini belum terhubung dengan user manapun',
      );
    }

    return this.attachLinkedUser(tree, nodeId, { firstLink: false });
  }

  /**
   * Copy the linked account's profile into its circle and, ONLY for household
   * circles (spouse/children), attach the account to this Family Node.
   *
   * Parents, siblings, uncles … are linked for identity only: they keep their
   * own household page and slug. This is what prevents two siblings who add
   * each other from being merged into one household (and retiring a page).
   */
  private async attachLinkedUser(
    tree: { id: string; userId: string },
    nodeId: string,
    opts: { firstLink: boolean },
  ) {
    const linkedUserId = ((await this.prisma.familyTree.findUniqueOrThrow({ where: { id: tree.id } })).layoutMembers as LayoutMembers)?.[nodeId]?.linkedUserId;
    const linkedUser = linkedUserId
      ? await this.prisma.user.findUnique({
        where: { id: linkedUserId },
        select: { id: true, name: true, avatar: true, email: true, phone: true },
      })
      : null;
    if (!linkedUser) throw new NotFoundException('User terhubung tidak ditemukan');

    const updated = await this.updateLayoutAtomically(tree.id, (_t, layout) => {
      const member = layout[nodeId] ?? {};
      return {
        ...layout,
        [nodeId]: {
          ...member,
          name: linkedUser.name || member.name,
          photo: linkedUser.avatar || member.photo || null,
          email: linkedUser.email || member.email || '',
          phone: linkedUser.phone || member.phone || '',
          verified: true,
        },
      };
    });
    const identity = await this.ensureIdentity(updated);
    const layout = (updated.layoutMembers as LayoutMembers) ?? {};

    let joinedFamilyNode = false;
    let linkedTreeSlug: string | null = null;
    if (isHouseholdNode(nodeId, layout)) {
      try {
        joinedFamilyNode = await this.joinFamilyNode(
          tree.id,
          linkedUser.id,
          nodeId,
          nodeId.startsWith('spouse') ? 'spouse' : nodeId.startsWith('child') ? 'child' : 'member',
        );

        // Keep the legacy marker in sync for code paths not yet migrated —
        // but never on the anchor itself and never pointing a tree at itself.
        const linkedTree = await this.prisma.familyTree.findFirst({
          where: { userId: linkedUser.id },
          orderBy: { createdAt: 'asc' },
        });
        if (joinedFamilyNode && identity.slug && linkedTree && linkedTree.id !== tree.id && linkedTree.slug !== identity.slug) {
          const linkedConfig = (linkedTree.layoutConfig as any) ?? {};
          await this.prisma.familyTree.update({
            where: { id: linkedTree.id },
            data: { layoutConfig: { ...linkedConfig, sharedFamilySlug: identity.slug } as any },
          });
          linkedTreeSlug = identity.slug;
        }
      } catch (err) {
        this.logger.error(`Failed to attach linked user ${linkedUser.id} to family node ${tree.id}: ${err}`);
      }
    }

    if (opts.firstLink) {
      this.gamification.awardNetworkAddPoints(tree.userId, linkedUser.id).catch((err) => {
        this.logger.error(`Failed to award network_add points: ${err}`);
      });
    }

    return {
      treeId: updated.id,
      slug: identity.slug,
      nodeId,
      member: layout[nodeId],
      joinedFamilyNode,
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

  /** Fields worth carrying across trees for display on the public page. */
  private static readonly PROJECTED_MEMBER_FIELDS = [
    'name',
    'publicName',
    'statusLabel',
    'gender',
    'alive',
    'photo',
    'verified',
    'username',
    'linkedUserId',
    'familyConfig',
  ] as const;

  /**
   * Copy a linked person's own ancestry records onto the shared layout using
   * namespaced ids (`older-0` in the wife's tree becomes `spouse-0-older-0` on
   * the husband's public page), which is what the public renderer looks up.
   *
   * Records already present on the shared layout win field-by-field, so a name
   * typed directly on the family page is never clobbered by hydration.
   *
   * Only `self`, `spouse-*` and `child-*` keys are skipped by ANCESTRY_KEY_RE
   * (they describe the shared household itself). Records linked to accounts
   * already drawn on the anchor (`excludeUserIds`) are skipped too, so nobody
   * appears twice — e.g. a husband listed in his wife's tree.
   */
  private projectAncestryRecords(
    out: Record<string, any>,
    nodeId: string,
    ownLayout: Record<string, any>,
    excludeUserIds: Set<string>,
  ): number {
    let projected = 0;

    for (const [ownKey, ownMember] of Object.entries(ownLayout)) {
      if (!ANCESTRY_KEY_RE.test(ownKey)) continue;
      if (!ownMember || typeof ownMember !== 'object') continue;
      const ownUid = (ownMember as any).linkedUserId || (ownMember as any).claimedByUserId;
      if (ownUid && excludeUserIds.has(ownUid)) continue;

      const targetKey = `${nodeId}-${ownKey}`;
      const incoming: Record<string, any> = {};
      for (const field of TreeService.PROJECTED_MEMBER_FIELDS) {
        const v = (ownMember as Record<string, any>)[field];
        if (v !== undefined && v !== null && v !== '') incoming[field] = v;
      }
      if (Object.keys(incoming).length === 0) continue;

      // Existing values on the shared page take precedence.
      const existing = (out[targetKey] as Record<string, any>) ?? {};
      const merged: Record<string, any> = { ...incoming };
      for (const [k, v] of Object.entries(existing)) {
        if (v !== undefined && v !== null && v !== '') merged[k] = v;
      }

      out[targetKey] = merged;
      projected += 1;
    }

    return projected;
  }

  /**
   * Cross-tree hydration.
   *
   * A person's ancestry (parents, siblings, grandparents) is the source of
   * truth in THEIR OWN tree — not in the tree that happens to own the public
   * slug. Without this step the renderer falls back to the slug owner's counts,
   * so a wife with 6 siblings would make her husband appear to have 6 too.
   *
   * For every layout node linked to a real account we read that account's own
   * tree config and project it onto the node as `familyConfig`, limited by
   * `projectionScope`: only people who married in bring their own ancestry;
   * blood relatives (siblings, children, parents) share the anchor's ancestry,
   * so projecting theirs would draw the same parents twice.
   */
  private async hydrateLinkedFamilyConfigs(
    layoutMembers: unknown,
    anchorTreeId: string,
    anchorOwnerId: string,
  ): Promise<Record<string, any>> {
    const layout = (layoutMembers as Record<string, any>) ?? {};

    const excludeUserIds = new Set<string>([anchorOwnerId]);
    const nodesByUser = new Map<string, string[]>();
    for (const [nodeId, m] of Object.entries(layout)) {
      const uid = m?.linkedUserId || m?.claimedByUserId;
      if (uid) excludeUserIds.add(uid);
      if (nodeId === 'self') continue; // the anchor owner already drives the root config
      if (!uid || uid === anchorOwnerId) continue;
      const list = nodesByUser.get(uid) ?? [];
      list.push(nodeId);
      nodesByUser.set(uid, list);
    }
    if (nodesByUser.size === 0) return layout;

    const trees = await this.prisma.familyTree
      .findMany({
        where: { userId: { in: [...nodesByUser.keys()] }, id: { not: anchorTreeId } },
        select: { userId: true, layoutConfig: true, layoutMembers: true },
        orderBy: { createdAt: 'asc' },
      })
      .catch((err) => {
        this.logger.error(`Cross-tree hydration failed: ${err}`);
        return [] as { userId: string; layoutConfig: any; layoutMembers: any }[];
      });

    // First tree per user wins (their oldest / primary tree).
    const configByUser = new Map<string, any>();
    const membersByUser = new Map<string, any>();
    for (const t of trees) {
      if (!configByUser.has(t.userId)) configByUser.set(t.userId, t.layoutConfig ?? {});
      if (!membersByUser.has(t.userId)) membersByUser.set(t.userId, t.layoutMembers ?? {});
    }

    const out: Record<string, any> = { ...layout };
    for (const [uid, nodeIds] of nodesByUser) {
      const ownLayout = (membersByUser.get(uid) as Record<string, any>) ?? {};

      for (const nodeId of nodeIds) {
        const scope = projectionScope(nodeId, layout[nodeId]);
        if (scope === 'none') continue;
        const derived = projectFamilyConfig(configByUser.get(uid) ?? {}, scope);
        if (derived) {
          out[nodeId] = {
            ...out[nodeId],
            familyConfig: { ...(out[nodeId]?.familyConfig ?? {}), ...derived },
          };
        }

        // Counts alone only draw empty bubbles with generic labels ("Kakak 1").
        // Project the person's real ancestry records so their parents, siblings
        // and grandparents show their actual names on the shared public page.
        if (scope !== 'full') continue;
        const count = this.projectAncestryRecords(out, nodeId, ownLayout, excludeUserIds);
        if (count > 0) {
          this.logger.debug(`Hydrated ${count} ancestry records for node "${nodeId}" from user ${uid}`);
        }
      }
    }
    return out;
  }

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

    // Public reads never mutate data. Slugs wiped by old bugs are restored by
    // the admin endpoint POST /trees/recover-slugs, not on page view.
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');
    const mainFamilyName = (tree.layoutConfig as any)?.mainFamilyName as string | undefined;
    const members = await this.hydrateLinkedFamilyConfigs(tree.layoutMembers, tree.id, tree.userId);
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
      members,
      owner: tree.user,
      updatedAt: tree.updatedAt,
    };
  }

  /**
   * A logged-in user claims an unclaimed node on someone else's public
   * family tree (via the "Apakah ini Anda?" flow). Creates a PENDING
   * NodeClaim record and notifies the tree owner (super_user) for approval.
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

    // Don't allow claiming your own tree's nodes
    if (tree.userId === userId) {
      throw new BadRequestException('Anda tidak dapat mengklaim node di pohon Anda sendiri');
    }

    const members = { ...((tree.layoutMembers as any) ?? {}) } as Record<string, any>;
    const existing = members[nodeId] ?? {};

    if (existing.verified && existing.claimedByUserId && existing.claimedByUserId !== userId) {
      throw new ConflictException('Bagian silsilah ini sudah diklaim oleh orang lain');
    }

    // Check for existing pending claim by same user on same node
    const existingClaim = await this.prisma.nodeClaim.findFirst({
      where: { treeId: tree.id, nodeId, claimantId: userId, status: 'PENDING' },
    });
    if (existingClaim) {
      throw new ConflictException('Anda sudah memiliki klaim tertunda untuk node ini');
    }

    const claimant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, email: true, phone: true, avatar: true },
    });
    if (!claimant) throw new NotFoundException('User tidak ditemukan');

    const nodeName = existing.name || nodeId;

    // Create pending claim
    const claim = await this.prisma.nodeClaim.create({
      data: {
        treeId: tree.id,
        nodeId,
        claimantId: userId,
        status: 'PENDING',
      },
    });

    // Notify the tree owner (super_user)
    await this.notifications.create({
      userId: tree.userId,
      type: 'NODE_CLAIM' as any,
      title: 'Klaim Node Baru',
      message: `${claimant.name} mengklaim node "${nodeName}" di pohon keluarga "${tree.name}".`,
      data: { claimId: claim.id, treeId: tree.id, nodeId, nodeName, claimantName: claimant.name },
    });
    this.notifications.sendPushSafe(
      tree.userId,
      'Klaim Node Baru',
      `${claimant.name} mengklaim node "${nodeName}" di "${tree.name}"`,
    );

    return {
      claimId: claim.id,
      status: 'PENDING',
      message: 'Klaim Anda telah dikirim. Pemilik pohon akan meninjau dan menyetujui klaim Anda.',
    };
  }

  /** Tree owner: list all claims on the trees they own (ownership, not a role, grants access). */
  async getPendingClaims(userId: string, _roles: string[]) {
    const trees = await this.prisma.familyTree.findMany({
      where: { userId },
      select: { id: true, name: true, slug: true, layoutMembers: true },
    });
    const treeIds = trees.map((t) => t.id);
    const treeMap = new Map(trees.map((t) => [t.id, t]));

    const claims = await this.prisma.nodeClaim.findMany({
      where: { treeId: { in: treeIds } },
      include: {
        claimant: { select: { id: true, name: true, username: true, email: true, phone: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c) => {
      const tree = treeMap.get(c.treeId);
      const layout = (tree?.layoutMembers as Record<string, any>) ?? {};
      const node = layout[c.nodeId] ?? {};
      return {
        id: c.id,
        treeId: c.treeId,
        treeName: tree?.name ?? '',
        treeSlug: tree?.slug ?? null,
        nodeId: c.nodeId,
        nodeName: node.name ?? c.nodeId,
        nodeRole: node.role ?? node.group ?? null,
        nodeGender: node.gender ?? null,
        status: c.status,
        note: c.note,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
        claimant: c.claimant,
      };
    });
  }

  /** Tree owner (or admin): approve or reject a pending claim on their tree. */
  async respondToClaim(claimId: string, userId: string, roles: string[], approve: boolean) {
    const claim = await this.prisma.nodeClaim.findUnique({
      where: { id: claimId },
      include: { tree: true },
    });
    if (!claim) throw new NotFoundException('Klaim tidak ditemukan');
    if (claim.status !== 'PENDING') throw new BadRequestException('Klaim ini sudah ditanggapi');

    if (claim.tree.userId !== userId && !isAdmin(roles)) {
      throw new ForbiddenException('Anda tidak memiliki akses untuk menanggapi klaim ini');
    }

    const newStatus = approve ? 'APPROVED' : 'REJECTED';

    if (approve) {
      // Link the node to the claimant — one account per circle, one circle per account.
      await this.updateLayoutAtomically(claim.treeId, (_t, layout) => {
        const existing = layout[claim.nodeId] ?? {};
        const owner = existing.linkedUserId || existing.claimedByUserId;
        if (owner && owner !== claim.claimantId) {
          throw new ConflictException('Lingkaran ini sudah terhubung dengan akun lain');
        }
        const elsewhere = Object.entries(layout).find(
          ([id, m]) => id !== claim.nodeId && (m?.linkedUserId === claim.claimantId || m?.claimedByUserId === claim.claimantId),
        );
        if (elsewhere) {
          throw new ConflictException(`Pengklaim sudah terhubung di lingkaran lain ("${elsewhere[0]}")`);
        }
        return { ...layout, [claim.nodeId]: { ...existing, verified: true, claimedByUserId: claim.claimantId } };
      });
    }

    await this.prisma.nodeClaim.update({
      where: { id: claimId },
      data: { status: newStatus, responderId: userId, respondedAt: new Date() },
    });

    // Notify the claimant of the result
    const nodeName = (claim.tree.layoutMembers as any)?.[claim.nodeId]?.name ?? claim.nodeId;
    await this.notifications.create({
      userId: claim.claimantId,
      type: 'CLAIM_RESULT' as any,
      title: approve ? 'Klaim Disetujui' : 'Klaim Ditolak',
      message: approve
        ? `Klaim Anda terhadap node "${nodeName}" di "${claim.tree.name}" telah disetujui.`
        : `Klaim Anda terhadap node "${nodeName}" di "${claim.tree.name}" ditolak.`,
      data: { claimId, approved: approve, treeId: claim.treeId, nodeId: claim.nodeId, nodeName },
    });
    this.notifications.sendPushSafe(
      claim.claimantId,
      approve ? 'Klaim Disetujui' : 'Klaim Ditolak',
      approve
        ? `Klaim node "${nodeName}" disetujui.`
        : `Klaim node "${nodeName}" ditolak.`,
    );

    return { claimId, status: newStatus, message: approve ? 'Klaim disetujui' : 'Klaim ditolak' };
  }

  /** User: list their own claims with statuses. */
  async getMyClaims(userId: string) {
    const claims = await this.prisma.nodeClaim.findMany({
      where: { claimantId: userId },
      include: {
        tree: { select: { id: true, name: true, slug: true, layoutMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c) => {
      const layout = (c.tree.layoutMembers as Record<string, any>) ?? {};
      const node = layout[c.nodeId] ?? {};
      return {
        id: c.id,
        treeId: c.treeId,
        treeName: c.tree.name,
        treeSlug: c.tree.slug,
        nodeId: c.nodeId,
        nodeName: node.name ?? c.nodeId,
        status: c.status,
        createdAt: c.createdAt,
        respondedAt: c.respondedAt,
      };
    });
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
        name: node?.publicName || user.name,
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

  /** Public personal-profile page resolved by username only (no family slug needed). */
  async getPublicProfileByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, avatar: true, bio: true, status: true, createdAt: true, birthDate: true, birthPlace: true, education: true, occupation: true, hobbies: true },
    });
    if (!user) throw new NotFoundException('Profil tidak ditemukan');

    // Find the family tree this user belongs to.
    // First check if they own a tree, otherwise find a tree where they're a linked/claimed member.
    let tree = await this.prisma.familyTree.findFirst({
      where: { userId: user.id },
      select: { id: true, slug: true, name: true, layoutConfig: true, layoutMembers: true, userId: true },
    });

    let isOwner = !!tree;
    let nodeId: string | null = null;
    let node: any = null;

    if (tree) {
      nodeId = 'self';
      node = (tree.layoutMembers as any)?.['self'] ?? null;
    } else {
      // Search all trees for a layout member linked to this user
      const allTrees = await this.prisma.familyTree.findMany({
        select: { id: true, slug: true, name: true, layoutConfig: true, layoutMembers: true, userId: true },
      });
      for (const t of allTrees) {
        const members = (t.layoutMembers as any) ?? {};
        const foundNodeId = this.findLayoutNodeForUser(members, user.id);
        if (foundNodeId) {
          tree = t;
          nodeId = foundNodeId;
          node = members[foundNodeId] ?? null;
          break;
        }
      }
    }

    if (!tree) throw new NotFoundException('Profil tidak ditemukan di keluarga mana pun');

    return {
      family: { slug: tree.slug, name: (tree.layoutConfig as any)?.mainFamilyName || tree.name },
      profile: {
        name: node?.publicName || user.name,
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

    // Explicit Family Node membership (one family = one slug).
    const nodeMember = await this.prisma.familyNodeMember
      .findFirst({ where: { treeId: tree.id, userId }, select: { id: true } })
      .catch(() => null);
    if (nodeMember) return true;

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

  /** Validate a public link token by username only (no slug needed). */
  async validatePublicLinkTokenByUsername(token: string, username?: string): Promise<boolean> {
    const record = await this.prisma.publicLinkToken.findUnique({ where: { token } });
    if (!record) throw new ForbiddenException('Token link publik tidak valid');
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
    const tree = await this.findDefaultTree(userId);
    if (!tree) return [];
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

    this.graphSync.syncTreeInBackground(treeId);
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

    this.graphSync.syncTreeInBackground(treeId);
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
    this.graphSync.syncTreeInBackground(treeId);
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

  /**
   * Onboarding flow: user found a family member via search and wants to connect.
   * Creates an invitation with the relationship info and notifies the target user.
   * The target user can accept/reject the connection from their notifications.
   */
  async requestFamilyConnection(
    userId: string,
    targetUserId: string,
    relationship: string,
    note?: string,
  ) {
    const tree = await this.getOrCreateDefaultTree(userId);
    const requester = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, email: true, phone: true } });

    if (!target) throw new NotFoundException('Pengguna tidak ditemukan');
    if (targetUserId === userId) throw new BadRequestException('Tidak bisa menghubungkan ke diri sendiri');

    // Check for existing pending invitation to this user for this tree
    const existing = await this.prisma.treeInvitation.findFirst({
      where: { treeId: tree.id, email: target.email ?? undefined, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('Permintaan koneksi sudah dikirim sebelumnya');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for connection requests

    const invitation = await this.prisma.treeInvitation.create({
      data: {
        treeId: tree.id,
        email: target.email,
        phone: target.phone,
        nodeId: relationship, // Store relationship type here for connection requests
        message: note || `Saya adalah ${relationship} Anda. Yuk verifikasi koneksi keluarga kita.`,
        token,
        expiresAt,
      },
    });

    // Notify the target user. `relationship` is the requester's own role
    // ("Anda adalah apa bagi X?"), so the label is used as-is.
    const RELATIONSHIP_LABELS: Record<string, string> = {
      'anak': 'anak',
      'pasangan': 'pasangan (suami/istri)',
      'ayah': 'ayah',
      'ibu': 'ibu',
      'orangtua': 'orang tua',
      'saudara': 'saudara (kakak/adik)',
      'kakek-nenek': 'kakek/nenek',
      'cucu': 'cucu',
      'paman-bibi': 'paman/bibi',
      'keponakan': 'keponakan',
    };
    const relLabel = RELATIONSHIP_LABELS[relationship] || relationship;

    this.notifications.create({
      userId: target.id,
      type: 'TREE_INVITATION' as any,
      title: 'Permintaan Koneksi Keluarga',
      message: `${requester?.name || 'Seseorang'} mengklaim sebagai ${relLabel} Anda. Periksa dan konfirmasi koneksi ini.`,
      data: { invitationId: invitation.id, token, treeId: tree.id, relationship },
    }).catch(() => {});
    this.notifications.sendPushSafe(
      target.id,
      'Permintaan Koneksi Keluarga',
      `${requester?.name || 'Seseorang'} mengklaim sebagai ${relLabel} Anda`,
    ).catch(() => {});

    return { message: 'Permintaan koneksi dikirim. Anda dapat melanjutkan sambil menunggu konfirmasi.', invitationId: invitation.id };
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
    this.graphSync.syncTreeInBackground(tree.id);

    // Notify tree owner that invitation was accepted
    this.notifications.create({
      userId: tree.userId,
      type: 'MEMBER_ADDED' as any,
      title: 'Anggota Baru Bergabung',
      message: `${user.name} telah menerima undangan dan bergabung ke silsilah "${tree.name}".`,
      data: { treeId: tree.id, memberId: member.id, userId },
    }).catch(() => {});
    this.notifications.sendPushSafe(tree.userId, 'Anggota Baru', `${user.name} bergabung ke silsilah Anda`).catch(() => {});

    // An invitation for a specific circle: accepting it IS the target's consent,
    // so link the accepter to that circle (if it is still free).
    const invitedNode = invitation.nodeId
      ? ((tree.layoutMembers as LayoutMembers) ?? {})[invitation.nodeId]
      : undefined;
    if (invitation.nodeId && invitedNode && invitation.nodeId !== 'self') {
      try {
        let linked = false;
        const updated = await this.updateLayoutAtomically(tree.id, (_t, layout) => {
          const node = layout[invitation.nodeId!];
          const taken = node?.linkedUserId || node?.claimedByUserId;
          const elsewhere = Object.entries(layout).some(
            ([id, m]) => id !== invitation.nodeId && (m?.linkedUserId === userId || m?.claimedByUserId === userId),
          );
          if (!node || (taken && taken !== userId) || elsewhere || userId === tree.userId) return layout;
          linked = true;
          const next: Record<string, any> = { ...node, linkedUserId: userId, verified: true };
          delete next.pendingLinkUserId;
          return { ...layout, [invitation.nodeId!]: next };
        });
        if (linked) await this.attachLinkedUser(updated, invitation.nodeId, { firstLink: true });
      } catch (err) {
        this.logger.error(`Failed to link accepter ${userId} to node ${invitation.nodeId}: ${err}`);
      }
      return { message: 'Undangan diterima', member, treeId: tree.id, slug: identity.slug };
    }

    // Connection request: `nodeId` holds the requester's relationship instead.
    const relationship = invitation.nodeId;
    if (relationship && relationship !== 'self') {
      try {
        await this.syncConnectedTree(userId, tree, relationship);
        this.logger.log(`Synced tree for user ${userId} as "${relationship}" of tree ${tree.id}`);
      } catch (err) {
        this.logger.error(`Failed to sync connected tree: ${err}`);
      }
    }

    return { message: 'Undangan diterima', member, treeId: tree.id, slug: identity.slug };
  }

  /**
   * Seed the accepter's tree from an accepted connection request.
   *
   * `relationship` is the INVITER's role towards the accepter (the request form
   * asks "Anda adalah apa bagi X?"). The accepter's tree is only seeded when it
   * is still empty — an existing tree is never overwritten; the accepter is
   * notified to add the inviter themselves instead. Third-party account links
   * are never copied, and the accepter only joins the inviter's household when
   * they are the inviter's spouse or (unmarried) child.
   */
  private async syncConnectedTree(
    accepterId: string,
    inviterTree: { id: string; userId: string; name: string; layoutConfig: any; layoutMembers: any },
    relationship: string,
  ) {
    const accepter = await this.prisma.user.findUnique({
      where: { id: accepterId },
      select: { id: true, name: true, avatar: true },
    });
    if (!accepter) return;

    const existing = await this.prisma.familyTree.findFirst({ where: { userId: accepterId }, orderBy: { createdAt: 'asc' } });
    const inviterName = ((inviterTree.layoutMembers as LayoutMembers) ?? {}).self?.name || 'Pengundang';

    if (existing && !isLayoutEmpty(existing.layoutConfig, existing.layoutMembers)) {
      this.notifications.create({
        userId: accepterId,
        type: 'SYSTEM' as any,
        title: 'Tambahkan ke silsilah Anda',
        message: `Koneksi dengan ${inviterName} diterima. Silsilah Anda sudah berisi data, jadi tidak diubah otomatis — tambahkan ${inviterName} ke lingkaran yang sesuai di /tree.`,
        data: { kind: 'CONNECTION_ACCEPTED', inviterTreeId: inviterTree.id, relationship },
      }).catch(() => {});
      this.logger.log(`Connection accepted by ${accepterId}: existing tree ${existing.id} left untouched`);
      return;
    }

    const built = buildConnectedLayout({
      relationship,
      inviterUserId: inviterTree.userId,
      inviterConfig: (inviterTree.layoutConfig as Record<string, any>) ?? {},
      inviterMembers: (inviterTree.layoutMembers as LayoutMembers) ?? {},
      accepter,
    });
    if (!built) {
      this.logger.log(`Connection "${relationship}" accepted by ${accepterId}: placement left to the user`);
      return;
    }

    const accepterTree = existing ?? (await this.getOrCreateOwnedTree(accepterId));
    await this.prisma.familyTree.update({
      where: { id: accepterTree.id },
      data: {
        layoutConfig: { ...((accepterTree.layoutConfig as any) ?? {}), ...built.config, sharedFamilySlug: null } as any,
        layoutMembers: built.members as any,
      },
    });
    this.graphSync.syncTreeInBackground(accepterTree.id);

    if (built.joinsInviterHousehold) {
      await this.joinFamilyNode(
        inviterTree.id,
        accepterId,
        built.inviterSideNodeId ?? 'self',
        relationship === 'pasangan' ? 'spouse' : 'child',
      ).catch((err) => this.logger.error(`Failed to join family node: ${err}`));
    }
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

    // The role alone is not enough: only the owner of THIS tree may create accounts for its members.
    const tree = await this.ensureTreeOwner(treeId, userId, roles);

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

    // A username is what makes /id/{username} resolvable, so every
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
        createdById: tree.userId,
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
    this.graphSync.syncTreeInBackground(treeId);

    return {
      message: 'Early access berhasil dibuat',
      publicProfileUrl: `/id/${newUser.username}`,
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

    const tree = await this.findDefaultTree(userId);
    if (!tree || tree.userId !== userId) {
      throw new ForbiddenException('Hanya pemilik silsilah yang dapat membuat early access');
    }

    const members = (tree.layoutMembers as Record<string, any>) ?? {};
    const member = members[nodeId];
    if (!member) throw new NotFoundException('Node tidak ditemukan dalam silsilah');

    if (member.linkedUserId || member.claimedByUserId) {
      throw new BadRequestException('Node ini sudah memiliki akun terhubung');
    }
    if (member.pendingLinkUserId) {
      throw new BadRequestException('Node ini sedang menunggu konfirmasi dari akun yang ditautkan');
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

    // A username is what makes /id/{username} resolvable, so every
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
        createdById: userId,
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
    await this.updateLayoutAtomically(tree.id, (_t, layout) => ({
      ...layout,
      [nodeId]: {
        ...layout[nodeId],
        linkedUserId: newUser.id,
        earlyAccess: true,
        username,
        email,
        phone: phone || layout[nodeId]?.phone || null,
      },
    }));

    return {
      message: 'Early access berhasil dibuat',
      nodeId,
      publicProfileUrl: `/id/${username}`,
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

  /**
   * Read-modify-write of `layoutMembers` with compare-and-swap on `updatedAt`,
   * so concurrent writers (head, slice members, approvals) never silently
   * overwrite each other. Retries a few times before giving up with 409.
   */
  private async updateLayoutAtomically(
    treeId: string,
    mutate: (tree: Awaited<ReturnType<PrismaService['familyTree']['findUniqueOrThrow']>>, layout: LayoutMembers) => LayoutMembers,
    attempts = 3,
  ) {
    for (let i = 0; i < attempts; i++) {
      const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
      if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');
      const next = mutate(tree, { ...((tree.layoutMembers as LayoutMembers) ?? {}) });
      const res = await this.prisma.familyTree.updateMany({
        where: { id: treeId, updatedAt: tree.updatedAt },
        data: { layoutMembers: next as any },
      });
      if (res.count === 1) {
        this.graphSync.syncTreeInBackground(treeId);
        return this.prisma.familyTree.findUniqueOrThrow({ where: { id: treeId } });
      }
    }
    throw new ConflictException('Silsilah sedang diubah oleh orang lain. Silakan coba lagi.');
  }

  /**
   * Only the tree owner (or a platform admin) may manage a tree. `super_user`
   * is a capability tier for one's OWN trees, never a cross-tree bypass.
   */
  private async ensureTreeOwner(treeId: string, userId: string, roles?: string[]) {
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) throw new NotFoundException('Pohon keluarga tidak ditemukan');
    if (tree.userId !== userId && !isAdmin(roles)) {
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

    const users = await this.prisma.user.findMany({
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
    });

    return {
      users: users.map((u) => ({ ...u, type: 'user' as const })),
      families: [],
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
