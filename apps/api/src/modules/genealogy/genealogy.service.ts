import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { GraphRepository } from './graph.repository';
import { checkGraph, relationOf, type ParentageKindT } from './graph-rules.util';

const MODES: Record<string, ParentageKindT[]> = {
  nasab: ['BIOLOGICAL'],
  hukum: ['BIOLOGICAL', 'ADOPTIVE'],
  sosial: ['BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 'GUARDIAN'],
};

/** Read side of the canonical genealogy graph (Fase 1: read-only, ego = current user). */
@Injectable()
export class GenealogyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: GraphRepository,
  ) {}

  private async egoOf(userId: string) {
    const ego = await this.prisma.person.findUnique({ where: { userId }, select: { id: true } });
    if (!ego) throw new NotFoundException('Data silsilah Anda belum tersedia di model graf');
    return ego.id;
  }

  /** Family view around the current user, with each person's relation label. */
  async myView(userId: string, up = 3, down = 2, mode = 'hukum') {
    const egoId = await this.egoOf(userId);
    const kinds = MODES[mode] ?? MODES.hukum;
    const ids = await this.graph.neighborhood(egoId, Math.min(Math.max(up, 0), 10), Math.min(Math.max(down, 0), 10));
    const g = await this.graph.loadGraph(ids);
    const persons = await this.prisma.person.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, sex: true, vitalStatus: true, photo: true, isPlaceholder: true, userId: true, privacy: true },
    });
    return {
      egoId,
      mode: MODES[mode] ? mode : 'hukum',
      persons: persons.map(({ userId: uid, ...p }) => ({
        ...p,
        hasAccount: !!uid,
        relation: relationOf(g, egoId, p.id, kinds),
      })),
      parentages: g.parentages,
      unions: g.unions,
    };
  }

  /** "Who is this person to me?" */
  async relationToMe(userId: string, otherId: string, mode = 'hukum') {
    const egoId = await this.egoOf(userId);
    const other = await this.prisma.person.findUnique({ where: { id: otherId }, select: { id: true, displayName: true } });
    if (!other) throw new NotFoundException('Orang tidak ditemukan');
    const g = await this.graph.loadGraph(await this.graph.relationSubgraphIds(egoId, otherId));
    const relation = relationOf(g, egoId, otherId, MODES[mode] ?? MODES.hukum);
    if (!relation) throw new NotFoundException('Belum ditemukan hubungan keluarga dengan orang ini');
    return { egoId, person: other, relation };
  }

  /** Admin: invariant check over the whole graph (F1-07). */
  async check() {
    const issues = checkGraph(await this.graph.loadAll());
    const counts: Record<string, number> = {};
    for (const i of issues) counts[i.code] = (counts[i.code] ?? 0) + 1;
    return { counts, issues: issues.slice(0, 200) };
  }
}
