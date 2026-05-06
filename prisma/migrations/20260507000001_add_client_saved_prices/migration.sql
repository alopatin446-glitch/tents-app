-- AddColumn: savedPrices
-- Добавляет поле для хранения снапшота прайса на момент сохранения заказа.
--
-- Безопасность для продакшена:
--   ADD COLUMN с NULL (без NOT NULL, без DEFAULT) в PostgreSQL выполняется
--   мгновенно — без перестройки таблицы и без блокировки строк.
--   Все существующие записи получат savedPrices = NULL.
--   Поведение системы для старых записей не изменяется: useCalculationState
--   при savedPrices = NULL продолжает использовать currentPrices.

ALTER TABLE "Client" ADD COLUMN "savedPrices" JSONB;