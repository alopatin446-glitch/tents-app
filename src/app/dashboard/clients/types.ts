/**
 * Мост обратной совместимости.
 * KanbanBoard, StageColumn, ClientCard делают `import from './types'` —
 * перенаправляем в канонический @/types.
 */
export type { Client, Stage, Product, WindowItem } from '@/types';