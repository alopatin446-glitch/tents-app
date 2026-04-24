'use client';

/**
 * DrawingCanvas — SVG window visualizer.
 *
 * Rendering layers (z-order):
 *   1. Outer contour (kant)
 *   2. Inner material (light opening)
 *   3. Crossbar label (trapezoid)
 *   4. Corner labels + dimension labels
 *   5. Fasteners (conditional on showFasteners)
 *   6. Extras (conditional on showExtras):
 *        a. Skirt      — filled area below outer bottom
 *        b. Weight     — thick accent line along outer bottom
 *        c. Welding    — dashed marker lines on material
 *        d. Dividers   — colored band lines on material
 *        e. Zippers    — colored tape bands on material
 *        f. Cutouts    — red/green rectangles with fill
 *        g. Straps     — symbols along outer top edge
 *
 * @module src/components/calculation/DrawingCanvas.tsx
 */

import React from 'react';
import type {
  WindowItem,
  FastenerSideState,
  AdditionalElements,
  ZipperItem,
  DividerItem,
  CutoutItem,
  WeldingItem,
} from '@/types';
import { getInitialFastener } from '@/types';
import { deriveStrapCount, getOuterTopCm } from '@/lib/logic/extrasCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Shared geometry types
// ─────────────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

/** Four corners of a polygon in order: TL, TR, BR, BL. */
interface QuadCorners {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linear interpolation between two SVG points at parameter t ∈ [0, 1].
 * Required by spec for trapezoid-safe extras rendering.
 */
function getEdgePoint(start: Point, end: Point, t: number): Point {
  const tc = Math.max(0, Math.min(1, t));
  return {
    x: start.x + tc * (end.x - start.x),
    y: start.y + tc * (end.y - start.y),
  };
}

function vecLen(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Converts a window-space position (cm) to an SVG point using bilinear
 * interpolation over the inner quad corners.
 * Works correctly for both rectangular and trapezoid windows.
 */
function windowToSvg(
  wx: number,
  wy: number,
  inner: QuadCorners,
  item: WindowItem,
): Point {
  const tX = item.widthTop > 0 ? wx / item.widthTop : 0;
  const tY = item.heightLeft > 0 ? wy / item.heightLeft : 0;
  const top = getEdgePoint(inner.tl, inner.tr, tX);
  const bottom = getEdgePoint(inner.bl, inner.br, tX);
  return getEdgePoint(top, bottom, tY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fastener helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
        cx={dot.x} cy={dot.y} r={circleR}
        fill={isDefault ? 'rgba(190,190,190,0.9)' : 'rgba(220,220,220,0.95)'}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1"
      />
      {isDefault && (
        <circle
          cx={dot.x} cy={dot.y} r={circleR * 0.42}
          fill="rgba(30,40,60,0.85)"
          stroke="rgba(150,150,150,0.7)" strokeWidth="0.8"
        />
      )}
    </g>
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras rendering helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the skirt — translucent fill below outer bottom edge.
 */
function renderSkirt(
  outer: QuadCorners,
  skirtWidth: number,
  scale: number,
): React.ReactNode {
  if (skirtWidth <= 0) return null;
  const sh = skirtWidth * scale;
  // The outer bottom goes from BL to BR. Extend it downward by sh.
  const path = [
    `M ${outer.bl.x} ${outer.bl.y}`,
    `L ${outer.br.x} ${outer.br.y}`,
    `L ${outer.br.x} ${outer.br.y + sh}`,
    `L ${outer.bl.x} ${outer.bl.y + sh}`,
    'Z',
  ].join(' ');
  return (
    <path
      key="skirt"
      d={path}
      fill="rgba(180,220,255,0.35)"
      stroke="rgba(100,160,220,0.8)"
      strokeWidth="1.5"
      strokeDasharray="6 3"
    />
  );
}

/**
 * Renders the weight bar — thick colored line along outer bottom edge.
 */
function renderWeight(outer: QuadCorners): React.ReactNode {
  return (
    <line
      key="weight"
      x1={outer.bl.x} y1={outer.bl.y}
      x2={outer.br.x} y2={outer.br.y}
      stroke="#1a56db"
      strokeWidth="5"
      strokeLinecap="round"
      opacity="0.85"
    />
  );
}

/**
 * Renders a single welding marker line on the material.
 */
function renderWeldingItem(
  w: WeldingItem,
  inner: QuadCorners,
  item: WindowItem,
  scale: number,
): React.ReactNode {
  let startPt: Point;
  let endPt: Point;

  if (w.orientation === 'horizontal') {
    const tY = item.heightLeft > 0 ? w.position / item.heightLeft : 0;
    const leftPt = getEdgePoint(inner.tl, inner.bl, tY);
    const rightPt = getEdgePoint(inner.tr, inner.br, tY);
    startPt = leftPt;
    endPt = rightPt;
  } else {
    const tX = item.widthTop > 0 ? w.position / item.widthTop : 0;
    const topPt = getEdgePoint(inner.tl, inner.tr, tX);
    const bottomPt = getEdgePoint(inner.bl, inner.br, tX);
    startPt = topPt;
    endPt = bottomPt;
  }

  return (
    <line
      key={`welding-${w.id}`}
      x1={startPt.x} y1={startPt.y}
      x2={endPt.x} y2={endPt.y}
      stroke="rgba(255, 180, 50, 0.9)"
      strokeWidth="2"
      strokeDasharray="4 3"
    />
  );
}

/**
 * Renders a single divider band on the material.
 */
function renderDividerItem(
  d: DividerItem,
  inner: QuadCorners,
  item: WindowItem,
  scale: number,
): React.ReactNode {
  const halfW = (d.width / 2) * scale;

  if (d.orientation === 'horizontal') {
    const tY = item.heightLeft > 0 ? d.position / item.heightLeft : 0;
    const leftPt = getEdgePoint(inner.tl, inner.bl, tY);
    const rightPt = getEdgePoint(inner.tr, inner.br, tY);
    const lineLen = vecLen(leftPt, rightPt);

    const tStart = lineLen > 0 ? Math.min((d.offsetStart * scale) / lineLen, 1) : 0;
    const tEnd = lineLen > 0 ? Math.max(1 - (d.offsetEnd * scale) / lineLen, 0) : 1;
    const startPt = getEdgePoint(leftPt, rightPt, tStart);
    const endPt = getEdgePoint(leftPt, rightPt, tEnd);

    // Perpendicular direction for band width (approximate: straight up/down)
    const bandPath = [
      `M ${startPt.x} ${startPt.y - halfW}`,
      `L ${endPt.x} ${endPt.y - halfW}`,
      `L ${endPt.x} ${endPt.y + halfW}`,
      `L ${startPt.x} ${startPt.y + halfW}`,
      'Z',
    ].join(' ');
    return (
      <g key={`divider-${d.id}`}>
        <path d={bandPath} fill="rgba(60,220,120,0.18)" stroke="rgba(60,180,80,0.8)" strokeWidth="1.5" />
        <line x1={startPt.x} y1={startPt.y} x2={endPt.x} y2={endPt.y} stroke="rgba(40,160,70,0.9)" strokeWidth="2" />
      </g>
    );
  } else {
    const tX = item.widthTop > 0 ? d.position / item.widthTop : 0;
    const topPt = getEdgePoint(inner.tl, inner.tr, tX);
    const bottomPt = getEdgePoint(inner.bl, inner.br, tX);
    const lineLen = vecLen(topPt, bottomPt);

    const tStart = lineLen > 0 ? Math.min((d.offsetStart * scale) / lineLen, 1) : 0;
    const tEnd = lineLen > 0 ? Math.max(1 - (d.offsetEnd * scale) / lineLen, 0) : 1;
    const startPt = getEdgePoint(topPt, bottomPt, tStart);
    const endPt = getEdgePoint(topPt, bottomPt, tEnd);

    const bandPath = [
      `M ${startPt.x - halfW} ${startPt.y}`,
      `L ${startPt.x + halfW} ${startPt.y}`,
      `L ${endPt.x + halfW} ${endPt.y}`,
      `L ${endPt.x - halfW} ${endPt.y}`,
      'Z',
    ].join(' ');
    return (
      <g key={`divider-${d.id}`}>
        <path d={bandPath} fill="rgba(60,220,120,0.18)" stroke="rgba(60,180,80,0.8)" strokeWidth="1.5" />
        <line x1={startPt.x} y1={startPt.y} x2={endPt.x} y2={endPt.y} stroke="rgba(40,160,70,0.9)" strokeWidth="2" />
      </g>
    );
  }
}

/**
 * Renders a single zipper band on the material.
 * bandLeft / bandRight are the tape widths on each side of the seam.
 */
function renderZipperItem(
  z: ZipperItem,
  inner: QuadCorners,
  item: WindowItem,
  scale: number,
): React.ReactNode {
  const bL = z.bandLeft * scale;
  const bR = z.bandRight * scale;

  if (z.orientation === 'horizontal') {
    const tY = item.heightLeft > 0 ? z.positionFromStart / item.heightLeft : 0;
    const leftPt = getEdgePoint(inner.tl, inner.bl, tY);
    const rightPt = getEdgePoint(inner.tr, inner.br, tY);
    const lineLen = vecLen(leftPt, rightPt);

    const tStart = lineLen > 0 ? Math.min((z.offsetStart * scale) / lineLen, 1) : 0;
    const tEnd = lineLen > 0 ? Math.max(1 - (z.offsetEnd * scale) / lineLen, 0) : 1;
    const seamStart = getEdgePoint(leftPt, rightPt, tStart);
    const seamEnd = getEdgePoint(leftPt, rightPt, tEnd);

    const topPath = [
      `M ${seamStart.x} ${seamStart.y - bL}`,
      `L ${seamEnd.x} ${seamEnd.y - bL}`,
      `L ${seamEnd.x} ${seamEnd.y}`,
      `L ${seamStart.x} ${seamStart.y}`,
      'Z',
    ].join(' ');
    const bottomPath = [
      `M ${seamStart.x} ${seamStart.y}`,
      `L ${seamEnd.x} ${seamEnd.y}`,
      `L ${seamEnd.x} ${seamEnd.y + bR}`,
      `L ${seamStart.x} ${seamStart.y + bR}`,
      'Z',
    ].join(' ');

    return (
      <g key={`zipper-${z.id}`}>
        <path d={topPath} fill="rgba(255,200,50,0.22)" stroke="rgba(220,160,30,0.7)" strokeWidth="1" />
        <path d={bottomPath} fill="rgba(255,200,50,0.22)" stroke="rgba(220,160,30,0.7)" strokeWidth="1" />
        <line x1={seamStart.x} y1={seamStart.y} x2={seamEnd.x} y2={seamEnd.y} stroke="rgba(200,130,20,0.9)" strokeWidth="2.5" />
      </g>
    );
  } else {
    const tX = item.widthTop > 0 ? z.positionFromStart / item.widthTop : 0;
    const topPt = getEdgePoint(inner.tl, inner.tr, tX);
    const bottomPt = getEdgePoint(inner.bl, inner.br, tX);
    const lineLen = vecLen(topPt, bottomPt);

    const tStart = lineLen > 0 ? Math.min((z.offsetStart * scale) / lineLen, 1) : 0;
    const tEnd = lineLen > 0 ? Math.max(1 - (z.offsetEnd * scale) / lineLen, 0) : 1;
    const seamStart = getEdgePoint(topPt, bottomPt, tStart);
    const seamEnd = getEdgePoint(topPt, bottomPt, tEnd);

    const leftPath = [
      `M ${seamStart.x - bL} ${seamStart.y}`,
      `L ${seamStart.x} ${seamStart.y}`,
      `L ${seamEnd.x} ${seamEnd.y}`,
      `L ${seamEnd.x - bL} ${seamEnd.y}`,
      'Z',
    ].join(' ');
    const rightPath = [
      `M ${seamStart.x} ${seamStart.y}`,
      `L ${seamStart.x + bR} ${seamStart.y}`,
      `L ${seamEnd.x + bR} ${seamEnd.y}`,
      `L ${seamEnd.x} ${seamEnd.y}`,
      'Z',
    ].join(' ');

    return (
      <g key={`zipper-${z.id}`}>
        <path d={leftPath} fill="rgba(255,200,50,0.22)" stroke="rgba(220,160,30,0.7)" strokeWidth="1" />
        <path d={rightPath} fill="rgba(255,200,50,0.22)" stroke="rgba(220,160,30,0.7)" strokeWidth="1" />
        <line x1={seamStart.x} y1={seamStart.y} x2={seamEnd.x} y2={seamEnd.y} stroke="rgba(200,130,20,0.9)" strokeWidth="2.5" />
      </g>
    );
  }
}

/**
 * Renders a single cutout or patch rectangle on the material.
 * Uses bilinear windowToSvg for all 4 corners (trapezoid-safe).
 */
function renderCutoutItem(
  c: CutoutItem,
  inner: QuadCorners,
  item: WindowItem,
): React.ReactNode {
  const ptTL = windowToSvg(c.x, c.y, inner, item);
  const ptTR = windowToSvg(c.x + c.width, c.y, inner, item);
  const ptBR = windowToSvg(c.x + c.width, c.y + c.height, inner, item);
  const ptBL = windowToSvg(c.x, c.y + c.height, inner, item);

  const d = [
    `M ${ptTL.x} ${ptTL.y}`,
    `L ${ptTR.x} ${ptTR.y}`,
    `L ${ptBR.x} ${ptBR.y}`,
    `L ${ptBL.x} ${ptBL.y}`,
    'Z',
  ].join(' ');

  const isCut = c.type === 'cut';
  return (
    <g key={`cutout-${c.id}`}>
      <path
        d={d}
        fill={isCut ? 'rgba(255,80,80,0.15)' : 'rgba(80,200,80,0.15)'}
        stroke={isCut ? 'rgba(220,50,50,0.9)' : 'rgba(50,180,50,0.9)'}
        strokeWidth="1.5"
        strokeDasharray={isCut ? undefined : '5 3'}
      />
      {/* Crosshatch for cuts */}
      {isCut && (
        <>
          <line x1={ptTL.x} y1={ptTL.y} x2={ptBR.x} y2={ptBR.y} stroke="rgba(220,50,50,0.4)" strokeWidth="1" />
          <line x1={ptTR.x} y1={ptTR.y} x2={ptBL.x} y2={ptBL.y} stroke="rgba(220,50,50,0.4)" strokeWidth="1" />
        </>
      )}
    </g>
  );
}

/**
 * Renders strap markers along the outer top edge.
 * grommet = circle with hole; fastex = filled rectangle tab.
 */
function renderStraps(
  outer: QuadCorners,
  extras: AdditionalElements,
  circleR: number,
): React.ReactNode {
  const count = extras.straps.isManual
    ? extras.straps.count
    : extras.straps.count; // already resolved in hook; just use it

  if (count <= 0) return null;

  const markers: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const pt = getEdgePoint(outer.tl, outer.tr, t);
    const isGrommet = extras.straps.type === 'grommet';

    if (isGrommet) {
      markers.push(
        <g key={`strap-${i}`}>
          <circle cx={pt.x} cy={pt.y} r={circleR * 1.1} fill="rgba(230,230,230,0.95)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          <circle cx={pt.x} cy={pt.y} r={circleR * 0.44} fill="rgba(30,40,60,0.85)" stroke="rgba(150,150,150,0.7)" strokeWidth="0.8" />
        </g>,
      );
    } else {
      // fastex — small rounded rectangle tab
      const w = circleR * 1.8;
      const h = circleR * 1.1;
      markers.push(
        <rect
          key={`strap-${i}`}
          x={pt.x - w / 2} y={pt.y - h / 2}
          width={w} height={h}
          rx={2}
          fill="rgba(80,130,220,0.9)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.8"
        />,
      );
    }
  }

  return <g key="straps">{markers}</g>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  item: WindowItem;
  showFasteners?: boolean;
  showExtras?: boolean;
}

export default function DrawingCanvas({
  item,
  showFasteners = false,
  showExtras = false,
}: DrawingCanvasProps) {
  const vbW = 600;
  const vbH = 500;
  
  // Если показываем Допы, уменьшаем отступ до 10, чтобы окно раздулось на весь экран.
  // Если только Крепеж, оставляем 40 (или 30), чтобы подписи не вылезали за края.
  const padding = showExtras ? 10 : 35; 

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

  // ── Inner corners (light opening) ─────────────────────────────────────────
  const x1 = startX;
  const y1 = startY;
  const x2 = x1 + widthTop * scale;
  const y2 = y1 + (heightLeft - heightRight) * scale;
  const x4 = startX;
  const y4 = startY + heightLeft * scale;
  const x3 = x4 + widthBottom * scale;
  const y3 = y4;

  // ── Outer corners (kant) ──────────────────────────────────────────────────
  const outX1 = x1 - kantLeft * scale;
  const outY1 = y1 - kantTop * scale;
  const outX2 = x2 + kantRight * scale;
  const outY2 = y2 - kantTop * scale;
  const outX3 = x3 + kantRight * scale;
  const outY3 = y3 + kantBottom * scale;
  const outX4 = x4 - kantLeft * scale;
  const outY4 = y4 + kantBottom * scale;

  const innerCorners: QuadCorners = {
    tl: { x: x1, y: y1 },
    tr: { x: x2, y: y2 },
    br: { x: x3, y: y3 },
    bl: { x: x4, y: y4 },
  };

  const outerCorners: QuadCorners = {
    tl: { x: outX1, y: outY1 },
    tr: { x: outX2, y: outY2 },
    br: { x: outX3, y: outY3 },
    bl: { x: outX4, y: outY4 },
  };

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

  // ── Fastener setup ─────────────────────────────────────────────────────────
  const targetStepSvg = 35 * scale;
  const circleR = Math.max(4, Math.min(9, Math.max(kantTop, kantRight, kantBottom, kantLeft) * scale * 0.4));
  const fasteners = item.fasteners || getInitialFastener();

  const midTop1: Point    = { x: (x1 + outX1) / 2, y: (y1 + outY1) / 2 };
  const midTop2: Point    = { x: (x2 + outX2) / 2, y: (y2 + outY2) / 2 };
  const midRight2: Point  = { x: (x2 + outX2) / 2, y: (y2 + outY2) / 2 };
  const midRight3: Point  = { x: (x3 + outX3) / 2, y: (y3 + outY3) / 2 };
  const midBottom3: Point = { x: (x3 + outX3) / 2, y: (y3 + outY3) / 2 };
  const midBottom4: Point = { x: (x4 + outX4) / 2, y: (y4 + outY4) / 2 };
  const midLeft4: Point   = { x: (x4 + outX4) / 2, y: (y4 + outY4) / 2 };
  const midLeft1: Point   = { x: (x1 + outX1) / 2, y: (y1 + outY1) / 2 };

  // ── Extras setup ─────────────────────────────────────────────────────────
  const extras = item.additionalElements;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', maxHeight: '100%' }}
      >
        {/* ── Layer 1: Outer kant ─────────────────────────────────────────── */}
        <path d={outerPath} fill={strokeColor} style={{ transition: 'fill 0.4s ease' }} />

        {/* ── Layer 2: Inner material ─────────────────────────────────────── */}
        <path
          d={innerPath}
          fill="#aac7ee"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
          style={{ transition: 'all 0.3s ease' }}
        />

        {/* ── Layer 3: Trapezoid crossbar ─────────────────────────────────── */}
        {item.isTrapezoid && crossbar > 0 && (
          <g>
            <line x1={x1} y1={parallelY} x2={x3} y2={parallelY} stroke="#7BFF00" strokeWidth="2" strokeDasharray="6,4" />
            <rect x={(x1 + x3) / 2 - 25} y={parallelY + 6} width="50" height="24" rx="4" fill="#a1a1a1" stroke="rgba(123,255,0,0.4)" strokeWidth="1" />
            <text x={(x1 + x3) / 2} y={parallelY + 23} fill="#7BFF00" fontSize="14" fontWeight="900" textAnchor="middle">{crossbar}</text>
          </g>
        )}

        {/* ── Layer 4: Labels ─────────────────────────────────────────────── */}
        <g fontSize="24" fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none' }}>
          <text x={x1 - 30} y={y1 - 10}>a</text>
          <text x={x2 + 10} y={y2 - 10}>b</text>
          <text x={x3 + 10} y={y3 + 30}>c</text>
          <text x={x4 - 30} y={y4 + 30}>d</text>
        </g>
        <g fontSize="16" fontWeight="600" fill="rgba(255,255,255,0.8)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
          <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 20}>{widthTop}</text>
          <text x={(x3 + x4) / 2} y={y4 + 30}>{widthBottom}</text>
          <text x={x1 - 45} y={(y1 + y4) / 2} transform={`rotate(-90, ${x1 - 45}, ${(y1 + y4) / 2})`}>{heightLeft}</text>
          <text x={x3 + 45} y={(y2 + y3) / 2} transform={`rotate(90, ${x3 + 45}, ${(y2 + y3) / 2})`}>{heightRight}</text>
        </g>

        {/* ── Layer 5: Fasteners ──────────────────────────────────────────── */}
        {showFasteners && fasteners.type !== 'none' && (
          <g>
            {renderSideDots(midTop1, midTop2, fasteners.sides.top, targetStepSvg, circleR, 'top')}
            {renderSideDots(midRight2, midRight3, fasteners.sides.right, targetStepSvg, circleR, 'right')}
            {renderSideDots(midBottom3, midBottom4, fasteners.sides.bottom, targetStepSvg, circleR, 'bottom')}
            {renderSideDots(midLeft4, midLeft1, fasteners.sides.left, targetStepSvg, circleR, 'left')}
          </g>
        )}

        {/* ── Layer 6: Extras ─────────────────────────────────────────────── */}
        {showExtras && extras && (
          <g>
            {/* 6a. Skirt */}
            {extras.hasSkirt && renderSkirt(outerCorners, extras.skirtWidth, scale)}

            {/* 6b. Weight */}
            {extras.hasWeight && renderWeight(outerCorners)}

            {/* 6c. Welding */}
            {extras.welding.map((w) => renderWeldingItem(w, innerCorners, item, scale))}

            {/* 6d. Dividers */}
            {extras.dividers.map((d) => renderDividerItem(d, innerCorners, item, scale))}

            {/* 6e. Zippers */}
            {extras.zippers.map((z) => renderZipperItem(z, innerCorners, item, scale))}

            {/* 6f. Cutouts & Patches */}
            {extras.cutouts.map((c) => renderCutoutItem(c, innerCorners, item))}

            {/* 6g. Straps */}
            {renderStraps(outerCorners, extras, circleR)}
          </g>
        )}
      </svg>
    </div>
  );
}