SET search_path = "english_portal";

ALTER TABLE "Product"
  ADD COLUMN "regularPriceLabel" TEXT,
  ADD COLUMN "salePriceLabel" TEXT,
  ADD COLUMN "saleBadge" TEXT;
