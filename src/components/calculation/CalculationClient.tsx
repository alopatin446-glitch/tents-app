'use client';

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
import ProductionStep from '@/components/calculation/ProductionStep';

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
  teamMembers?: TeamMemberConfig[];
}

function DevelopmentPlaceholder({ title }: { title: string }) {
  return (
    <section style={{ minHeight: 'calc(100vh - 150px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h2>{title} — В разработке</h2>
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

  /**
   * 🔥 ЕДИНОЕ СОХРАНЕНИЕ ВСЕГО ЗАКАЗА
   */
  const handleSaveAll = useCallback(async () => {
    if (isReadOnly) return;

    setIsSaving(true);

    try {
      const payload = {
        ...clientDataWithArea,
        items: windows,
        mountingConfig: clientDataWithArea.mountingConfig,
      };

      const result = await updateClientAction(clientId, payload);

      if (result.success) {
        logger.info('[CalculationClient] FULL SAVE', {
          clientId,
          windowsCount: windows.length,
        });

        router.refresh();
        alert('Сохранено');
        return;
      }

      alert('Ошибка: ' + result.error);
    } catch (e) {
      console.error(e);
      alert('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  }, [clientId, clientDataWithArea, windows, router, isReadOnly]);

  const handleMountingChange = useCallback(
    (newConfig: MountingConfig): void => {
      handleClientDataChange({
        ...clientDataWithArea,
        mountingConfig: newConfig,
      });
    },
    [clientDataWithArea, handleClientDataChange],
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

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className={styles.exitBtn}
        >
          Выйти
        </button>

        <div className={styles.areaIndicator}>
          <strong>{totalAreaMaterial.toFixed(2)} м²</strong>
          <strong>{totalAreaWithKant.toFixed(2)} м²</strong>
          {isSaving && <span>Сохранение…</span>}
        </div>

      </div>

      <main className={styles.mainContent}>
        {activeStep === 'client' && (
          <ClientStep
            initialData={clientDataWithArea}
            onSave={handleSaveAll}
            onDraftChange={handleClientDataChange}
            onClose={() => router.back()}
            isReadOnly={isReadOnly}
          />
        )}

        {activeStep === 'items' && (
          <ItemsStep
            windows={windows}
            onDraftChange={handleWindowsChange}
            onSave={handleSaveAll}
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
            onSave={handleSaveAll}
            isReadOnly={isReadOnly}
          />
        )}

        {activeStep === 'extras' && (
          <ExtrasStep
            windows={windows}
            activeWindowId={activeWindowId}
            onActiveWindowChange={setActiveWindowId}
            onExtrasChange={handleExtrasChange}
            onSave={handleSaveAll}
            isReadOnly={isReadOnly}
          />
        )}

        {activeStep === 'mounting' && (
          <MountingStep
            clientId={clientId}
            value={clientDataWithArea.mountingConfig ?? {}}
            totalAreaM2={totalAreaMaterial}
            currentUserId="system"
            onChange={handleMountingChange}
            onSave={handleSaveAll}
            isReadOnly={isReadOnly}
            teamMembers={teamMembers}
          />
        )}

        {activeStep === 'specification' && (
          <DevelopmentPlaceholder title="Спецификация" />
        )}

        {activeStep === 'production' && (
          <ProductionStep
            windows={windows}
            activeWindowId={activeWindowId}
            onActiveWindowChange={setActiveWindowId}
          />
        )}
      </main>
    </div>
  );
}