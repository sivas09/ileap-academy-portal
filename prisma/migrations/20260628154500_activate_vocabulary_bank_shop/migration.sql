SET search_path = "english_portal";

UPDATE "Product"
SET "isActive" = true
WHERE "slug" = 'ileap-vocabulary-bank-grades-3-5'
  AND "status" = 'PUBLISHED';
