-- CreateTable
CREATE TABLE "family_node_members" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "is_head" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_node_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_node_members_tree_id_user_id_key" ON "family_node_members"("tree_id", "user_id");

-- CreateIndex: a person belongs to exactly one Family Node (one family = one slug)
CREATE UNIQUE INDEX "family_node_members_user_id_key" ON "family_node_members"("user_id");

-- CreateIndex
CREATE INDEX "family_node_members_tree_id_idx" ON "family_node_members"("tree_id");

-- AddForeignKey
ALTER TABLE "family_node_members" ADD CONSTRAINT "family_node_members_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_node_members" ADD CONSTRAINT "family_node_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
