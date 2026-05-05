'use client';

/**
 * Диагностический блок «ПЛАН РАСКРОЯ ЗАКАЗА».
 *
 * Показывает мастеру на производстве ту же математику раскроя,
 * которая была рассчитана при создании заказа:
 *  — параметры раскроя каждого изделия (поворот, длина отреза, ширина списания)
 *  — площади: productionArea (реальный расход) и retailArea (чек клиента)
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
  SOLDER_ALLOWANCE,
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
// Форматирование
// ─────────────────────────────────────────────────────────────────────────────

function getMaterialLabel(material: string): string {
  switch (material) {
    case 'PVC_700':  return 'ПВХ 700';
    case 'TINTED':   return 'Тонировка';
    case 'TPU':      return 'TPU';
    case 'MOSQUITO': return 'Москитка';
    default:         return material || '—';
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
// Построение строки диагностики
// ─────────────────────────────────────────────────────────────────────────────

function buildDebugRow(item: WindowItem, index: number): WindowDebugRow {
  const geometry = calculateWindowGeometry(item);

  // Все размерные параметры — только из ядра, никакой ручной арифметики в UI
  const innerWidth  = geometry.maxWidth;
  const innerHeight = geometry.maxHeight;
  const cutWidthRaw  = geometry.cutWidth;
  const cutHeightRaw = geometry.cutHeight;

  return {
    id:             item.id,
    index,
    name:           item.name,
    material:       item.material || 'PVC_700',
    innerWidth,
    innerHeight,
    cutWidthRaw,
    cutHeightRaw,
    widthAcrossRoll: geometry.cutWidth,   // из ядра
    cutLength:       geometry.cutHeight,  // из ядра
    chargedWidth:    geometry.rollWidth,  // ширина рулона = ширина списания
    geometry,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Пропсы
// ─────────────────────────────────────────────────────────────────────────────

interface CuttingDiagnosticsProps {
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
      <h4 className={styles.heading}>План раскроя заказа</h4>

      <div className={styles.description}>
        Диагностика показывает текущий ответ{' '}
        <b>calculateWindowGeometry()</b> по каждому изделию.
        <br />
        <b>Производство</b> — реальная площадь (основа ЗП сварщика).{' '}
        <b>Чек</b> — площадь по габариту Max W × Max H (основа розничной цены).
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
            {/* Шапка */}
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Окно {row.index + 1}: {row.name}
                {row.geometry.type === 'trapezoid' && (
                  <span style={{ color: '#FFD600', marginLeft: 6, fontSize: '0.65rem' }}>
                    ◆ трапеция
                  </span>
                )}
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

              {/* Заготовка */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Заготовка +{SOLDER_ALLOWANCE} см:</span>
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

              {/* ── Разделение площадей (Закон Директора) ───────────────── */}

              {/* Производство: реальная площадь → ЗП сварщика */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Производство:</span>
                <span className={styles.paramValue}>
                  {row.geometry.productionArea.toFixed(4)} м²
                </span>
              </div>

              {/* Чек: Max W × Max H → розничная цена */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Чек (габарит):</span>
                <span className={styles['paramValue--ok']}>
                  {row.geometry.retailArea.toFixed(4)} м²
                </span>
              </div>

              {/* С кантом */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>С кантом:</span>
                <span className={styles.paramValue}>
                  {formatArea(row.geometry.areaWithKant)}
                </span>
              </div>

              {/* Списание по рулону */}
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Списание:</span>
                <span className={styles['paramValue--ok']}>
                  {formatArea(row.geometry.cutArea)}
                </span>
              </div>

              {/* Детализация канта и перерасхода */}
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
                  <span className={styles.paramLabel}>Перерасход плёнки:</span>
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

              {/* Длины сторон (для трапеции) */}
              {row.geometry.type === 'trapezoid' && (
                <div className={styles.overflowCell}>
                  <div className={styles.diagnosticRow}>
                    <span>Верх (sideTop):</span>
                    <strong>{row.geometry.sideTop.toFixed(1)} см</strong>
                  </div>
                  <div className={styles.diagnosticRow}>
                    <span>Низ:</span>
                    <strong>{row.geometry.sideBottom.toFixed(1)} см</strong>
                  </div>
                  <div className={styles.diagnosticRow}>
                    <span>Лево / Право:</span>
                    <strong>
                      {row.geometry.sideLeft.toFixed(1)} / {row.geometry.sideRight.toFixed(1)} см
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Предупреждения */}
            {(row.geometry.isOverSize || !row.geometry.isExact) && (
              <div className={styles.warnings}>
                {row.geometry.isOverSize && (
                  <div className={styles.warnOversize}>
                    ⚠ Негабарит: алгоритм берёт максимальный рулон,
                    площадь считается по фактической ширине заготовки.
                  </div>
                )}
                {!row.geometry.isExact && (
                  <div className={styles.warnApprox}>
                    ⚠ Приближённый расчёт: трапеция включена, но данных crossbar нет.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Сводка по группам */}
      <div className={styles.groupsHeading}>
        Группы раскроя (calculateOrderOptimization)
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