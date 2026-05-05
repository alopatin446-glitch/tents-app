/**
 * @deprecated ЗАГЛУШКА. НЕ ИСПОЛЬЗОВАТЬ.
 *
 * Этот файл — нереализованный черновик.
 * Реальный расчёт находится в: src/logic/core/Calculationservice.ts
 *
 * Функция намеренно выбрасывает ошибку при вызове, чтобы исключить
 * случайное использование вместо основного расчётного ядра.
 * Возврат нулей (materialArea: 0, stripsCount: 0) без ошибки
 * привёл бы к молчаливому обнулению всего расчёта.
 */

export interface CalculationParams {
  rollWidth: number;      // Ширина рулона (например, 1400мм или 2000мм)
  seamAllowance: number;  // Припуск на пайку (например, 30мм)
  shrinkage: number;      // Усадка (например, 1%)
  kantWidth: number;      // Ширина канта (окантовки)
}

/**
 * @deprecated Не реализовано. Выбрасывает ошибку при вызове.
 * Используй src/logic/core/Calculationservice.ts
 */
export const calculateTents = (_window: unknown, _params: CalculationParams): never => {
  throw new Error(
    '[calculateTents] Вызов заглушки из src/lib/services/calculationService.ts. ' +
    'Используй реальный расчёт: src/logic/core/Calculationservice.ts'
  );
};