/**
 * F1-04 / F1-05 — project all legacy trees into the genealogy graph.
 *
 *   pnpm --filter @digsan/api graph:backfill            # DRY-RUN (rolled back), writes a report
 *   pnpm --filter @digsan/api graph:backfill -- --apply # persist
 *
 * Idempotent: safe to re-run; it reuses Persons via LegacyNodeMap and accounts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/database/prisma.service';
import { GraphRepository } from '../src/modules/genealogy/graph.repository';
import { GraphSyncService } from '../src/modules/genealogy/graph-sync.service';
import { MergeService } from '../src/modules/genealogy/merge.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const graph = new GraphRepository(prisma);
    // Candidates are created here; approvers see them in /tree notifications
    // (no push/email from the CLI).
    const sync = new GraphSyncService(prisma, graph, new ConfigService(), MergeService.standalone(prisma, graph));
    const report = await sync.backfill({ dryRun: !apply });

    const out = path.resolve(__dirname, `graph-backfill-report${apply ? '' : '.dry-run'}.json`);
    fs.writeFileSync(out, JSON.stringify(report, null, 2));

    console.log(`\nGraph backfill ${apply ? 'APPLIED' : 'DRY-RUN (nothing saved)'}`);
    console.log(`  trees               : ${report.trees}`);
    console.log(`  persons created     : ${report.personsCreated} (reused by account: ${report.personsReusedByAccount})`);
    console.log(`  parentages / unions : ${report.parentagesCreated} / ${report.unionsCreated}`);
    console.log(`  totals              : ${JSON.stringify(report.totals)}`);
    console.log(`  issues              : ${JSON.stringify(report.issues.counts)}`);
    console.log(`  merge candidates    : ${report.mergeCandidates}${apply ? ' (proposed to their stewards)' : ''}`);
    console.log(`  cycles skipped      : ${report.cyclesSkipped.length}`);
    console.log(`  trees with unmapped : ${report.unmapped.length}`);
    console.log(`  errors              : ${report.errors.length}`);
    console.log(`  report              : ${out}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
