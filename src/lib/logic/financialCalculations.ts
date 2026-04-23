/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Финансовые расчёты
 * @module src/lib/logic/financialCalculations.ts
 */

export interface ClientFinancials {
  totalPrice: number;
  advance: number;
  costPrice: number;
}

export interface ClientFinancialResult {
  balance: number;
  profit: number;
  marginPercent: number | null;
  isOverpaid: boolean;
  isUnprofitable: boolean;
}

export function calculateClientBalance(totalPrice: number, advance: number): number {
  return roundMoney(totalPrice - advance);
}

export function calculateProfit(totalPrice: number, costPrice: number): number {
  return roundMoney(totalPrice - costPrice);
}

export function calculateMarginPercent(totalPrice: number, costPrice: number): number | null {
  if (totalPrice === 0) return null;
  return Math.round(((totalPrice - costPrice) / totalPrice) * 100 * 10) / 10;
}

export function calculateClientFinancials(financials: ClientFinancials): ClientFinancialResult {
  const { totalPrice, advance, costPrice } = financials;
  const balance = calculateClientBalance(totalPrice, advance);
  const profit = calculateProfit(totalPrice, costPrice);
  const marginPercent = calculateMarginPercent(totalPrice, costPrice);
  return { balance, profit, marginPercent, isOverpaid: balance < 0, isUnprofitable: profit < 0 };
}

export function toFinancialNumber(
  value: string | number | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return rubleFormatter.format(value);
}

export function formatMargin(marginPercent: number | null): string {
  if (marginPercent === null) return '—';
  return `${marginPercent}%`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}