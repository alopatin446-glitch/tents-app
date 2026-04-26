'use client';

/**
 * Calculation orchestrator (Client Component).
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
import type { MountingConfig } from '@/types/mounting';
import type { TeamMemberConfig } from '@/constants/pricing';

import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';
import ExtrasStep from '@/components/calculation/ExtrasStep';
import MountingStep from '@/components/mounting/MountingStep';
import styles from './CalculationClient.module.css';

type Step =
  | 'client'
  | 'items'
  | 'fasteners'
  | 'extras'
  | 'mounting'
  | 'specification'
  | 'production';

interface CalculationClientProps {
  clientId: string;
  initialClientData: ClientFormData;
  initialWindows: WindowItem[];
  isReadOnly?: boolean;
  /**
   * Список активных монтажников, предзагруженный на сервере.
   * Если не передан — MountingStep самостоятельно запросит /api/team-members.
   * Backward compatible: передача не обязательна.
   */
  teamMembers?: TeamMemberConfig[];
}

function DevelopmentPlaceholder({ title }: { title: string }) {
  return (
    <section
      style={{
        minHeight: 'calc(100vh - 150px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-white)',
      }}
    >
      <div
        style={{
          width: 'min(720px, 92vw)',
          minHeight: '260px',
          border: '1px solid var(--neon-green)',
          borderRadius: '32px',
          background: 'rgba(123, 255, 0, 0.04)',
          boxShadow: '0 0 24px rgba(123, 255, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '18px',
          textAlign: 'center',
          padding: '32px',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: 'var(--neon-green)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          На стадии разработки
        </p>
      </div>
    </section>
  );
}

export default function CalculationClient({
  clientId,
  initialClientData,
  initialWindows,
  isReadOnly = false,
  teamMembers,
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
          mountingConfig: formData.mountingConfig,
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
          return;
        }

        const errorMsg = 'error' in result ? result.error : 'Неизвестная ошибка';
        logger.error('[CalculationClient] Save error', { clientId, error: errorMsg });
        alert('Ошибка сохранения: ' + errorMsg);
      } catch (err) {
        logger.error('[CalculationClient] Save exception', err);
        alert('Критическая ошибка при сохранении');
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, windows, totalAreaMaterial],
  );

  const handleMountingChange = useCallback(
    (newConfig: MountingConfig): void => {
      handleClientDataChange({
        ...clientDataWithArea,
        mountingConfig: newConfig,
      });
    },
    [clientDataWithArea, handleClientDataChange],
  );

  const handleMountingSave = useCallback(
    async (mountingData: MountingConfig): Promise<void> => {
      if (isReadOnly) return;

      setIsSaving(true);

      try {
        const result = await updateClientAction(clientId, { mountingConfig: mountingData });

        if (result.success) {
          logger.info('[CalculationClient] Mounting saved', { clientId });
          router.refresh();
          return;
        }

        alert('Ошибка сохранения монтажа: ' + result.error);
      } catch (err) {
        logger.error('[CalculationClient] Mounting save exception', err);
        alert('Критическая ошибка при сохранении монтажа');
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router],
  );

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
          return;
        }

        logger.error('[CalculationClient] Windows save error', { error: result.error });
        alert('Ошибка сохранения: ' + result.error);
      } catch (err) {
        logger.error('[CalculationClient] Windows save exception', err);
        alert('Критическая ошибка при сохранении изделий');
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, handleWindowsChange],
  );

  const steps: Array<{ id: Step; label: string }> = [
    { id: 'client', label: 'Клиент' },
    { id: 'items', label: 'Изделия' },
    { id: 'fasteners', label: 'Крепёж' },
    { id: 'extras', label: 'Допы' },
    { id: 'mounting', label: 'Монтаж' },
    { id: 'specification', label: 'Спецификация' },
    { id: 'production', label: 'Для производства' },
  ];

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

        {activeStep === 'mounting' && (
          <MountingStep
            clientId={clientId}
            value={clientDataWithArea.mountingConfig ?? initialClientData.mountingConfig ?? {}}
            totalAreaM2={totalAreaMaterial}
            currentUserId="system"
            onChange={handleMountingChange}
            onSave={handleMountingSave}
            isReadOnly={isReadOnly}
            teamMembers={teamMembers}
          />
        )}

        {activeStep === 'specification' && (
          <DevelopmentPlaceholder title="Спецификация" />
        )}

        {activeStep === 'production' && (
          <DevelopmentPlaceholder title="Для производства" />
        )}
      </main>
    </div>
  );
}