'use client';

/**
 * Диагностический блок «ПЛАН РАСКРОЯ ЗАКАЗА».
 *
 * Показывает мастеру на производстве ту же математику раскроя,
 * которая была рассчитана при создании заказа:
 *  — параметры раскроя каждого изделия (поворот, длина отреза, ширина списания)
 *  — площади (полотно / с кантом / итоговое списание)
 *  — детализацию перерасхода канта
 *  — сводку по группам из calculateOrderOptimization()
 *
 * Компонент не хранит локального состояния — только отображает
 * данные, полученные через пропсы.
 *
 * @module src/components/calculation/shared/CuttingDiagnostics.tsx
 */

import { useMemo } from 'react';
import { type WindowItem } from '@/types';
import {
  calculateWindowGeometry,
  calculateOrderOptimization,
  formatArea,
  type WindowGeometry,
  type OrderOptimization,
} from '@/lib/logic/windowCalculations';
import styles from './CuttingDiagnostics.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Локальные типы
// ─────────────────────────────────────────────────────────────────────────────

interface WindowDebugRow {
  id: number;
  index: number;
  name: string;
  material: string;
  innerWidth: number;
  innerHeight: number;
  cutWidthRaw: number;
  cutHeightRaw: number;
  widthAcrossRoll: number;
  cutLength: number;
  chargedWidth: number;
  geometry: WindowGeometry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции форматирования
// ─────────────────────────────────────────────────────────────────────────────

function getMaterialLabel(material: string): string {
  switch (material) {
    case 'PVC_700':
      return 'ПВХ 700';
    case 'TINTED':
      return 'Тонировка';
    case 'TPU':
      return 'TPU';
    case 'MOSQUITO':
      return 'Москитка';
    default:
      return material || '—';
  }
}

function formatCm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(0)} см`;
}

function formatM(valueCm: number): string {
  if (!Number.isFinite(valueCm)) return '—';
  return `${(valueCm / 100).toFixed(2)} м`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Построение строки диагностики по одному изделию
// ─────────────────────────────────────────────────────────────────────────────

const SOLDER_ALLOWANCE = 6; // +6 см на припуски — дублируем константу, чтобы не создавать циклическую зависимость

function buildDebugRow(item: WindowItem, index: number): WindowDebugRow {
  const geometry = calculateWindowGeometry(item);
  const innerWidth = Math.max(Number(item.widthTop), Number(item.widthBottom));
  const innerHeight = Math.max(Number(item.heightLeft), Number(item.heightRight));
  const cutWidthRaw = innerWidth + SOLDER_ALLOWANCE;
  const cutHeightRaw = innerHeight + SOLDER_ALLOWANCE;
  const widthAcrossRoll = geometry.isRotated ? cutHeightRaw : cutWidthRaw;
  const cutLength = geometry.isRotated ? cutWidthRaw : cutHeightRaw;
  const chargedWidth = geometry.isOverSize
    ? widthAcrossRoll
    : Math.max(Number(geometry.rollWidth), widthAcrossRoll);

  return {
    id: item.id,
    index,
    name: item.name,
    material: item.material || 'PVC_700',
    innerWidth,
    innerHeight,
    cutWidthRaw,
    cutHeightRaw,
    widthAcrossRoll,
    cutLength,
    chargedWidth,
    geometry,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Пропсы
// ─────────────────────────────────────────────────────────────────────────────

interface CuttingDiagnosticsProps {
  /** Все изделия заказа. На их основе строятся строки раскроя и сводка групп. */
  windows: WindowItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function CuttingDiagnostics({ windows }: CuttingDiagnosticsProps) {
  const debugRows: WindowDebugRow[] = useMemo(
    () => windows.map((item, index) => buildDebugRow(item, index)),
    [windows],
  );

  const orderSummary: OrderOptimization = useMemo(
    () => calculateOrderOptimization(windows),
    [windows],
  );

  return (
    <div className={styles.root}>
      {/* Заголовок */}
      <h4 className={styles.heading}>План раскроя заказа</h4>

      {/* Пояснение */}
      <div className={styles.description}>
        Диагностика показывает текущий ответ{' '}
        <b>calculateWindowGeometry()</b> по каждому изделию.
        Алгоритм расчёта здесь не меняется — только выводится наружу.
      </div>

      {/* Карточки изделий */}
      <div className={styles.batchList}>
        {debugRows.map((row) => (
          <div
            key={row.id}
            className={
              row.geometry.isOverSize
                ? `${styles.windowCard} ${styles['windowCard--oversize']}`
                : styles.windowCard
            }
          >
            {/* Шапка карточки */}
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Окно {row.index + 1}: {row.name}
              </span>
              <span className={styles.cardMaterial}>
                {getMaterialLabel(row.material)} / рулон {row.geometry.rollWidth} см
              </span>
            </div>

            {/* Сетка параметров */}
            <div className={styles.paramGrid}>

              {/* Внутренний размер */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Внутренний размер:</span>
                <span className={styles.paramValue}>
                  {formatCm(row.innerWidth)} × {formatCm(row.innerHeight)}
                </span>
              </div>

              {/* Заготовка +6 см */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Заготовка +6 см:</span>
                <span className={styles.paramValue}>
                  {formatCm(row.cutWidthRaw)} × {formatCm(row.cutHeightRaw)}
                </span>
              </div>

              {/* Поворот */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Поворот:</span>
                <span
                  className={
                    row.geometry.isRotated
                      ? styles['paramValue--rotated']
                      : styles['paramValue--ok']
                  }
                >
                  {row.geometry.isRotated ? '90°' : '0°'}
                </span>
              </div>

              {/* Поперёк рулона */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Поперёк рулона:</span>
                <span className={styles.paramValue}>{formatCm(row.widthAcrossRoll)}</span>
              </div>

              {/* Длина отреза */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Длина отреза:</span>
                <span className={styles.paramValue}>{formatM(row.cutLength)}</span>
              </div>

              {/* Ширина списания */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Ширина списания:</span>
                <span className={styles.paramValue}>{formatCm(row.chargedWidth)}</span>
              </div>

              {/* Площадь полотна */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Полотно:</span>
                <span className={styles.paramValue}>
                  {formatArea(row.geometry.areaMaterial)}
                </span>
              </div>

              {/* Площадь с кантом */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>С кантом:</span>
                <span className={styles.paramValue}>
                  {formatArea(row.geometry.areaWithKant)}
                </span>
              </div>

              {/* Итоговое списание */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Списание:</span>
                <span className={styles['paramValue--ok']}>
                  {formatArea(row.geometry.cutArea)}
                </span>
              </div>

              {/* Детализация перерасхода + итог */}
              <div className={styles.overflowCell}>
                <div className={styles.diagnosticRow}>
                  <span>Кант в изделии:</span>
                  <strong>{row.geometry.kantAreaInProduct.toFixed(2)} м²</strong>
                </div>
                <div className={styles.diagnosticRow}>
                  <span>Перерасход канта:</span>
                  <strong>{row.geometry.kantWasteArea.toFixed(2)} м²</strong>
                </div>
                <div className={styles.diagnosticRow}>
                  <span>Кант всего:</span>
                  <strong>{row.geometry.kantTotalArea.toFixed(2)} м²</strong>
                </div>
                <div className={styles.paramRow} style={{ marginTop: 2 }}>
                  <span className={styles.paramLabel}>Перерасход:</span>
                  <span
                    className={
                      row.geometry.wasteArea > 0
                        ? styles['paramValue--waste']
                        : styles['paramValue--ok']
                    }
                  >
                    {formatArea(row.geometry.wasteArea)}
                  </span>
                </div>
              </div>
            </div>

            {/* Предупреждения */}
            {(row.geometry.isOverSize || !row.geometry.isExact) && (
              <div className={styles.warnings}>
                {row.geometry.isOverSize && (
                  <div className={styles.warnOversize}>
                    ⚠ Негабарит: текущий алгоритм берёт максимальный рулон материала,
                    но площадь считает по фактической ширине заготовки.
                  </div>
                )}
                {!row.geometry.isExact && (
                  <div className={styles.warnApprox}>
                    ⚠ Приближённый расчёт: трапеция включена, но точных данных для неё
                    не хватает.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Сводка по группам */}
      <div className={styles.groupsHeading}>
        Группы, которые сейчас возвращает calculateOrderOptimization()
      </div>

      {orderSummary.batches.length > 0 ? (
        <div className={styles.batchList}>
          {orderSummary.batches.map((batch, idx) => (
            <div
              key={`${batch.material}-${batch.rollWidth}-${idx}`}
              className={styles.groupCard}
            >
              <div className={styles.groupHeader}>
                <span className={styles.groupMaterial}>
                  {getMaterialLabel(batch.material)}
                </span>
                <span className={styles.groupRoll}>{batch.rollWidth} см</span>
              </div>

              <div className={styles.groupStats}>
                <div className={styles.groupStatRow}>
                  <span className={styles.groupStatLabel}>Длина:</span>
                  <span className={styles.groupStatValue}>
                    {(batch.totalLength / 100).toFixed(2)} м.п.
                  </span>
                </div>
                <div className={styles.groupStatRow}>
                  <span className={styles.groupStatLabel}>ID изделий:</span>
                  <span className={styles.groupStatValue}>
                    {batch.windowIds.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyGroups}>Нет изделий для расчёта.</div>
      )}

      {/* Итого по заказу */}
      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Списание всего заказа:</span>
          <span className={styles.totalValue}>
            {orderSummary.totalCutArea.toFixed(2)} м²
          </span>
        </div>
        <div className={`${styles.totalRow} ${styles['totalRow--waste']}`}>
          <span>Перерасход всего заказа:</span>
          <span>{orderSummary.totalWasteArea.toFixed(2)} м²</span>
        </div>
      </div>
    </div>
  );
}