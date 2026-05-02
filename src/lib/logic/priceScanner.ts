import { DEFAULT_PRICE_ROWS } from '@/constants/defaultPrices';

/**
 * СКАНЕР ПРАЙСА
 * Достает значение из единого массива по уникальному слагу (ID).
 */
export const getPriceBySlug = (slug: string): number => {
  const row = DEFAULT_PRICE_ROWS.find(r => r.slug === slug);
  if (!row) {
    console.error(`[AI-ДИРЕКТОР] ОШИБКА: Slug "${slug}" не найден в прайсе!`);
    return 0;
  }
  return row.value;
};