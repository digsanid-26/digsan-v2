-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "guardian_consents" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_email" TEXT,
    "target_phone" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "scope" TEXT NOT NULL DEFAULT 'MANAGE',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_consents_target_user_id_status_idx" ON "guardian_consents"("target_user_id", "status");

-- CreateIndex
CREATE INDEX "guardian_consents_requester_id_idx" ON "guardian_consents"("requester_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_consents_tree_id_node_id_requester_id_key" ON "guardian_consents"("tree_id", "node_id", "requester_id");

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
