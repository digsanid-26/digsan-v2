-- CreateTable
CREATE TABLE "public_link_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "username" TEXT,
    "user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_link_tokens_token_key" ON "public_link_tokens"("token");

-- CreateIndex
CREATE INDEX "public_link_tokens_token_idx" ON "public_link_tokens"("token");

-- CreateIndex
CREATE INDEX "public_link_tokens_slug_idx" ON "public_link_tokens"("slug");
