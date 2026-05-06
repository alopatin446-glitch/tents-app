'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { notifyError, notifySuccess } from '@/lib/notify';
import { calculateMounting } from '@/lib/logic/mountingCalculations';
import { getPrices } from '@/app/actions/prices';
import { buildMaterialDiagnostics } from '@/lib/logic/materialDiagnostics';

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
  currentUserId: string;
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
  clientId: initialClientId,
  initialClientData,
  initialWindows,
  currentUserId,
  isReadOnly = false,
  teamMembers,
}: CalculationClientProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>(initialClientId);
  const [activeStep, setActiveStep] = useState<Step>('client');
  const [isSaving, setIsSaving] = useState(false);

  // ЦЕНОВОЙ СУВЕРЕНИТЕТ: Универсальный стейт для всех цен из БД
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});

  const [activeWindowId, setActiveWindowId] = useState<number>(
    () => initialWindows[0]?.id ?? Date.now(),
  );

  // ── ЗАГРУЗКА ПРАЙСОВ ИЗ БД ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    getPrices()
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !Array.isArray(result.data)) return;

        const nextMap: Record<string, number> = {};
        for (const price of result.data) {
          nextMap[price.slug] = Number(price.value);
        }

        setCurrentPrices(nextMap);
      })
      .catch((error) => {
        logger.warn('[CalculationClient] Ошибка загрузки мастер-прайса', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── МОЗГОВОЙ ЦЕНТР (Прайсы поданы!) ─────────────────────────────────────
  const {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalAreaWithKant,
    totalPrice,
    costPrice,
    totalExpenses,
    totalMaterialInProduct,
    totalMaterialCut,
    totalOverspending,
    totalProductionCost,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
  } = useCalculationState(initialClientData, initialWindows, currentPrices);

  // ── ДИАГНОСТИКА МАТЕРИАЛОВ (временная, только чтение) ───────────────────
  // Вычисляет расхождение между текущим и ожидаемым расчётом после
  // исправления материальных slug в pricingLogic. Не влияет на totalPrice,
  // costPrice, balance, savedPrices, items или сохранение.
  const materialDiagnostics = useMemo(
    () => buildMaterialDiagnostics(windows, currentPrices),
    [windows, currentPrices],
  );

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
        // Сохраняем слепок цен, по которым считали (для истории)
        savedPrices: currentPrices,
      };

      const result = await updateClientAction(clientId, payload);

      if (result.success) {
        const savedClientId = result.clientId ?? clientId;

        if (savedClientId && savedClientId !== clientId) {
          setClientId(savedClientId);
          handleClientDataChange({
            ...clientDataWithArea,
            id: savedClientId,
          });
        }

        logger.info('[CalculationClient] FULL SAVE', {
          clientId: savedClientId,
          windowsCount: windows.length,
        });

        router.refresh();
        notifySuccess('Сохранено');
        return;
      }

      notifyError('Ошибка: ' + result.error);
    } catch (e) {
      console.error(e);
      notifyError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  }, [clientId, clientDataWithArea, windows, router, isReadOnly, currentPrices, handleClientDataChange]);

  const handleMountingChange = useCallback(
    (newConfig: MountingConfig): void => {
      // Используем актуальные цены для монтажа
      const mountingCalc = calculateMounting(newConfig, totalAreaMaterial, currentPrices);

      const mountingCostValue =
        newConfig.manualPrice ?? mountingCalc.retailFinal ?? 0;

      handleClientDataChange({
        ...clientDataWithArea,
        mountingConfig: newConfig,
        mountingCost: mountingCostValue,
      });
    },
    [clientDataWithArea, handleClientDataChange, totalAreaMaterial, currentPrices],
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
            priceMap={currentPrices}
            calculatedTotal={totalPrice}
            calculatedCost={costPrice}
            calculatedTotalExpenses={totalExpenses}
            materialInProductCost={totalMaterialInProduct}
            materialCutCost={totalMaterialCut}
            overspendingCost={totalOverspending}
            productionCost={totalProductionCost}
            calculatedArea={totalAreaMaterial}
            onSave={handleSaveAll}
            onDraftChange={handleClientDataChange}
            onClose={() => router.back()}
            isReadOnly={isReadOnly}
            materialDiagnostics={materialDiagnostics}
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
            priceMap={currentPrices}
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
            currentUserId={currentUserId}
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