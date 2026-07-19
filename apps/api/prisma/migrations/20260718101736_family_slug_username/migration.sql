/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `family_trees` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "family_trees" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "family_trees_slug_key" ON "family_trees"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
