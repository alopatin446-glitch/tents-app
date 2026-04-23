'use client';

import type { WindowItem, FastenerSideState } from '@/types';
import { getInitialFastener } from '@/types'; // Используем новое имя

interface DrawingCanvasProps {
  item: WindowItem;
  showFasteners?: boolean;
}

// ... (остальной код функции getDotsAlongLine остается без изменений) ...

// ВАЖНО: Найди внутри компонента DrawingCanvas (примерно 154 строка) 
// строку, где используется fasteners. Если там ошибка, убедись, что код такой:
// const fasteners = item.fasteners || getInitialFastener();

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные типы для расчёта крепежа
// ─────────────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

/**
 * Вычисляет равноудалённые точки вдоль отрезка.
 * Целевой шаг — 35 см (середина диапазона 30–40 см), в SVG-единицах = targetStepSvg.
 * Точки центрируются внутри каждого интервала (t = (i + 0.5) / n).
 */
function getDotsAlongLine(start: Point, end: Point, targetStepSvg: number): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLen = Math.sqrt(dx * dx + dy * dy);
  if (totalLen < 1) return [];
  const n = Math.max(1, Math.round(totalLen / targetStepSvg));
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return { x: start.x + t * dx, y: start.y + t * dy };
  });
}

/**
 * Рендерит кружки крепежа вдоль одного ребра.
 * Для 'default': кружок с внутренним отверстием (люверс Ø10).
 * Для true: закрашенный кружок (выбранный тип крепежа).
 */
function renderSideDots(
  start: Point,
  end: Point,
  state: FastenerSideState,
  targetStepSvg: number,
  circleR: number,
  sideKey: string,
): React.ReactNode {
  if (state === false) return null;
  const dots = getDotsAlongLine(start, end, targetStepSvg);
  const isDefault = state === 'default';

  return dots.map((dot, i) => (
    <g key={`${sideKey}-${i}`}>
      <circle
        cx={dot.x}
        cy={dot.y}
        r={circleR}
        fill={isDefault ? 'rgba(190, 190, 190, 0.9)' : 'rgba(220, 220, 220, 0.95)'}
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth="1"
      />
      {/* Для 'default' (люверс) рисуем внутреннее отверстие */}
      {isDefault && (
        <circle
          cx={dot.x}
          cy={dot.y}
          r={circleR * 0.42}
          fill="rgba(30, 40, 60, 0.85)"
          stroke="rgba(150, 150, 150, 0.7)"
          strokeWidth="0.8"
        />
      )}
    </g>
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function DrawingCanvas({ item, showFasteners = false }: DrawingCanvasProps) {
  const vbW = 600;
  const vbH = 500;
  const padding = 80;

  const drawW = vbW - padding * 2;
  const drawH = vbH - padding * 2;

  const { kantTop, kantRight, kantBottom, kantLeft } = item;
  const { widthTop, widthBottom, heightLeft, heightRight, crossbar } = item;

  const maxKant = Math.max(kantTop, kantRight, kantBottom, kantLeft, 5);
  const maxItemW = Math.max(widthTop, widthBottom, 1);
  const maxItemH = Math.max(heightLeft, heightRight, 1);

  const scale = Math.min(
    drawW / (maxItemW + maxKant * 2),
    drawH / (maxItemH + maxKant * 2),
  );

  const startX = (vbW - maxItemW * scale) / 2;
  const startY = (vbH - maxItemH * scale) / 2;

  // Вершины внутреннего полотна (a, b, c, d)
  const x1 = startX;
  const y1 = startY;
  const x2 = x1 + widthTop * scale;
  const y2 = y1 + (heightLeft - heightRight) * scale;
  const x4 = startX;
  const y4 = startY + heightLeft * scale;
  const x3 = x4 + widthBottom * scale;
  const y3 = y4;

  // Вершины внешнего канта
  const outX1 = x1 - kantLeft * scale;
  const outY1 = y1 - kantTop * scale;
  const outX2 = x2 + kantRight * scale;
  const outY2 = y2 - kantTop * scale;
  const outX3 = x3 + kantRight * scale;
  const outY3 = y3 + kantBottom * scale;
  const outX4 = x4 - kantLeft * scale;
  const outY4 = y4 + kantBottom * scale;

  const innerPath = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  const outerPath = `M ${outX1} ${outY1} L ${outX2} ${outY2} L ${outX3} ${outY3} L ${outX4} ${outY4} Z`;

  const colorMap: Record<string, string> = {
    Белый: '#FFFFFF', 'Светло-серый': '#D1D5DB', Серый: '#6B7280',
    Графит: '#374151', Черный: '#000000', Коричневый: '#54301a',
    Бежевый: '#F5F5DC', Синий: '#1E3A8A',
  };
  const strokeColor = colorMap[item.kantColor] ?? '#54301a';

  const isALower = y1 > y2;
  const parallelY = isALower ? y1 : y2;

  // ── Крепёж ──────────────────────────────────────────────────────────────────
  // Целевой шаг 35 см в SVG-единицах. Радиус кружка ~40% от ширины канта.
  const targetStepSvg = 35 * scale;
  const circleR = Math.max(4, Math.min(9, Math.max(kantTop, kantRight, kantBottom, kantLeft) * scale * 0.4));

  const fasteners = item.fasteners || getInitialFastener();

  // Средние точки кантовых рёбер (midpoint между внутренним и внешним контуром)
  const midTop1: Point    = { x: (x1 + outX1) / 2, y: (y1 + outY1) / 2 };
  const midTop2: Point    = { x: (x2 + outX2) / 2, y: (y2 + outY2) / 2 };
  const midRight2: Point  = { x: (x2 + outX2) / 2, y: (y2 + outY2) / 2 };
  const midRight3: Point  = { x: (x3 + outX3) / 2, y: (y3 + outY3) / 2 };
  const midBottom3: Point = { x: (x3 + outX3) / 2, y: (y3 + outY3) / 2 };
  const midBottom4: Point = { x: (x4 + outX4) / 2, y: (y4 + outY4) / 2 };
  const midLeft4: Point   = { x: (x4 + outX4) / 2, y: (y4 + outY4) / 2 };
  const midLeft1: Point   = { x: (x1 + outX1) / 2, y: (y1 + outY1) / 2 };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', maxHeight: '100%' }}
      >
        {/* Кант (внешний контур) */}
        <path d={outerPath} fill={strokeColor} style={{ transition: 'fill 0.4s ease' }} />

        {/* Полотно (внутренний контур) */}
        <path
          d={innerPath}
          fill="#aac7ee"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
          style={{ transition: 'all 0.3s ease' }}
        />

        {/* Перемычка трапеции */}
        {item.isTrapezoid && crossbar > 0 && (
          <g>
            <line x1={x1} y1={parallelY} x2={x3} y2={parallelY} stroke="#7BFF00" strokeWidth="2" strokeDasharray="6,4" />
            <rect x={(x1 + x3) / 2 - 25} y={parallelY + 6} width="50" height="24" rx="4" fill="#a1a1a1" stroke="rgba(123,255,0,0.4)" strokeWidth="1" />
            <text x={(x1 + x3) / 2} y={parallelY + 23} fill="#7BFF00" fontSize="14" fontWeight="900" textAnchor="middle">{crossbar}</text>
          </g>
        )}

        {/* Метки угловых точек */}
        <g fontSize="24" fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none' }}>
          <text x={x1 - 30} y={y1 - 10}>a</text>
          <text x={x2 + 10} y={y2 - 10}>b</text>
          <text x={x3 + 10} y={y3 + 30}>c</text>
          <text x={x4 - 30} y={y4 + 30}>d</text>
        </g>

        {/* Размерные метки */}
        <g fontSize="16" fontWeight="600" fill="rgba(255,255,255,0.8)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
          <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 20}>{widthTop}</text>
          <text x={(x3 + x4) / 2} y={y4 + 30}>{widthBottom}</text>
          <text x={x1 - 45} y={(y1 + y4) / 2} transform={`rotate(-90, ${x1 - 45}, ${(y1 + y4) / 2})`}>{heightLeft}</text>
          <text x={x3 + 45} y={(y2 + y3) / 2} transform={`rotate(90, ${x3 + 45}, ${(y2 + y3) / 2})`}>{heightRight}</text>
        </g>

        {/* Крепёж — рисуем только при showFasteners и ненулевом типе */}
        {showFasteners && fasteners.type !== 'none' && (
          <g>
            {renderSideDots(midTop1, midTop2, fasteners.sides.top, targetStepSvg, circleR, 'top')}
            {renderSideDots(midRight2, midRight3, fasteners.sides.right, targetStepSvg, circleR, 'right')}
            {renderSideDots(midBottom3, midBottom4, fasteners.sides.bottom, targetStepSvg, circleR, 'bottom')}
            {renderSideDots(midLeft4, midLeft1, fasteners.sides.left, targetStepSvg, circleR, 'left')}
          </g>
        )}
      </svg>
    </div>
  );
}