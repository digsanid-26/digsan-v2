import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import type { Db } from './graph.repository';
import { GenealogyService } from './genealogy.service';
import { approversFor, decide, type Action, type Actor, type PermissionResult, type PersonContext } from './permissions.util';

/**
 * F2-01 — loads the facts the authority matrix needs and asks
 * `permissions.util.decide()`. No other service should check roles/stewards
 * on a Person by hand.
 */
@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly genealogy: GenealogyService,
  ) {}

  async context(actorId: string | null, personId: string, opts: { family?: boolean } = {}, db: Db = this.prisma): Promise<PersonContext> {
    const p = await db.person.findUnique({
      where: { id: personId },
      select: {
        id: true, userId: true, vitalStatus: true, mergedIntoId: true, createdById: true,
        stewards: { select: { userId: true, role: true } },
        user: { select: { status: true, createdById: true } },
      },
    });
    if (!p) throw new NotFoundException('Orang tidak ditemukan');
    const actorHasConsent = !!(actorId && p.userId && (await db.guardianConsent.count({
      where: { requesterId: actorId, targetUserId: p.userId, status: 'GRANTED' },
    })));
    const inActorFamily = !!(actorId && opts.family && (await this.genealogy.scopeOf(actorId)).has(p.id));
    // Persons created before stewards existed: their creator manages them.
    const stewards = p.stewards.length || p.userId ? p.stewards : [{ userId: p.createdById, role: 'PRIMARY' as const }];
    return {
      personId: p.id,
      accountUserId: p.userId,
      accountStatus: p.user?.status ?? null,
      accountCreatedById: p.user?.createdById ?? null,
      vitalStatus: p.vitalStatus as PersonContext['vitalStatus'],
      mergedIntoId: p.mergedIntoId,
      stewards,
      actorHasConsent,
      inActorFamily,
    };
  }

  async can(actor: Actor, action: Action, personId: string): Promise<PermissionResult> {
    // Only edits distinguish relatives (PROPOSAL) from strangers (DENY).
    return decide(actor, action, await this.context(actor.userId, personId, { family: action === 'person.edit' }));
  }

  /** Throws unless the actor may do `action` directly. */
  async assert(actor: Actor, action: Action, personId: string): Promise<void> {
    const r = await this.can(actor, action, personId);
    if (r.decision !== 'DIRECT') throw new ForbiddenException(r.reason);
  }

  /** Everyone who must approve a decision touching all of `personIds`. */
  async approvers(personIds: string[], db: Db = this.prisma): Promise<string[]> {
    const out = new Set<string>();
    for (const id of personIds) for (const u of approversFor(await this.context(null, id, {}, db))) out.add(u);
    return [...out];
  }

  /** Persons the user decides for: own Person, stewarded Persons, early-access accounts they created. */
  async managedPersonIds(userId: string): Promise<string[]> {
    const [own, stewarded, early] = await Promise.all([
      this.prisma.person.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.personSteward.findMany({ where: { userId }, select: { personId: true } }),
      this.prisma.person.findMany({ where: { user: { createdById: userId, status: 'EARLY_ACCESS' } }, select: { id: true } }),
    ]);
    return [...new Set([own?.id, ...stewarded.map((s) => s.personId), ...early.map((p) => p.id)].filter((x): x is string => !!x))];
  }

  /** What the current user may do with a person (drives the UI). */
  async summary(actor: Actor, personId: string) {
    const ctx = await this.context(actor.userId, personId, { family: true });
    const users = await this.prisma.user.findMany({ where: { id: { in: ctx.stewards.map((s) => s.userId) } }, select: { id: true, name: true } });
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    return {
      personId,
      edit: decide(actor, 'person.edit', ctx),
      manageStewards: decide(actor, 'person.manageStewards', ctx),
      decideMerge: decide(actor, 'merge.decide', ctx),
      confirmRelation: decide(actor, 'relation.confirm', ctx),
      hasAccount: !!ctx.accountUserId,
      stewards: ctx.stewards.map((s) => ({ userId: s.userId, name: nameOf.get(s.userId) ?? null, role: s.role })),
    };
  }

  /**
   * Appoint a co-steward ("wali bersama"), e.g. a sibling who may also look
   * after the profile of a late parent. Only for persons without an active
   * account; the appointee must be a member of the actor's family.
   */
  async addCoSteward(actor: Actor, personId: string, targetUserId: string) {
    await this.assert(actor, 'person.manageStewards', personId);
    const ctx = await this.context(actor.userId, personId);
    if (ctx.accountUserId && ctx.accountStatus !== 'EARLY_ACCESS') {
      throw new BadRequestException('Orang ini punya akun sendiri; profilnya dikelola pemilik akun');
    }
    if (targetUserId === actor.userId || ctx.stewards.some((s) => s.userId === targetUserId)) {
      throw new BadRequestException('Pengguna ini sudah menjadi pengelola');
    }
    const target = await this.prisma.person.findUnique({ where: { userId: targetUserId }, select: { id: true } });
    if (!target || !(await this.genealogy.scopeOf(actor.userId)).has(target.id)) {
      throw new BadRequestException('Wali bersama harus anggota keluarga Anda yang punya akun');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.personSteward.create({ data: { personId, userId: targetUserId, role: 'CO_STEWARD', grantedById: actor.userId } });
      await tx.personRevision.create({ data: { personId, actorId: actor.userId, source: 'API', diff: { stewardAdded: targetUserId, role: 'CO_STEWARD' } } });
    });
    return this.summary(actor, personId);
  }

  /** Remove a co-steward (by the primary manager), or step down yourself. */
  async removeCoSteward(actor: Actor, personId: string, targetUserId: string) {
    const ctx = await this.context(actor.userId, personId);
    const role = ctx.stewards.find((s) => s.userId === targetUserId)?.role;
    if (!role) throw new NotFoundException('Pengguna ini bukan pengelola');
    if (role !== 'CO_STEWARD') throw new BadRequestException('Pengelola utama tidak bisa dihapus');
    if (targetUserId !== actor.userId) await this.assert(actor, 'person.manageStewards', personId);
    await this.prisma.$transaction(async (tx) => {
      await tx.personSteward.delete({ where: { personId_userId: { personId, userId: targetUserId } } });
      await tx.personRevision.create({ data: { personId, actorId: actor.userId, source: 'API', diff: { stewardRemoved: targetUserId } } });
    });
    return this.summary(actor, personId);
  }
}
