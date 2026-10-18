-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('EXACT', 'MONTH', 'YEAR', 'CIRCA', 'BEFORE', 'AFTER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VitalStatus" AS ENUM ('LIVING', 'DECEASED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PlaceholderKind" AS ENUM ('UNKNOWN_FATHER', 'UNKNOWN_MOTHER', 'UNKNOWN_PARENT', 'UNKNOWN_ANCESTOR', 'UNFILLED_SLOT');

-- CreateEnum
CREATE TYPE "PersonPrivacy" AS ENUM ('PUBLIC', 'FAMILY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ParentageKind" AS ENUM ('BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 'GUARDIAN', 'DONOR', 'SURROGATE');

-- CreateEnum
CREATE TYPE "Certainty" AS ENUM ('CONFIRMED', 'PROBABLE', 'ASSUMED', 'DISPUTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DISPUTED', 'REJECTED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "UnionKind" AS ENUM ('MARRIAGE_CIVIL', 'MARRIAGE_RELIGIOUS', 'MARRIAGE_SIRI', 'CUSTOMARY', 'PARTNERSHIP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "UnionStatus" AS ENUM ('ONGOING', 'DIVORCED', 'WIDOWED', 'ANNULLED', 'SEPARATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "UnionEndReason" AS ENUM ('DIVORCE', 'DEATH_OF_A', 'DEATH_OF_B', 'ANNULMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StewardRole" AS ENUM ('OWNER', 'PRIMARY', 'CO_STEWARD', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "GraphAssertionKind" AS ENUM ('PARENTAGE', 'UNION');

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "display_name" TEXT NOT NULL,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" TIMESTAMP(3),
    "birth_date_precision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "birth_place" TEXT,
    "death_date" TIMESTAMP(3),
    "death_date_precision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "vital_status" "VitalStatus" NOT NULL DEFAULT 'LIVING',
    "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "placeholder_kind" "PlaceholderKind",
    "multiple_birth_group" TEXT,
    "photo" TEXT,
    "privacy" "PersonPrivacy" NOT NULL DEFAULT 'FAMILY',
    "created_by_id" TEXT NOT NULL,
    "merged_into_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_names" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "person_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parentages" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "kind" "ParentageKind" NOT NULL DEFAULT 'BIOLOGICAL',
    "certainty" "Certainty" NOT NULL DEFAULT 'CONFIRMED',
    "union_id" TEXT,
    "birth_order" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_legal" BOOLEAN,
    "visibility" "PersonPrivacy" NOT NULL DEFAULT 'FAMILY',
    "status" "RelStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parentages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unions" (
    "id" TEXT NOT NULL,
    "partner_a_id" TEXT NOT NULL,
    "partner_b_id" TEXT,
    "kind" "UnionKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "UnionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "order_for_a" INTEGER,
    "order_for_b" INTEGER,
    "start_date" TIMESTAMP(3),
    "start_date_precision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "end_date" TIMESTAMP(3),
    "end_reason" "UnionEndReason",
    "visibility" "PersonPrivacy" NOT NULL DEFAULT 'FAMILY',
    "confirm_status" "RelStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "union_events" (
    "id" TEXT NOT NULL,
    "union_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "date_precision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "union_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_stewards" (
    "person_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "StewardRole" NOT NULL,
    "granted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_stewards_pkey" PRIMARY KEY ("person_id","user_id")
);

-- CreateTable
CREATE TABLE "person_revisions" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "source" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_node_maps" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "node_key" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legacy_node_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_assertions" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "kind" "GraphAssertionKind" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_assertions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_user_id_key" ON "persons"("user_id");

-- CreateIndex
CREATE INDEX "persons_display_name_idx" ON "persons"("display_name");

-- CreateIndex
CREATE INDEX "persons_merged_into_id_idx" ON "persons"("merged_into_id");

-- CreateIndex
CREATE INDEX "person_names_value_idx" ON "person_names"("value");

-- CreateIndex
CREATE INDEX "person_names_person_id_idx" ON "person_names"("person_id");

-- CreateIndex
CREATE INDEX "parentages_child_id_kind_idx" ON "parentages"("child_id", "kind");

-- CreateIndex
CREATE INDEX "parentages_parent_id_kind_idx" ON "parentages"("parent_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "parentages_parent_id_child_id_kind_key" ON "parentages"("parent_id", "child_id", "kind");

-- CreateIndex
CREATE INDEX "unions_partner_a_id_idx" ON "unions"("partner_a_id");

-- CreateIndex
CREATE INDEX "unions_partner_b_id_idx" ON "unions"("partner_b_id");

-- CreateIndex
CREATE INDEX "union_events_union_id_idx" ON "union_events"("union_id");

-- CreateIndex
CREATE INDEX "person_stewards_user_id_idx" ON "person_stewards"("user_id");

-- CreateIndex
CREATE INDEX "person_revisions_person_id_created_at_idx" ON "person_revisions"("person_id", "created_at");

-- CreateIndex
CREATE INDEX "legacy_node_maps_person_id_idx" ON "legacy_node_maps"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_node_maps_tree_id_node_key_key" ON "legacy_node_maps"("tree_id", "node_key");

-- CreateIndex
CREATE INDEX "graph_assertions_kind_target_id_idx" ON "graph_assertions"("kind", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_assertions_tree_id_kind_target_id_key" ON "graph_assertions"("tree_id", "kind", "target_id");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_names" ADD CONSTRAINT "person_names_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parentages" ADD CONSTRAINT "parentages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parentages" ADD CONSTRAINT "parentages_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parentages" ADD CONSTRAINT "parentages_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_a_id_fkey" FOREIGN KEY ("partner_a_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_b_id_fkey" FOREIGN KEY ("partner_b_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "union_events" ADD CONSTRAINT "union_events_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "unions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_stewards" ADD CONSTRAINT "person_stewards_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_revisions" ADD CONSTRAINT "person_revisions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_node_maps" ADD CONSTRAINT "legacy_node_maps_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_node_maps" ADD CONSTRAINT "legacy_node_maps_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_assertions" ADD CONSTRAINT "graph_assertions_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

