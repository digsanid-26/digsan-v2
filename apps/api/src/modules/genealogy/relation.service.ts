import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { Db } from './graph.repository';
import { PermissionService } from './permission.service';
import { describeParentage, describeUnion, evaluateRelation, type RelationEnd } from './relation-status.util';

type Kind = 'PARENTAGE' | 'UNION';

/**
 * F2-03 — two-way confirmation of relationships touching an account.
 * Status lives on the relation (`Parentage.status` / `Union.confirmStatus`)
 * and is recomputed from tree assertions + explicit confirmations.
 */
@Injectable()
export class RelationService {
  private readonly logger = new Logger(RelationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly notifications: NotificationService,
  ) {}

  static standalone(prisma: PrismaService, permissions: PermissionService) {
    const noop = { create: async () => null, sendPushSafe: async () => undefined };
    return new RelationService(prisma, permissions, noop as unknown as NotificationService);
  }

  private async endsOf(db: Db, personIds: (string | null)[]): Promise<RelationEnd[]> {
    const ends: RelationEnd[] = [];
    for (const id of personIds) {
      if (!id) continue;
      const p = await db.person.findUnique({ where: { id }, select: { userId: true } });
      // Only account ends need consent; the rest is managed by whoever draws them.
      ends.push({ personId: id, approvers: p?.userId ? await this.permissions.approvers([id], db) : [] });
    }
    return ends;
  }

  private async load(db: Db, kind: Kind, id: string) {
    if (kind === 'PARENTAGE') {
      const r = await db.parentage.findUnique({ where: { id } });
      return r && { ends: [r.parentId, r.childId], status: r.status, proposedById: r.proposedById };
    }
    const r = await db.union.findUnique({ where: { id } });
    return r && { ends: [r.partnerAId, r.partnerBId], status: r.confirmStatus, proposedById: r.proposedById };
  }

  /** Recompute status; returns approvers still pending (empty unless PROPOSED) and the previous status. */
  async refresh(db: Db, kind: Kind, id: string): Promise<{ status: string; pending: string[]; previous: string } | null> {
    const rel = await this.load(db, kind, id);
    if (!rel) return null;
    const [ends, assertions, decisions] = await Promise.all([
      this.endsOf(db, rel.ends),
      db.graphAssertion.findMany({ where: { kind, targetId: id }, select: { tree: { select: { userId: true } } } }),
      db.relationConfirmation.findMany({ where: { kind, targetId: id }, select: { userId: true, approve: true } }),
    ]);
    const evaluation = evaluateRelation(
      ends,
      new Set(assertions.map((a) => a.tree.userId)),
      new Map(decisions.map((d) => [d.userId, d.approve])),
    );
    if (evaluation.status !== rel.status && ['PROPOSED', 'CONFIRMED', 'REJECTED'].includes(rel.status)) {
      if (kind === 'PARENTAGE') {
        await db.parentage.update({
          where: { id },
          data: { status: evaluation.status, confirmedAt: evaluation.status === 'CONFIRMED' ? new Date() : null },
        });
      } else {
        await db.union.update({ where: { id }, data: { confirmStatus: evaluation.status } });
      }
    }
    return { ...evaluation, previous: rel.status };
  }

  /**
   * Recompute every relation one tree asserts. Returns who has something new
   * to confirm (user → count): relations created now, or that just started to
   * touch an account (e.g. a circle was linked to someone's account).
   */
  async refreshTree(db: Db, treeId: string, newIds: Set<string>): Promise<Map<string, number>> {
    const assertions = await db.graphAssertion.findMany({ where: { treeId }, select: { kind: true, targetId: true } });
    const notify = new Map<string, number>();
    for (const a of assertions) {
      const r = await this.refresh(db, a.kind, a.targetId);
      if (!r || !r.pending.length || (!newIds.has(a.targetId) && r.previous === 'PROPOSED')) continue;
      for (const u of r.pending) notify.set(u, (notify.get(u) ?? 0) + 1);
    }
    return notify;
  }

  /** After a sync commits: one notification per person asked to confirm. */
  async notifyPending(treeId: string, counts: Map<string, number>) {
    if (!counts.size) return;
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId }, select: { userId: true, user: { select: { name: true } } } });
    for (const [userId, n] of counts) {
      if (userId === tree?.userId) continue;
      const msg = `${tree?.user?.name ?? 'Anggota keluarga'} mencatat ${n} hubungan keluarga yang melibatkan Anda. Mohon konfirmasi.`;
      this.notifications.create({
        userId, type: 'SYSTEM' as any, title: 'Konfirmasi hubungan keluarga', message: msg,
        data: { kind: 'RELATION_CONFIRM', treeId },
      }).catch(() => undefined);
      this.notifications.sendPushSafe(userId, 'Konfirmasi hubungan keluarga', msg).catch(() => undefined);
    }
  }

  /** Relationships waiting for this user's confirmation. */
  async listPending(userId: string) {
    const managed = await this.permissions.managedPersonIds(userId);
    const accountPersons = (await this.prisma.person.findMany({
      where: { id: { in: managed }, userId: { not: null } }, select: { id: true },
    })).map((p) => p.id);
    if (!accountPersons.length) return [];

    const [parentages, unions] = await Promise.all([
      this.prisma.parentage.findMany({
        where: { status: 'PROPOSED', OR: [{ parentId: { in: accountPersons } }, { childId: { in: accountPersons } }] },
        include: { parent: { select: { id: true, displayName: true, sex: true, userId: true } }, child: { select: { id: true, displayName: true, userId: true } } },
      }),
      this.prisma.union.findMany({
        where: { confirmStatus: 'PROPOSED', OR: [{ partnerAId: { in: accountPersons } }, { partnerBId: { in: accountPersons } }] },
        include: { partnerA: { select: { id: true, displayName: true, userId: true } }, partnerB: { select: { id: true, displayName: true, userId: true } } },
      }),
    ]);
    const proposerNames = new Map(
      (await this.prisma.user.findMany({
        where: { id: { in: [...new Set([...parentages, ...unions].map((r) => r.proposedById))] } }, select: { id: true, name: true },
      })).map((u) => [u.id, u.name]),
    );

    const out = [];
    for (const p of parentages) {
      const r = await this.refresh(this.prisma, 'PARENTAGE', p.id);
      if (!r?.pending.includes(userId)) continue;
      out.push({
        kind: 'PARENTAGE' as const, id: p.id, proposedBy: proposerNames.get(p.proposedById) ?? null, createdAt: p.createdAt,
        description: describeParentage(
          { name: p.parent.displayName, sex: p.parent.sex, isMe: p.parent.userId === userId },
          { name: p.child.displayName, isMe: p.child.userId === userId },
        ),
      });
    }
    for (const u of unions) {
      const r = await this.refresh(this.prisma, 'UNION', u.id);
      if (!r?.pending.includes(userId) || !u.partnerB) continue;
      out.push({
        kind: 'UNION' as const, id: u.id, proposedBy: proposerNames.get(u.proposedById) ?? null, createdAt: u.createdAt,
        description: describeUnion(
          { name: u.partnerA.displayName, isMe: u.partnerA.userId === userId },
          { name: u.partnerB.displayName, isMe: u.partnerB.userId === userId },
        ),
      });
    }
    return out;
  }

  async decide(userId: string, kind: Kind, id: string, approve: boolean) {
    const rel = await this.load(this.prisma, kind, id);
    if (!rel) throw new NotFoundException('Hubungan tidak ditemukan');
    if (rel.status === 'RETRACTED') throw new BadRequestException('Hubungan ini sudah ditarik');
    const ends = await this.endsOf(this.prisma, rel.ends);
    if (!ends.some((e) => e.approvers.includes(userId))) throw new ForbiddenException('Hubungan ini tidak melibatkan Anda');

    await this.prisma.relationConfirmation.upsert({
      where: { kind_targetId_userId: { kind, targetId: id, userId } },
      update: { approve },
      create: { kind, targetId: id, userId, approve },
    });
    const r = (await this.refresh(this.prisma, kind, id))!;
    if (r.status === 'REJECTED' && rel.proposedById !== userId) {
      const who = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await this.notifications.create({
        userId: rel.proposedById, type: 'SYSTEM' as any, title: 'Hubungan keluarga ditolak',
        message: `${who?.name ?? 'Anggota keluarga'} menyatakan hubungan yang Anda catat tidak benar. Hubungan itu tidak ditampilkan di silsilah bersama.`,
        data: { kind: 'RELATION_REJECTED', relationKind: kind, relationId: id },
      }).catch((err) => this.logger.warn(`notify proposer failed: ${err}`));
    }
    return { kind, id, status: r.status };
  }
}
