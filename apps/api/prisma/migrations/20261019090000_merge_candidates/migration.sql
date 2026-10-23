-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('OPEN', 'REJECTED', 'MERGED', 'OBSOLETE');

-- CreateTable
CREATE TABLE "merge_candidates" (
    "id" TEXT NOT NULL,
    "person_a_id" TEXT NOT NULL,
    "person_b_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "MergeStatus" NOT NULL DEFAULT 'OPEN',
    "keep_person_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merge_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_approvals" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merge_candidates_status_idx" ON "merge_candidates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "merge_candidates_person_a_id_person_b_id_key" ON "merge_candidates"("person_a_id", "person_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "merge_approvals_candidate_id_user_id_key" ON "merge_approvals"("candidate_id", "user_id");

-- AddForeignKey
ALTER TABLE "merge_approvals" ADD CONSTRAINT "merge_approvals_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "merge_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

