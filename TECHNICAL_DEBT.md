# TECHNICAL DEBT — tents-app
## FINAL-D V3 POST-AUDIT | CHAPTER 1

---

## 1. ORDER-LEVEL ROLL OPTIMIZATION

### Текущее состояние
Runtime работает в режиме **per-window approximation**:
- Каждое изделие оптимизируется независимо
- `materialCutCost` и `overspendingFilm` — per-window расчёт
- Rotation учитывается (исправлено в Chapter 1), но всё равно approximation

### Что требует ERP-уровень

```text
Вместо per-window:
  - order_solution: группировка изделий по ширине рулона
  - common_strip_length: суммирование длин в одном рулоне
  - allocation_by_element: привязка конкретных элементов к конкретному рулону
  - remnants: учёт остатков и их утилизация
  - warehouse_allocation: списание из конкретного склада

Дополнительно:
  - orientations: 0° / 90° / произвольный угол для трапеций
  - groups: разные рулоны одного материала в одном заказе
  - variants: альтернативные планы раскроя
  - nesting engine: упаковка деталей в полосу
```

### Риск
Текущий per-window расчёт систематически **завышает** waste (у каждого изделия
свой рулон) и **занижает** материальную эффективность крупных заказов.

### Приоритет
После стабилизации CHAPTER 1–3. До запуска warehouse / ERP stock.

---

## 2. PRICE SNAPSHOT SPLIT

### Текущее состояние
Одно поле `savedPrices` используется для двух разных целей:
- **Historical snapshot** — фиксируется при переводе в done/cancelled
- **Price lock snapshot** — фиксируется при isPriceLocked = true

### Будущее разделение

```prisma
// В Client:
savedPrices   Json?  // historical: фиксируется при done/cancelled
priceSnapshot Json?  // price lock: фиксируется при isPriceLocked = true
```

### Почему пока одно поле
- Миграция данных требует backfill
- Логика resolveActivePrices читает оба случая из savedPrices без конфликта
- Snapshot split — отдельная задача при введении аудит-лога

### Приоритет
После внедрения UI для price lock (кнопка «Зафиксировать цену»).

---

## 3. CANCELLED ORDER ECONOMY

### Текущее состояние
Cancelled order наследует financial snapshot из момента отмены.
При `isClosed = true` (статус cancelled) финансовые поля не перезаписываются.

### Нерешённый вопрос
Если заказ отменён ДО начала производства:
- `totalExpenses` должен быть 0 или фактические расходы
- Текущий runtime не различает "отменён до" и "отменён после"
- Нет признака `hasProductionStarted` или аналогичного

### Будущее решение
```typescript
// Добавить поле:
productionStartedAt: DateTime?  // null = производство не начато

// Логика:
cancelled + !productionStartedAt → expenses = 0
cancelled + productionStartedAt  → expenses = snapshot
```

### Приоритет
При внедрении production map / stage tracking.

---

## 4. AUDIT DELTA — DISPLAY

### Текущее состояние
`buildAuditDelta()` из `priceResolution.ts` вычисляет delta:
`DB value vs runtime recalculated value`

### Нереализовано
- UI компонент для отображения audit delta
- Панель диагностики для менеджера / директора
- Автоматическая пометка заказов с significant delta

### Почему не сделано сейчас
- Требует отдельный UI блок в ClientStep или отдельную страницу
- Логика готова (buildAuditDelta + buildMaterialDiagnostics)
- Нужно согласовать дизайн отображения

### Приоритет
После завершения CHAPTER 1. Перед аналитикой.

---

## 5. INCOMPLETE SNAPSHOT PROTECTION — FULL ENFORCEMENT

### Текущее состояние
`validateHistoricalSnapshot()` реализована в `priceResolution.ts`.
Логика detection готова.

### Нереализовано
- UI-флаг `isSnapshotIncomplete` на карточке клиента
- Блокировка ERP-действий при incomplete snapshot
- Список required slugs для каждого типа изделия

### Почему не сделано сейчас
- Требует определения `required_slugs` per material type
- ERP-действий ещё нет — блокировать нечего
- Реализуется при внедрении warehouse / production map

### Приоритет
Одновременно с warehouse / ERP stock.

---

## 6. MOUNTING SNAPSHOT — ОБЯЗАТЕЛЬНО ДЛЯ ГЛАВЫ 1

### Статус
✅ РЕАЛИЗОВАНО в Главе 1 (Chapter 1 / price lock).

### Что реализовано
При `isPriceLocked=true` и отсутствующем `mountingConfig.mountingSnapshot`:
- В `CalculationClient.handleSaveAll` при `isTurningLockOn` (первая фиксация)
  автоматически вызывается `captureCurrentPriceSnapshot(teamCategory, currentPrices)`
- Созданный snapshot записывается в `mountingConfig.mountingSnapshot`
- При последующих сохранениях snapshot уже присутствует — не перезаписывается

### Оставшийся риск
Если заказ переводится в `done/cancelled` без предшествующего `isPriceLocked`:
mounting snapshot может отсутствовать, и `calculateMounting` использует
прямой fallback на `prices` (live) внутри своей логики (`snapshot ?? prices`).

### Будущее дополнение
При автоматическом переводе в `done/cancelled` (если реализовано):
проверять наличие `mountingSnapshot` и создавать его если отсутствует.

### Приоритет
ВЫПОЛНЕНО для price lock. Расширить при введении автоматического done-workflow.

---

## 7. АДРЕСНАЯ КНИГА SLUGS ДЛЯ СТЯЖЕК

### Проблема
В defaultPrices.ts отсутствуют:
- `addo_strap_grommet_cost`
- `addo_strap_fastex_cost`

Присутствует только устаревший `addo_strap_cost` (generic).

### Следствие
Все заказы со стяжками получают `hasPriceError = true`.
Себестоимость стяжек = 9999 × count.

### Fix
Добавить в defaultPrices.ts:
```typescript
{ slug: 'addo_strap_grommet_cost', value: 15,  ... }  // себестоимость люверс-ремешка
{ slug: 'addo_strap_fastex_cost',  value: 30,  ... }  // себестоимость фастекс-ремешка
// c_produc_fixation_strap_piece = 15 (работа установки)
```

И запустить price seeding для существующих организаций.

### Приоритет
КРИТИЧЕСКИЙ — должен быть исправлен до ERP-уровня.
---

## CHAPTER 2 — EXTRAS / ADDONS / LAYERS AUDIT

---

## 8. DEPRECATED SLUG: addo_strap_cost

### Состояние
`addo_strap_cost` существует в `defaultPrices.ts` и отображается в UI страницы Цен.
В расчёте (`extrasCalculations.ts`) НЕ используется: там читаются
`addo_strap_grommet_cost` / `addo_strap_fastex_cost` (добавлены в Chapter 2 / CH2-BUG-01).

### Риск
Путаница у администратора: он видит "Ремешок — себес" в прайсе, меняет его,
но расчёт не реагирует. Фактически orphan slug.

### Решение (будущее)
- Переименовать в UI: "Расчёт: Ремешок — себес (шт) [устарел, не используется]"
- Скрыть из редактируемого прайса или пометить визуально серым

### Приоритет
Косметический. Не влияет на расчёты.

---

## 9. DEPRECATED SLUG: addo_zipper_cost

### Состояние
`addo_zipper_cost` существует в `defaultPrices.ts` (800 ₽/шт) и в `DEFAULT_ADDON_PRICE_MAP` (9999).
В `calculateExtrasAsServiceItems` для молнии стоимость рассчитывается как
`outerLenM × addo_zipper_cost_per_meter`, а не через `resolveAddonPrice('zipper').cost`.
Slug `addo_zipper_cost` в расчёте себестоимости молний не участвует.

### Следствие
Администратор видит "Молния — себес (шт)" в прайсе и может думать, что это
влияет на стоимость. На самом деле влияет `addo_zipper_cost_per_meter`.

### Решение (будущее)
Задокументировать в UI рядом с slug: «Не используется в расчёте. Стоимость молнии = длина × addo_zipper_cost_per_meter».

### Приоритет
Косметический / UX. Расчёт корректен, confusion только в UI прайса.

---

## 10. seed.ts — LEGACY SLUGS

### Состояние
`prisma/seed.ts` содержит устаревший прайс (pvc_700, eyelet_10, mont_std и др.),
которые НЕ используются ни в `pricingLogic.ts`, ни в `extrasCalculations.ts`.
Реальный рабочий прайс организации сидируется через страницу Цен на основе `defaultPrices.ts`.

### Риск
`prisma db seed` при первоначальной установке создаёт бесполезные строки Price.
В продакшене они не мешают (не читаются), но занимают место в БД и могут запутать.

### Решение (будущее)
- Синхронизировать `seed.ts` с `DEFAULT_PRICE_ROWS` из `defaultPrices.ts`
- Или сделать seed только для auth/org (без Price), а прайс инициализировать через UI onboarding

### Приоритет
Низкий. Не влияет на продакшен.

---

## 11. MOUNTING SNAPSHOT — done/cancelled без isPriceLocked

### Состояние (зафиксировано в §6, расширено в Chapter 2)
Если заказ переходит в `done`/`cancelled` без предшествующего `isPriceLocked`:
`mountingConfig.mountingSnapshot` может отсутствовать.
`calculateMounting` использует fallback `snapshot ?? prices` (live цены).
Для таких заказов монтажные расходы при открытии будут пересчитаны по текущим ценам.

### Риск
Исторический монтаж может отличаться от зафиксированного при закрытии заказа.
Актуально если тарифы бригад изменились после закрытия.

### Решение (будущее)
При переводе в done/cancelled: автоматически создать mountingSnapshot если отсутствует.
Добавить в `updateClientAction` при `isClosingNow && config.enabled && !config.mountingSnapshot`.

### Приоритет
Средний. Реализовать при введении автоматического done-workflow.