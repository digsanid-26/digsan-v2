-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "legacy_node_maps" ADD COLUMN     "snapshot" JSONB;

-- CreateTable
CREATE TABLE "change_proposals" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "proposer_id" TEXT NOT NULL,
    "tree_id" TEXT,
    "changes" JSONB NOT NULL,
    "note" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_proposals_person_id_status_idx" ON "change_proposals"("person_id", "status");

-- CreateIndex
CREATE INDEX "change_proposals_proposer_id_status_idx" ON "change_proposals"("proposer_id", "status");

-- AddForeignKey
ALTER TABLE "change_proposals" ADD CONSTRAINT "change_proposals_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

