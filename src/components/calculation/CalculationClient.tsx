'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import { useCalculationState } from '@/hooks/useCalculationState';
import { updateClientAction } from '@/app/actions';
import { logger } from '@/lib/logger';

// Правильные пути — все три компонента живут в @/components/calculation/
import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

import styles from './CalculationClient.module.css';

type Step = 'client' | 'items' | 'fasteners';

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

  const {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalAreaWithKant,
    handleWindowsChange,
    handleClientDataChange,
  } = useCalculationState(initialClientData, initialWindows);

  const handleSave = useCallback(
    async (formData: ClientFormData): Promise<void> => {
      if (isReadOnly) return;
      setIsSaving(true);

      try {
        // Собираем данные, принудительно приводя к нужным типам, чтобы TS не ворчал
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
          // Используем Type Narrowing: проверяем существование clientId
          const returnedId = 'clientId' in result ? result.clientId : null;

          logger.info('[CalculationClient] Сохранено', { 
            clientId: returnedId || clientId, 
            windowsCount: windows.length, 
            totalAreaMaterial 
          });

          if (!clientId && returnedId) {
            // Если создали нового — летим на страницу с ID
            router.replace(`/dashboard/new-calculation?id=${returnedId}`);
          } else {
            router.refresh();
          }
          
          alert('Данные успешно сохранены');
        } else {
          // Тут result точно имеет поле error (благодаря нашему Promise типу в actions.ts)
          const errorMsg = 'error' in result ? result.error : 'Неизвестная ошибка';
          logger.error('[CalculationClient] Ошибка сохранения', { clientId, error: errorMsg });
          alert('Ошибка сохранения: ' + errorMsg);
        }
      } catch (err) {
        logger.error('[CalculationClient] Исключение при сохранении', err);
        alert('Критическая ошибка при сохранении');
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, windows, totalAreaMaterial]
  );

  const handleWindowsSave = useCallback(
    async (updatedWindows: WindowItem[]): Promise<void> => {
      if (isReadOnly) return;
      handleWindowsChange(updatedWindows);
      setIsSaving(true);
      try {
        const result = await updateClientAction(clientId, { items: updatedWindows });
        if (result.success) {
          logger.info('[CalculationClient] Изделия сохранены', { clientId, count: updatedWindows.length });
          router.refresh();
        } else {
          logger.error('[CalculationClient] Ошибка сохранения изделий', { error: result.error });
          alert('Ошибка сохранения изделий: ' + result.error);
        }
      } catch (err) {
        logger.error('[CalculationClient] Исключение при сохранении изделий', err);
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, isReadOnly, router, handleWindowsChange]
  );

  const steps: Array<{ id: Step; label: string }> = [
    { id: 'client', label: 'Клиент' },
    { id: 'items', label: 'Изделия' },
    { id: 'fasteners', label: 'Крепёж' },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <nav className={styles.stepNav}>
          {steps.map((step) => (
            <button
              key={step.id}
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

      {/* ВАЖНО: Добавляем контейнер mainContent. 
          Он позволит компонентам внутри (ClientStep, ItemsStep) 
          располагаться правильно через flexbox или grid.
      */}
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
          />
        )}

        {activeStep === 'fasteners' && (
          <FastenersStep
            onSave={() => logger.info('[CalculationClient] Крепёж сохранён (заглушка)', { clientId })}
            isReadOnly={isReadOnly}
          />
        )}
      </main>
    </div>
  );
}