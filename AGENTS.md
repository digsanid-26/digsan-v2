# AGENTS.md

## Monorepo
- pnpm workspace: `apps/api` (NestJS + Prisma/PostgreSQL), `apps/web` (Next.js), `apps/landing` (Next.js), `apps/mobile` (Flutter).
- Plans/roadmap: `docs/FUTURE-FEATURES.md`, family-tree authority fixes: `docs/tasklist-perbaikan.md`.

## Verification
- API typecheck: `npx tsc --noEmit -p tsconfig.json` (in `apps/api`). To include e2e specs, extend tsconfig with `"include": ["src/**/*", "test/**/*"]`.
- Web typecheck: `npx tsc --noEmit -p tsconfig.json` (in `apps/web`); lint: `npx eslint <files>`.
- Web tree layout regression (no `tsx` installed; use the API's ts-node, in `apps/web`):
  `../api/node_modules/.bin/ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node","jsx":"react-jsx"}' scripts/verify-layout.ts`
- Per-node setup ("Atur jaringan", `member.familyConfig`) counts are TOTALS including relatives already drawn; keep `familyGraph.ts` (web) and `layout-graph.util.ts` (API) in sync.
- API unit tests (no DB needed): `npx jest src/modules/tree` (ts-jest is slow on Windows, ~7 min cold).
- API e2e tests (`apps/api/test/*.e2e-spec.ts`) boot the full AppModule and need PostgreSQL **and** Redis; they create/delete their own users. Ask the user before running them against the local DB.
- Generate a migration without a DB: `git show HEAD:apps/api/prisma/schema.prisma > prisma/.old.prisma && npx prisma migrate diff --from-schema-datamodel prisma/.old.prisma --to-schema-datamodel prisma/schema.prisma --script` (use a path inside the repo; `/tmp` is not visible to node on Windows). Do not apply migrations to the local DB without asking.

## Family tree rules (see docs/tasklist-perbaikan.md)
- Layout data lives in `FamilyTree.layoutMembers` (JSON, 0-based keys: `self`, `spouse-0`, `child-0`, `parent-0`, `older-0`, `younger-0`, `gpP-0`, `gpM-0`, `uncle[PM][oy]-0`).
- Pure authority helpers: `apps/api/src/modules/tree/tree-layout.util.ts` (unit-tested). Clients can never set `linkedUserId`/`verified`/`claimedByUserId`/`earlyAccess`/`username` directly; new links become `NodeLinkRequest`s approved by the target.
- Only household circles (spouse/children) join the owner's Family Node; parents/siblings never do.
- GET endpoints must not write. `super_user` is never a cross-tree bypass — use tree ownership or `admin`/`super_admin`.
- Layout writes use compare-and-swap on `updatedAt` (`updateLayoutAtomically`); `PUT /trees/layout` accepts `baseUpdatedAt` and returns 409 on stale writes.

## Genealogy graph (Fase 1, `apps/api/src/modules/genealogy/`)
- Canonical model: `Person` (one per human; `userId` unique), `Parentage` (parent→child + kind/certainty), `Union`. Siblings/uncles/cousins are derived, never stored.
- Legacy trees are projected by `GraphSyncService.syncTree` (idempotent, via `LegacyNodeMap` + `GraphAssertion`). Any new tree write path must call `this.graphSync.syncTreeInBackground(treeId)`.
- Dual-write only runs with env `GRAPH_MODEL=true`. Backfill: `pnpm graph:backfill` (dry-run, rolled back) / `-- --apply`.
- All traversal goes through `GraphRepository` (recursive CTEs); pure rules/kinship in `graph-rules.util.ts`, key conversion in `layout-graph.util.ts` (both unit-tested, no DB).
- Duplicates (Fase 2): `merge-rules.util.ts` (pure detection/blockers) + `MergeService` (candidates, approvals by ALL stewards of both Persons, merge = rewire + tombstone `mergedIntoId`). Never merge automatically; never re-propose REJECTED/MERGED pairs. Queries over persons must ignore tombstones (`mergedIntoId: null`).
- Sync must not overwrite profile fields of a Person mapped by more than one tree (fill-only).
- Search before create (F2-05): a layout node may carry `graphPersonId` (an existing non-account Person). `saveLayout` validates it against `GenealogyService.scopeOf(user)`; account Persons must go through `NodeLinkRequest` instead.
