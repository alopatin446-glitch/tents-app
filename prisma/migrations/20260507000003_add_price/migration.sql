-- CHAPTER 1: Add price lock fields to Client
--
-- Безопасность для продакшена:
--   isPriceLocked   — ADD COLUMN с DEFAULT false (мгновенно в PostgreSQL).
--   priceLockedAt   — ADD COLUMN nullable (мгновенно, без перестройки таблицы).
--   priceLockReason — ADD COLUMN nullable TEXT (мгновенно).
--
--   Все существующие записи:
--     isPriceLocked   = false (не заморожены, поведение не меняется)
--     priceLockedAt   = NULL
--     priceLockReason = NULL
--
--   Совместимость: полная обратная совместимость.
--   Старые заказы продолжают работать по прежней логике (done/cancelled → savedPrices).
--   isPriceLocked = false по умолчанию не влияет на resolveActivePrices для live orders.

ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "isPriceLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "priceLockedAt" TIMESTAMP(3);

ALTER TABLE "Client"
ADD COLUMN IF NOT EXISTS "priceLockReason" TEXT;