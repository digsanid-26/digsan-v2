-- CreateEnum
CREATE TYPE "LinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by_id" TEXT;

-- CreateTable
CREATE TABLE "node_link_requests" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "status" "LinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "node_link_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "node_link_requests_target_user_id_status_idx" ON "node_link_requests"("target_user_id", "status");

-- CreateIndex
CREATE INDEX "node_link_requests_tree_id_node_id_status_idx" ON "node_link_requests"("tree_id", "node_id", "status");

-- AddForeignKey
ALTER TABLE "node_link_requests" ADD CONSTRAINT "node_link_requests_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: early-access accounts created before this migration belong to the
-- owner of the tree whose layout node carries the early-access link. Without
-- this, nobody could use "Login Early Access" for legacy accounts.
UPDATE "users" u
SET "created_by_id" = src.owner_id
FROM (
    SELECT DISTINCT ON (node.value->>'linkedUserId')
           node.value->>'linkedUserId' AS early_user_id,
           t."user_id"                 AS owner_id
    FROM "family_trees" t,
         LATERAL jsonb_each(
           CASE WHEN jsonb_typeof(t."layout_members") = 'object' THEN t."layout_members" ELSE '{}'::jsonb END
         ) AS node
    WHERE jsonb_typeof(node.value) = 'object'
      AND node.value->'earlyAccess' = 'true'::jsonb
      AND node.value->>'linkedUserId' IS NOT NULL
    ORDER BY node.value->>'linkedUserId', t."created_at" ASC
) src
WHERE u."id" = src.early_user_id
  AND u."created_by_id" IS NULL
  AND u."status" = 'EARLY_ACCESS';

-- Same for accounts created through the table-based early-access flow.
UPDATE "users" u
SET "created_by_id" = t."user_id"
FROM "family_members" fm
JOIN "family_trees" t ON t."id" = fm."tree_id"
WHERE fm."user_id" = u."id"
  AND u."created_by_id" IS NULL
  AND u."status" = 'EARLY_ACCESS'
  AND t."user_id" <> u."id";
