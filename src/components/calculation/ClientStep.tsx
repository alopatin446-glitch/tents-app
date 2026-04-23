'use client';

/**
 * Форма данных клиента — аккордеон с секциями.
 * Исправлена структура для корректной работы sticky-сайдбара.
 */

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import styles from './ClientStep.module.css';

// Ядро: типы изделия
import { type WindowItem } from '@/types';

// Ядро: статусы
import { ALL_STATUS_OPTIONS } from '@/lib/logic/statusDictionary';

// Ядро: финансы
import {
  toFinancialNumber,
  calculateClientFinancials,
  formatMoney,
  formatMargin,
} from '@/lib/logic/financialCalculations';

export type { WindowItem as ClientStepWindowItem };

const SOURCE_OPTIONS = [
  'VK', '2Гис', 'Макс', 'Сайт', 'Авито', 'Telegram', 
  'Яндекс бизнес', 'Яндекс Директ', 'Повторный клиент', 
  'По рекомендации', 'Проезжал мимо офиса', 'Проезжал мимо цеха', 
  'От председателя', 'Баннер в СНТ', 'Другое',
] as const;

type SourceOption = (typeof SOURCE_OPTIONS)[number];

export interface ClientFormData {
  fio?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: SourceOption | string | null;
  status?: string | null;
  measurementDate?: string | Date | null;
  managerComment?: string | null;
  installDate?: string | Date | null;
  engineerComment?: string | null;
  totalPrice?: number | string | null;
  advance?: number | string | null;
  balance?: number | string | null;
  paymentType?: string | null;
  area?: number | string | null;
  costPrice?: number | string | null;
  photoObject?: File | null;
  photoMeasurement?: File | null;
  photoContract?: File | null;
  items?: WindowItem[] | null;
}

type OpenSections = {
  data: boolean;
  media: boolean;
  payments: boolean;
  results: boolean;
};

type InputChangeEvent =
  | ChangeEvent<HTMLInputElement>
  | ChangeEvent<HTMLTextAreaElement>
  | ChangeEvent<HTMLSelectElement>;

interface ClientStepProps {
  initialData: ClientFormData;
  onSave: (data: ClientFormData) => void | Promise<void>;
  onDraftChange?: (data: ClientFormData) => void;
  onClose: () => void;
  isReadOnly?: boolean;
}

export default function ClientStep({
  initialData,
  onSave,
  onDraftChange,
  onClose,
  isReadOnly = false,
}: ClientStepProps) {
  const [clientData, setClientData] = useState<ClientFormData>(initialData);

  const [openSections, setOpenSections] = useState<OpenSections>({
    data: true, // По умолчанию открываем первую
    media: false,
    payments: false,
    results: false,
  });

  // Синхронизация черновика
  useEffect(() => {
    if (!isReadOnly) {
      onDraftChange?.(clientData);
    }
  }, [clientData, onDraftChange, isReadOnly]);

  // Расчеты
  const financials = useMemo(
    () =>
      calculateClientFinancials({
        totalPrice: toFinancialNumber(clientData.totalPrice),
        advance: toFinancialNumber(clientData.advance),
        costPrice: toFinancialNumber(clientData.costPrice),
      }),
    [clientData.totalPrice, clientData.advance, clientData.costPrice]
  );

  const toggleSection = useCallback((section: keyof OpenSections): void => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleChange = useCallback((e: InputChangeEvent): void => {
    if (isReadOnly) return;
    const { name, value } = e.target;
    setClientData((prev) => ({ ...prev, [name]: value }));
  }, [isReadOnly]);

  const handleSaveClick = useCallback((): void => {
    if (isReadOnly) return;
    onSave({ ...clientData, status: clientData.status ?? '' });
  }, [isReadOnly, clientData, onSave]);

  const areaDisplay = toFinancialNumber(clientData.area);
  const totalPriceDisplay = toFinancialNumber(clientData.totalPrice);

  return (
    <div className={styles.container}>
      {/* ЛЕВАЯ КОЛОНКА: АККОРДЕОНЫ */}
      <div className={styles.accordionArea}>
        
        {/* Данные клиента */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('data')}>
            <span>Данные клиента</span>
            <span>{openSections.data ? '▲' : '▼'}</span>
          </div>
          {openSections.data && (
            <div className={styles.content}>
              <div className={styles.inputGroup}>
                <label>ФИО</label>
                <input type="text" name="fio" value={clientData.fio || ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} />
              </div>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Телефон</label>
                  <input type="tel" name="phone" value={clientData.phone || ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Адрес</label>
                  <input type="text" name="address" value={clientData.address || ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Источник</label>
                  <select name="source" value={clientData.source || ''} onChange={handleChange} className={styles.neonSelect} disabled={isReadOnly}>
                    <option value="">Выберите источник...</option>
                    {SOURCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Статус</label>
                  <select name="status" value={clientData.status || ''} onChange={handleChange} className={styles.neonSelect} disabled={isReadOnly}>
                    <option value="">Выберите статус...</option>
                    {ALL_STATUS_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Дата замера</label>
                  <input type="date" name="measurementDate" value={clientData.measurementDate instanceof Date ? clientData.measurementDate.toISOString().split('T')[0] : clientData.measurementDate || ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label>Комментарий менеджера</label>
                <textarea name="managerComment" value={clientData.managerComment || ''} onChange={handleChange} className={styles.neonInput} style={{ minHeight: '80px', borderRadius: '25px' }} disabled={isReadOnly} />
              </div>
            </div>
          )}
        </div>

        {/* Фото и материалы */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('media')}>
            <span>Фото и материалы</span>
            <span>{openSections.media ? '▲' : '▼'}</span>
          </div>
          {openSections.media && (
            <div className={styles.content}>
              <div className={styles.inputGroup}><label>Фото объекта</label><input type="file" className={styles.neonInput} disabled={isReadOnly} /></div>
              <div className={styles.inputGroup}><label>Дата монтажа</label><input type="date" name="installDate" value={clientData.installDate instanceof Date ? clientData.installDate.toISOString().split('T')[0] : clientData.installDate || ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} /></div>
              <div className={styles.inputGroup}><label>Комментарий инженера</label><textarea name="engineerComment" value={clientData.engineerComment || ''} onChange={handleChange} className={styles.neonInput} style={{ minHeight: '80px', borderRadius: '25px' }} disabled={isReadOnly} /></div>
            </div>
          )}
        </div>

        {/* Платежи */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('payments')}>
            <span>Платежи и переводы</span>
            <span>{openSections.payments ? '▲' : '▼'}</span>
          </div>
          {openSections.payments && (
            <div className={styles.content}>
              <div className={styles.row}>
                <div className={styles.inputGroup}><label>Стоимость</label><input type="number" name="totalPrice" value={clientData.totalPrice ?? ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} /></div>
                <div className={styles.inputGroup}><label>Аванс</label><input type="number" name="advance" value={clientData.advance ?? ''} onChange={handleChange} className={styles.neonInput} disabled={isReadOnly} /></div>
                <div className={styles.inputGroup}><label>Тип оплаты</label>
                  <select name="paymentType" value={clientData.paymentType || ''} onChange={handleChange} className={styles.neonSelect} disabled={isReadOnly}>
                    <option value="cash">Наличными</option>
                    <option value="transfer">Переводом</option>
                    <option value="invoice">По счету</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Прибыль */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('results')}>
            <span>Прибыль и расход</span>
            <span>{openSections.results ? '▲' : '▼'}</span>
          </div>
          {openSections.results && (
            <div className={styles.content}>
              <div className={styles.statLine}><span>Площадь:</span><strong>{areaDisplay.toFixed(2)} м²</strong></div>
              <div className={styles.statLine}><span>Себестоимость:</span><input type="number" name="costPrice" value={clientData.costPrice ?? ''} onChange={handleChange} className={styles.neonInput} style={{ width: '120px' }} disabled={isReadOnly} /></div>
              <hr className={styles.divider} />
              <div className={styles.statLine}>
                <span>Прибыль:</span>
                <strong style={{ color: financials.isUnprofitable ? '#ff4d4d' : '#a3ff00' }}>
                  {formatMoney(financials.profit)} ({formatMargin(financials.marginPercent)})
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ПРАВАЯ КОЛОНКА: САЙДБАР */}
      <aside className={styles.stickySidebar}>
        <div className={styles.infoCard}>
          <h3>Служебная информация</h3>
          <p>Создал: <span>Админ</span></p>
          <p>Изменил: <span>Админ</span></p>
          <hr className={styles.divider} />
          <div className={styles.sidebarTotal}>
            <span>Сумма заказа:</span>
            <strong>{formatMoney(totalPriceDisplay)}</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSaveClick} disabled={isReadOnly}>СОХРАНИТЬ</button>
          <button className={styles.exitBtn} onClick={onClose}>ВЫЙТИ</button>
        </div>
      </aside>
    </div>
  );
}