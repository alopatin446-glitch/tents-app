'use client';

/**
 * Панель настройки крепежа для одного изделия.
 * Исправлена ошибка типизации TS 2322 (sides configuration).
 */

import styles from './FastenersParams.module.css';
import {
  type FastenerConfig,
  type FastenerType,
  type FastenerFinish,
  type FastenerSideState,
  getInitialFastener,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Справочники
// ─────────────────────────────────────────────────────────────────────────────

const FASTENER_TYPE_OPTIONS: Array<{ value: FastenerType; label: string }> = [
  { value: 'eyelet_10',    label: 'Люверс 10 мм' },
  { value: 'strap',        label: 'Ремешок' },
  { value: 'staple_pa',    label: 'Полиамидная скоба' },
  { value: 'staple_metal', label: 'Железная скоба' },
  { value: 'french_lock',  label: 'Французский замок' },
  { value: 'none',         label: 'Без крепления' },
];

const FINISH_OPTIONS: Array<{ value: NonNullable<FastenerFinish>; label: string; premium: string }> = [
  { value: 'zinc',  label: 'Желтый цинк',     premium: '+10%' },
  { value: 'black', label: 'Черная фурнитура',   premium: '+15%' },
  { value: 'color', label: 'Цветная фурнитура',  premium: '+20%' },
];

const TOP_STATE_META: Record<string, { icon: string; label: string; hint: string }> = {
  default: { icon: '—',  label: 'Верх',  hint: 'люверс Ø10' },
  true:    { icon: '✓',  label: 'Верх',  hint: '' },
  false:   { icon: '✕',  label: 'Верх',  hint: '' },
};

interface FastenersParamsProps {
  fasteners: FastenerConfig;
  onChange: (config: FastenerConfig) => void;
  isReadOnly?: boolean;
}

export default function FastenersParams({
  fasteners,
  onChange,
  isReadOnly = false,
}: FastenersParamsProps) {
  
  const config = fasteners ?? getInitialFastener();

  // ── Смена типа (ИСПРАВЛЕНО: Типизация объектов сторон) ─────────────────────

  const handleTypeChange = (type: FastenerType): void => {
    if (isReadOnly) return;

    if (type === 'none') {
      onChange({
        ...config,
        type,
        sides: { top: false, right: false, bottom: false, left: false },
      });
    } else if (config.type === 'none') {
      // ИСПРАВЛЕНИЕ: Гарантируем, что объект соответствует FastenerConfig['sides']
      onChange({
        ...config,
        type,
        sides: { 
          top: 'default' as FastenerSideState, 
          right: true, 
          bottom: true, 
          left: true 
        },
      });
    } else {
      onChange({ ...config, type });
    }
  };

  // ── Клик по верхней стороне ────────────────────────────────────────────────

  const handleTopClick = (): void => {
    if (isReadOnly) return;
    const current = config.sides.top;
    let next: FastenerSideState;
    
    if (current === 'default') next = true;
    else if (current === true) next = false;
    else next = 'default';

    onChange({ 
      ...config, 
      sides: { ...config.sides, top: next } 
    });
  };

  // ── Тогл обычной стороны ───────────────────────────────────────────────────

  const handleSideToggle = (side: 'right' | 'bottom' | 'left'): void => {
    if (isReadOnly) return;
    // Явное приведение к boolean для исключения попадания 'default' в эти поля
    const currentValue = !!config.sides[side];
    onChange({
      ...config,
      sides: { ...config.sides, [side]: !currentValue },
    });
  };

  // ── Смена отделки ──────────────────────────────────────────────────────────

  const handleFinishClick = (finish: NonNullable<FastenerFinish>): void => {
    if (isReadOnly) return;
    onChange({
      ...config,
      finish: config.finish === finish ? null : finish,
    });
  };

  const sideStateClass = (state: FastenerSideState): string => {
    if (state === 'default') return styles.sideBtnDefault;
    if (state === true) return styles.sideBtnActive;
    return styles.sideBtnInactive;
  };

  const topValue = config.sides.top;
  const topMeta = TOP_STATE_META[String(topValue)] ?? TOP_STATE_META['false'];

  return (
    <div className={styles.wrapper}>
      <div className={styles.formSection}>
        <h4 className={styles.sectionLabel}>Тип крепежа</h4>
        <div className={styles.selectWrapper}>
          <select
            className={styles.selectInput}
            value={config.type}
            onChange={(e) => handleTypeChange(e.target.value as FastenerType)}
            disabled={isReadOnly}
          >
            {FASTENER_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {config.type !== 'none' && (
        <div className={styles.formSection}>
          <h4 className={styles.sectionLabel}>Стороны крепежа</h4>
          <div className={styles.sidesGrid}>
            <button
              className={`${styles.sideBtn} ${sideStateClass(config.sides.top)}`}
              onClick={handleTopClick}
              disabled={isReadOnly}
              type="button"
            >
              <span className={styles.sideBtnIcon}>{topMeta.icon}</span>
              <span className={styles.sideBtnLabel}>{topMeta.label}</span>
            </button>

            {(['right', 'bottom', 'left'] as const).map((side) => (
              <button
                key={side}
                className={`${styles.sideBtn} ${sideStateClass(config.sides[side])}`}
                onClick={() => handleSideToggle(side)}
                disabled={isReadOnly}
                type="button"
              >
                <span className={styles.sideBtnIcon}>{config.sides[side] ? '✓' : '✕'}</span>
                <span className={styles.sideBtnLabel}>
                  {side === 'right' ? 'Право' : side === 'bottom' ? 'Низ' : 'Лево'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {config.type !== 'none' && (
        <div className={styles.formSection}>
          <h4 className={styles.sectionLabel}>Отделка фурнитуры</h4>
          <div className={styles.finishGroup}>
            {FINISH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.finishBtn} ${config.finish === opt.value ? styles.finishBtnActive : ''}`}
                onClick={() => handleFinishClick(opt.value)}
                disabled={isReadOnly}
              >
                <span className={styles.finishLabel}>{opt.label}</span>
                <span className={styles.finishPremium}>{opt.premium}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}