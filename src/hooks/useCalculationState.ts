/**
 * Calculation state hook.
 *
 * Changes vs. previous version:
 *   - All incoming windows are normalized through `normalizeAllWindowExtras`
 *     on initialization so `additionalElements` is always present.
 *   - Exposes `handleWindowsChange` and `handleExtrasChange` separately
 *     so ExtrasStep can update additionalElements without touching geometry.
 *
 * @module src/hooks/useCalculationState.ts
 */

import { useCallback, useMemo, useState } from 'react';

import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import {
  calculateTotalArea,
  calculateTotalAreaWithKant,
} from '@/lib/logic/windowCalculations';
import {
  normalizeAllWindowExtras,
  normalizeExtrasOnResize,
} from '@/lib/logic/extrasCalculations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalculationState {
  /** Normalized window list — additionalElements always present. */
  windows: WindowItem[];
  clientDataWithArea: ClientFormData;
  totalAreaMaterial: number;
  totalAreaWithKant: number;
  handleWindowsChange: (updated: WindowItem[]) => void;
  handleClientDataChange: (updated: ClientFormData) => void;
  /**
   * Updates additionalElements for a single window.
   * ADDITIVE ONLY — does not touch geometry, borders, or fasteners.
   */
  handleExtrasChange: (windowId: number, extras: WindowItem['additionalElements']) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCalculationState(
  initialClientData: ClientFormData,
  initialWindows: WindowItem[],
): CalculationState {
  const [windows, setWindows] = useState<WindowItem[]>(
    () => normalizeAllWindowExtras(initialWindows),
  );
  const [clientData, setClientData] = useState<ClientFormData>(initialClientData);

  // ── Reactive area calculation ─────────────────────────────────────────────

  const totalAreaMaterial = useMemo(
    () => calculateTotalArea(windows),
    [windows],
  );

  const totalAreaWithKant = useMemo(
    () => calculateTotalAreaWithKant(windows),
    [windows],
  );

  const clientDataWithArea = useMemo<ClientFormData>(
    () => ({ ...clientData, area: totalAreaMaterial }),
    [clientData, totalAreaMaterial],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Replaces the full window list.
   * When dimensions change, re-derives extras proportionally per window.
   */
  const handleWindowsChange = useCallback((updated: WindowItem[]): void => {
    setWindows((prev) => {
      const prevById = new Map(prev.map((w) => [w.id, w]));
      const normalized = normalizeAllWindowExtras(updated);
      // For each window whose dimensions changed, scale extras proportionally
      return normalized.map((curr) => {
        const prevWindow = prevById.get(curr.id);
        if (!prevWindow) return curr;
        const dimsChanged =
          curr.widthTop !== prevWindow.widthTop ||
          curr.widthBottom !== prevWindow.widthBottom ||
          curr.heightLeft !== prevWindow.heightLeft ||
          curr.heightRight !== prevWindow.heightRight;
        if (!dimsChanged) return curr;
        return { ...curr, additionalElements: normalizeExtrasOnResize(curr, prevWindow) };
      });
    });
  }, []);

  /**
   * Updates only additionalElements for one window.
   * Does NOT touch geometry, borders, or fasteners.
   */
  const handleExtrasChange = useCallback(
    (windowId: number, extras: WindowItem['additionalElements']): void => {
      setWindows((prev) =>
        prev.map((w) => (w.id === windowId ? { ...w, additionalElements: extras } : w)),
      );
    },
    [],
  );

  /**
   * Updates client form data (never overwrites `area`).
   */
  const handleClientDataChange = useCallback(
    (updated: ClientFormData): void => {
      setClientData((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { area: _ignored, ...rest } = updated;
        const hasChanges = Object.keys(rest).some(
          (k) => prev[k as keyof ClientFormData] !== (rest as Record<string, unknown>)[k],
        );
        if (!hasChanges) return prev;
        return { ...prev, ...rest };
      });
    },
    [],
  );

  return {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalAreaWithKant,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
  };
}