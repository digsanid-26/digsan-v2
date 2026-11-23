import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PermissionService } from './permission.service';
import { describeProposalStatus, describeRevision, sortTimeline, type HistoryEntry } from './history.util';
import { describeParentage, describeUnion } from './relation-status.util';

const ADMIN_ROLES = ['admin', 'super_admin'];

/**
 * F2-10 — the audit trail of one Person, visible to the person's family
 * (anyone who may at least propose a change). Includes the history of the
 * duplicates that were merged into it.
 */
@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async forPerson(actor: { userId: string; roles: string[] }, personId: string) {
    const verdict = await this.permissions.can(actor, 'person.edit', personId);
    if (verdict.decision === 'DENY') throw new ForbiddenException(verdict.reason);

    const merged = await this.prisma.person.findMany({ where: { mergedIntoId: personId }, select: { id: true } });
    const ids = [personId, ...merged.map((m) => m.id)];

    const [revisions, proposals, candidates, parentages, unions] = await Promise.all([
      this.prisma.personRevision.findMany({ where: { personId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.prisma.changeProposal.findMany({ where: { personId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.mergeCandidate.findMany({
        where: { OR: [{ personAId: { in: ids } }, { personBId: { in: ids } }] }, include: { approvals: true }, take: 50,
      }),
      this.prisma.parentage.findMany({
        where: { OR: [{ parentId: { in: ids } }, { childId: { in: ids } }] },
        include: { parent: { select: { displayName: true, sex: true } }, child: { select: { displayName: true } } },
      }),
      this.prisma.union.findMany({
        where: { OR: [{ partnerAId: { in: ids } }, { partnerBId: { in: ids } }] },
        include: { partnerA: { select: { displayName: true } }, partnerB: { select: { displayName: true } } },
      }),
    ]);
    const confirmations = await this.prisma.relationConfirmation.findMany({
      where: { OR: [{ kind: 'PARENTAGE', targetId: { in: parentages.map((p) => p.id) } }, { kind: 'UNION', targetId: { in: unions.map((u) => u.id) } }] },
    });

    const userIds = new Set<string>();
    for (const r of revisions) {
      if (r.actorId) userIds.add(r.actorId);
      const d = r.diff as Record<string, any>;
      for (const k of ['stewardAdded', 'stewardRemoved', 'proposerId']) if (typeof d?.[k] === 'string') userIds.add(d[k]);
    }
    for (const p of proposals) { userIds.add(p.proposerId); if (p.decidedById) userIds.add(p.decidedById); }
    for (const c of candidates) for (const a of c.approvals) userIds.add(a.userId);
    for (const c of confirmations) userIds.add(c.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
    const nameOf = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? null : null);
    const isAdmin = (id: string | null) => !!id && !!users.find((u) => u.id === id)?.userRoles.some((r) => ADMIN_ROLES.includes(r.role.name));
    const managers = new Set(await this.permissions.approvers([personId]));

    const entries: HistoryEntry[] = [];
    for (const r of revisions) {
      const d = describeRevision({ source: r.source, diff: r.diff as Record<string, any> }, nameOf);
      if (!d) continue;
      const proposer = nameOf((r.diff as any)?.proposerId);
      entries.push({
        at: r.createdAt, kind: d.kind, source: r.source,
        actor: nameOf(r.actorId),
        text: proposer && r.source === 'PROPOSAL' ? `${d.text} — diusulkan oleh ${proposer}` : d.text,
        adminOverride: isAdmin(r.actorId) && !managers.has(r.actorId!),
      });
    }
    for (const p of proposals) {
      const fields = Object.keys((p.changes as Record<string, unknown>) ?? {}).join(', ');
      entries.push({ at: p.createdAt, kind: 'PROPOSAL', source: 'PROPOSAL', actor: nameOf(p.proposerId), text: `Mengusulkan perubahan (${fields})${p.note ? `: “${p.note}”` : ''}` });
      if (p.decidedAt && p.status !== 'PENDING') {
        entries.push({
          at: p.decidedAt, kind: 'PROPOSAL', source: 'PROPOSAL', actor: nameOf(p.decidedById),
          text: `Usulan dari ${nameOf(p.proposerId) ?? 'anggota keluarga'} ${describeProposalStatus(p.status)}`,
        });
      }
    }
    for (const c of candidates) {
      entries.push({ at: c.createdAt, kind: 'MERGE', source: 'MERGE', actor: null, text: 'Terdeteksi kemungkinan tercatat dua kali' });
      for (const a of c.approvals) {
        entries.push({ at: a.createdAt, kind: 'MERGE', source: 'MERGE', actor: nameOf(a.userId), text: a.approve ? 'Menyetujui penggabungan' : 'Menolak penggabungan (bukan orang yang sama)' });
      }
    }
    const describeRel = (kind: string, id: string) => {
      if (kind === 'PARENTAGE') {
        const p = parentages.find((x) => x.id === id);
        return p ? describeParentage({ name: p.parent.displayName, sex: p.parent.sex, isMe: false }, { name: p.child.displayName, isMe: false }) : 'hubungan';
      }
      const u = unions.find((x) => x.id === id);
      return u ? describeUnion({ name: u.partnerA.displayName, isMe: false }, { name: u.partnerB?.displayName ?? '—', isMe: false }) : 'hubungan';
    };
    for (const c of confirmations) {
      entries.push({
        at: c.updatedAt, kind: 'RELATION', source: 'API', actor: nameOf(c.userId),
        text: `${c.approve ? 'Mengonfirmasi' : 'Menolak'}: ${describeRel(c.kind, c.targetId)}`,
      });
    }
    return sortTimeline(entries).slice(0, 300);
  }
}
