'use client';

import React from 'react';
import { WindowItem } from './ItemsStep';

interface DrawingCanvasProps {
  item: WindowItem;
}

function toNumber(value: number | string, fallback = 0): number {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function DrawingCanvas({ item }: DrawingCanvasProps) {
  const vbW = 600;
  const vbH = 500;
  const padding = 80;

  const drawW = vbW - padding * 2;
  const drawH = vbH - padding * 2;

  const kantTop = toNumber(item.kantTop, 0);
  const kantRight = toNumber(item.kantRight, 0);
  const kantBottom = toNumber(item.kantBottom, 0);
  const kantLeft = toNumber(item.kantLeft, 0);

  const widthTop = toNumber(item.widthTop, 0);
  const widthBottom = toNumber(item.widthBottom, 0);
  const heightLeft = toNumber(item.heightLeft, 0);
  const heightRight = toNumber(item.heightRight, 0);
  const crossbar = toNumber(item.crossbar, 0);

  const maxKant = Math.max(kantTop, kantRight, kantBottom, kantLeft, 5);
  const maxItemW = Math.max(widthTop, widthBottom, 1);
  const maxItemH = Math.max(heightLeft, heightRight, 1);

  const scale = Math.min(
    drawW / (maxItemW + maxKant * 2),
    drawH / (maxItemH + maxKant * 2)
  );

  const startX = (vbW - maxItemW * scale) / 2;
  const startY = (vbH - maxItemH * scale) / 2;

  const x1 = startX;
  const y1 = startY;
  const x2 = x1 + widthTop * scale;
  const y2 = y1 + (heightLeft - heightRight) * scale;
  const x4 = startX;
  const y4 = startY + heightLeft * scale;
  const x3 = x4 + widthBottom * scale;
  const y3 = y4;

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

  const colorMap: { [key: string]: string } = {
    Белый: '#FFFFFF',
    'Светло-серый': '#D1D5DB',
    Серый: '#6B7280',
    Графит: '#374151',
    Черный: '#000000',
    Коричневый: '#54301a',
    Бежевый: '#F5F5DC',
    Синий: '#1E3A8A',
  };

  const strokeColor = colorMap[item.kantColor] || '#54301a';
  const isALower = y1 > y2;
  const parallelY = isALower ? y1 : y2;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', maxHeight: '100%' }}
      >
        <path
          d={outerPath}
          fill={strokeColor}
          style={{ transition: 'fill 0.4s ease' }}
        />
        <path
          d={innerPath}
          fill="#aac7ee"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
          style={{ transition: 'all 0.3s ease' }}
        />

        {item.isTrapezoid && crossbar > 0 && (
          <g>
            <line
              x1={x1}
              y1={parallelY}
              x2={x3}
              y2={parallelY}
              stroke="#7BFF00"
              strokeWidth="2"
              strokeDasharray="6,4"
            />
            <rect
              x={(x1 + x3) / 2 - 25}
              y={parallelY + 6}
              width="50"
              height="24"
              rx="4"
              fill="#a1a1a1"
              stroke="rgba(123, 255, 0, 0.4)"
              strokeWidth="1"
            />
            <text
              x={(x1 + x3) / 2}
              y={parallelY + 23}
              fill="#7BFF00"
              fontSize="14"
              fontWeight="900"
              textAnchor="middle"
            >
              {crossbar}
            </text>
          </g>
        )}

        <g
          fontSize="24"
          fontWeight="bold"
          fill="#fff"
          style={{ pointerEvents: 'none' }}
        >
          <text x={x1 - 30} y={y1 - 10}>
            a
          </text>
          <text x={x2 + 10} y={y2 - 10}>
            b
          </text>
          <text x={x3 + 10} y={y3 + 30}>
            c
          </text>
          <text x={x4 - 30} y={y4 + 30}>
            d
          </text>
        </g>

        <g
          fontSize="16"
          fontWeight="600"
          fill="rgba(255,255,255,0.8)"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 20}>
            {widthTop}
          </text>
          <text x={(x3 + x4) / 2} y={y4 + 30}>
            {widthBottom}
          </text>
          <text
            x={x1 - 45}
            y={(y1 + y4) / 2}
            transform={`rotate(-90, ${x1 - 45}, ${(y1 + y4) / 2})`}
          >
            {heightLeft}
          </text>
          <text
            x={x3 + 45}
            y={(y2 + y3) / 2}
            transform={`rotate(90, ${x3 + 45}, ${(y2 + y3) / 2})`}
          >
            {heightRight}
          </text>
        </g>
      </svg>
    </div>
  );
}