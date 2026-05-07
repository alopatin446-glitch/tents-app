-- FINAL-C: Add totalExpenses to Client
-- Safe migration: nullable column with default 0.
-- No existing data is deleted or modified.
-- Old records will have NULL until the next save of that order.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "totalExpenses" DOUBLE PRECISION DEFAULT 0;