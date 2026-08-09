-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NODE_CLAIM';
ALTER TYPE "NotificationType" ADD VALUE 'CLAIM_RESULT';

-- CreateTable
CREATE TABLE "node_claims" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "claimant_id" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "responder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "node_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "node_claims_tree_id_status_idx" ON "node_claims"("tree_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "node_claims_tree_id_node_id_claimant_id_key" ON "node_claims"("tree_id", "node_id", "claimant_id");

-- AddForeignKey
ALTER TABLE "node_claims" ADD CONSTRAINT "node_claims_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_claims" ADD CONSTRAINT "node_claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_claims" ADD CONSTRAINT "node_claims_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
