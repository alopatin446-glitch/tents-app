'use client';

/**
 * Calculation orchestrator (Client Component).
 *
 * Changes vs. previous version:
 *   - Added 'extras' step backed by ExtrasStep.
 *   - Step type extended to include 'extras'.
 *   - handleExtrasChange from useCalculationState wired to ExtrasStep.
 *   - handleWindowsSave reused for ExtrasStep.onSave.
 *
 * @module src/components/calculation/CalculationClient.tsx
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import { useCalculationState } from '@/hooks/useCalculationState';
import { updateClientAction } from '@/app/actions';
import { logger } from '@/lib/logger';

import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';
import ExtrasStep from '@/components/calculation/ExtrasStep';

import styles from './CalculationClient.module.css';

type Step = 'client' | 'items' | 'fasteners' | 'extras';

interface CalculationClientProps {
  clientId: string;
  initialClientData: ClientFormData;
  initialWindows: WindowItem[];
  isReadOnly?: boolean;
}

export default function CalculationClient({
  clientId,
  initialClientData,
  initialWindows,
  isReadOnly = false,
}: CalculationClientProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<Step>('client');
  const [isSaving, setIsSaving] = useState(false);

  const [activeWindowId, setActiveWindowId] = useState<number>(
    () => initialWindows[0]?.id ?? Date.now(),
  );

  const {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalAreaWithKant,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
  } = useCalculationState(initialClientData, initialWindows);

  // ── Save client data ──────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (formData: ClientFormData): Promise<void> => {
      if (isReadOnly) return;
      setIsSaving(true);
      try {
        const payload = {
          fio: formData.fio ?? '',
          phone: formData.phone ?? '',
          address: formData.address ?? '',
          source: formData.source ?? '',
          status: formData.status ?? '',
          totalPrice: formData.totalPrice,
          advance: formData.advance,
          balance: formData.balance,
          paymentType: formData.paymentType ?? '',
          measurementDate: formData.measurementDate,
          installDate: formData.installDate,
          managerComment: formData.managerComment ?? '',
          engineerComment: formData.engineerComment ?? '',
          items: windows,
        };

        const result = await updateClientAction(clientId, payload);

        if (result.success) {
          const returnedId = 'clientId' in result ? result.clientId : null;
          logger.info('[CalculationClient] Saved', {
            clientId: returnedId || clientId,
            windowsCount: windows.length,
            totalAreaMaterial,
          });
          if (!clientId && returnedId) {
            router.replace(`/dashboard/new-calculation?id=${returnedId}`);
          } else {
            router.refresh();
          }
          alert('Данные успешно сохранены');
        } else {
          const errorMsg = 'error' in result ? result.error : 'Неизвестная ошибка';
          logger.error('[CalculationClient] Save error', { clientId, error: errorMsg });
          alert('Ошибка сохранения: ' + errorMsg);
        }
      } catch (err) {
        logger.error('[CalculationClient] Save exception', err);
        alert('Критическая ошибка при сохранении');
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, windows, totalAreaMaterial],
  );

  // ── Save windows (shared by Items / Fasteners / Extras) ──────────────────

  const handleWindowsSave = useCallback(
    async (updatedWindows: WindowItem[]): Promise<void> => {
      if (isReadOnly) return;
      handleWindowsChange(updatedWindows);
      setIsSaving(true);
      try {
        const result = await updateClientAction(clientId, { items: updatedWindows });
        if (result.success) {
          logger.info('[CalculationClient] Windows/extras saved', {
            clientId,
            count: updatedWindows.length,
          });
          router.refresh();
        } else {
          logger.error('[CalculationClient] Windows save error', { error: result.error });
          alert('Ошибка сохранения: ' + result.error);
        }
      } catch (err) {
        logger.error('[CalculationClient] Windows save exception', err);
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, handleWindowsChange],
  );

  // ── Step navigation ───────────────────────────────────────────────────────

  const steps: Array<{ id: Step; label: string }> = [
    { id: 'client',    label: 'Клиент' },
    { id: 'items',     label: 'Изделия' },
    { id: 'fasteners', label: 'Крепёж' },
    { id: 'extras',    label: 'Допы' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <nav className={styles.stepNav}>
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`${styles.stepBtn} ${activeStep === step.id ? styles.stepBtnActive : ''}`}
              onClick={() => setActiveStep(step.id)}
            >
              {step.label}
            </button>
          ))}
        </nav>

        <div className={styles.areaIndicator}>
          <span className={styles.areaLabel}>Площадь полотна:</span>
          <strong className={styles.areaValue}>{totalAreaMaterial.toFixed(2)} м²</strong>
          <span className={styles.areaLabel}>С кантом:</span>
          <strong className={styles.areaValue}>{totalAreaWithKant.toFixed(2)} м²</strong>
          {isSaving && <span className={styles.savingIndicator}>Сохранение…</span>}
        </div>
      </div>

      <main className={styles.mainContent}>

        {activeStep === 'client' && (
          <ClientStep
            initialData={clientDataWithArea}
            onSave={handleSave}
            onDraftChange={handleClientDataChange}
            onClose={() => router.back()}
            isReadOnly={isReadOnly}
          />
        )}

        {activeStep === 'items' && (
          <ItemsStep
            windows={windows}
            onDraftChange={handleWindowsChange}
            onSave={handleWindowsSave}
            clientId={clientId}
            isReadOnly={isReadOnly}
            activeWindowId={activeWindowId}
            onActiveWindowChange={setActiveWindowId}
          />
        )}

        {activeStep === 'fasteners' && (
          <FastenersStep
            windows={windows}
            activeWindowId={activeWindowId}
            onActiveWindowChange={setActiveWindowId}
            onWindowsChange={handleWindowsChange}
            onSave={handleWindowsSave}
            isReadOnly={isReadOnly}
          />
        )}

        {activeStep === 'extras' && (
          <ExtrasStep
            windows={windows}
            activeWindowId={activeWindowId}
            onActiveWindowChange={setActiveWindowId}
            onExtrasChange={handleExtrasChange}
            onSave={handleWindowsSave}
            isReadOnly={isReadOnly}
          />
        )}

      </main>
    </div>
  );
}