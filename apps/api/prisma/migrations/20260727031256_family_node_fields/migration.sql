-- AlterTable
ALTER TABLE "family_trees" ADD COLUMN     "family_bio" TEXT,
ADD COLUMN     "family_image" TEXT,
ADD COLUMN     "head_name" TEXT,
ADD COLUMN     "marriage_date" TIMESTAMP(3),
ADD COLUMN     "marriage_status" TEXT;
