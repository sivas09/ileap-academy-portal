SET search_path = "english_portal";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN "shortDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "priceLabel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "stripePaymentLink" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "badge" TEXT,
  ADD COLUMN "ratingLabel" TEXT NOT NULL DEFAULT '★★★★★',
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

UPDATE "Product"
SET "slug" = lower(regexp_replace(regexp_replace("title", '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || substr("id", 1, 8)
WHERE "slug" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_sortOrder_idx" ON "Product"("status", "sortOrder");
