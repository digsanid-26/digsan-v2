-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "birth_place" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "hobbies" TEXT,
ADD COLUMN     "occupation" TEXT;
