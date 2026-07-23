-- CreateTable
CREATE TABLE "ad_spots" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "page" TEXT NOT NULL DEFAULT 'dashboard',
    "position" TEXT NOT NULL DEFAULT 'default',
    "aspect_ratio" TEXT NOT NULL DEFAULT '1:1',
    "max_slots" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "aspect_ratio" TEXT NOT NULL DEFAULT '1:1',
    "width" INTEGER,
    "height" INTEGER,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_assignments" (
    "id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "banner_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "rate" DECIMAL(12,2),
    "discount_role" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_spots_key_key" ON "ad_spots"("key");

-- CreateIndex
CREATE INDEX "ad_banners_created_by_id_idx" ON "ad_banners"("created_by_id");

-- CreateIndex
CREATE INDEX "ad_assignments_spot_id_idx" ON "ad_assignments"("spot_id");

-- CreateIndex
CREATE INDEX "ad_assignments_banner_id_idx" ON "ad_assignments"("banner_id");

-- CreateIndex
CREATE INDEX "ad_assignments_assigned_by_id_idx" ON "ad_assignments"("assigned_by_id");

-- AddForeignKey
ALTER TABLE "ad_banners" ADD CONSTRAINT "ad_banners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_assignments" ADD CONSTRAINT "ad_assignments_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "ad_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_assignments" ADD CONSTRAINT "ad_assignments_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "ad_banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_assignments" ADD CONSTRAINT "ad_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
