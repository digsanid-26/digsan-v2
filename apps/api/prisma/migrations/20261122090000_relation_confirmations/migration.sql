-- CreateTable
CREATE TABLE "relation_confirmations" (
    "id" TEXT NOT NULL,
    "kind" "GraphAssertionKind" NOT NULL,
    "target_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relation_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relation_confirmations_user_id_idx" ON "relation_confirmations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "relation_confirmations_kind_target_id_user_id_key" ON "relation_confirmations"("kind", "target_id", "user_id");

