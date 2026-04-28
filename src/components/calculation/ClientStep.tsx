'use client';

/**
 * Форма данных клиента — аккордеон с секциями.
 */

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import styles from './ClientStep.module.css';

import { type WindowItem } from '@/types';
import { ALL_STATUS_OPTIONS } from '@/lib/logic/statusDictionary';

import {
  toFinancialNumber,
  formatMoney,
} from '@/lib/logic/financialCalculations';

export type { WindowItem as ClientStepWindowItem };

const SOURCE_OPTIONS = [
  'VK',
  '2Гис',
  'Макс',
  'Сайт',
  'Авито',
  'Telegram',
  'Яндекс бизнес',
  'Яндекс Директ',
  'Повторный клиент',
  'По рекомендации',
  'Проезжал мимо офиса',
  'Проезжал мимо цеха',
  'От председателя',
  'Баннер в СНТ',
  'Другое',
] as const;

type SourceOption = (typeof SOURCE_OPTIONS)[number];

export interface ClientFormData {
  [key: string]: any;

  fio?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: SourceOption | string | null;
  status?: string | null;

  measurementDate?: any;
  managerComment?: string | null;

  installDate?: any;
  engineerComment?: string | null;

  preliminaryPrice?: number | string | null;
  totalPrice?: number | string | null;
  advance?: number | string | null;
  balance?: number | string | null;
  paymentType?: string | null;

  area?: number | string | null;
  costPrice?: number | string | null;
  overspending?: number | string | null;
  productionCost?: number | string | null;
  mountingCost?: number | string | null;

  photoObject?: File | null;
  photoMeasurement?: File | null;
  photoContract?: File | null;

  items?: WindowItem[] | null;
  mountingConfig?: any;
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

function formatDateInputValue(value: any): string {
  if (!value) return '';

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  return String(value);
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
    data: false,
    media: false,
    payments: false,
    results: false,
  });

  useEffect(() => {
    if (!isReadOnly) {
      onDraftChange?.(clientData);
    }
  }, [clientData, onDraftChange, isReadOnly]);

  const financials = useMemo(() => {
    const retailPrice = toFinancialNumber(clientData.totalPrice);
    const advance = toFinancialNumber(clientData.advance);

    const costPrice = toFinancialNumber(clientData.costPrice);
    const overspending = toFinancialNumber(clientData.overspending);
    const productionCost = toFinancialNumber(clientData.productionCost);
    const mountingCost = toFinancialNumber(clientData.mountingCost);

    const balance = retailPrice - advance;

    const totalExpenses =
      costPrice + overspending + productionCost + mountingCost;

    const netProfit = retailPrice - totalExpenses;

    return {
      retailPrice,
      advance,
      balance,
      costPrice,
      overspending,
      productionCost,
      mountingCost,
      totalExpenses,
      netProfit,
      isUnprofitable: netProfit < 0,
    };
  }, [
    clientData.totalPrice,
    clientData.advance,
    clientData.costPrice,
    clientData.overspending,
    clientData.productionCost,
    clientData.mountingCost,
  ]);

  const toggleSection = useCallback((section: keyof OpenSections): void => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleChange = useCallback(
    (e: InputChangeEvent): void => {
      if (isReadOnly) return;

      const { name, value } = e.target;

      setClientData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    [isReadOnly]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (isReadOnly) return;

      const { name, files } = e.target;
      const file = files?.[0] ?? null;

      setClientData((prev) => ({
        ...prev,
        [name]: file,
      }));
    },
    [isReadOnly]
  );

  const handleSaveClick = useCallback((): void => {
    if (isReadOnly) return;

    onSave({
      ...clientData,
      status: clientData.status ?? '',
      balance: financials.balance,
    });
  }, [isReadOnly, clientData, financials.balance, onSave]);

  const areaDisplay = toFinancialNumber(clientData.area);

  return (
    <div className={styles.container}>
      <div className={styles.accordionArea}>
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('data')}>
            <span>Данные клиента</span>
            <span>{openSections.data ? '▲' : '▼'}</span>
          </div>

          {openSections.data && (
            <div className={styles.content}>
              <div className={styles.inputGroup}>
                <label>ФИО</label>
                <input
                  type="text"
                  name="fio"
                  value={clientData.fio || ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Телефон</label>
                  <input
                    type="tel"
                    name="phone"
                    value={clientData.phone || ''}
                    onChange={handleChange}
                    className={styles.neonInput}
                    disabled={isReadOnly}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Адрес</label>
                  <input
                    type="text"
                    name="address"
                    value={clientData.address || ''}
                    onChange={handleChange}
                    className={styles.neonInput}
                    disabled={isReadOnly}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Источник</label>
                  <select
                    name="source"
                    value={clientData.source || ''}
                    onChange={handleChange}
                    className={styles.neonSelect}
                    disabled={isReadOnly}
                  >
                    <option value="">Выберите источник...</option>
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Статус</label>
                  <select
                    name="status"
                    value={clientData.status || ''}
                    onChange={handleChange}
                    className={styles.neonSelect}
                    disabled={isReadOnly}
                  >
                    <option value="">Выберите статус...</option>
                    {ALL_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Дата замера</label>
                  <input
                    type="date"
                    name="measurementDate"
                    value={formatDateInputValue(clientData.measurementDate)}
                    onChange={handleChange}
                    className={styles.neonInput}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Комментарий менеджера</label>
                <textarea
                  name="managerComment"
                  value={clientData.managerComment || ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  style={{ minHeight: '80px', borderRadius: '25px' }}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('media')}>
            <span>Фото и материалы</span>
            <span>{openSections.media ? '▲' : '▼'}</span>
          </div>

          {openSections.media && (
            <div className={styles.content}>
              <div className={styles.inputGroup}>
                <label>Фото объекта</label>
                <input
                  type="file"
                  name="photoObject"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Фото замера</label>
                <input
                  type="file"
                  name="photoMeasurement"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Фото договора</label>
                <input
                  type="file"
                  name="photoContract"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Дата монтажа</label>
                <input
                  type="date"
                  name="installDate"
                  value={formatDateInputValue(clientData.installDate)}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Комментарий инженера</label>
                <textarea
                  name="engineerComment"
                  value={clientData.engineerComment || ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  style={{ minHeight: '80px', borderRadius: '25px' }}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('payments')}>
            <span>Платежи и переводы</span>
            <span>{openSections.payments ? '▲' : '▼'}</span>
          </div>

          {openSections.payments && (
            <div className={styles.content}>
              <div className={styles.inputGroup}>
                <label>Предварительная стоимость</label>
                <input
                  type="number"
                  name="preliminaryPrice"
                  value={clientData.preliminaryPrice ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Розничная стоимость</label>
                <input
                  type="number"
                  name="totalPrice"
                  value={clientData.totalPrice ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Аванс</label>
                <input
                  type="number"
                  name="advance"
                  value={clientData.advance ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.statLine}>
                <span>Остаток:</span>
                <strong>{formatMoney(financials.balance)}</strong>
              </div>

              <div className={styles.inputGroup}>
                <label>Тип оплаты</label>
                <select
                  name="paymentType"
                  value={clientData.paymentType || ''}
                  onChange={handleChange}
                  className={styles.neonSelect}
                  disabled={isReadOnly}
                >
                  <option value="cash">Наличными</option>
                  <option value="transfer">Переводом</option>
                  <option value="invoice">По счету</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('results')}>
            <span>Прибыль и расход</span>
            <span>{openSections.results ? '▲' : '▼'}</span>
          </div>

          {openSections.results && (
            <div className={styles.content}>
              <div className={styles.statLine}>
                <span>Площадь:</span>
                <strong>{areaDisplay.toFixed(2)} м²</strong>
              </div>

              <div className={styles.inputGroup}>
                <label>Себестоимость</label>
                <input
                  type="number"
                  name="costPrice"
                  value={clientData.costPrice ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Перерасход</label>
                <input
                  type="number"
                  name="overspending"
                  value={clientData.overspending ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Стоимость изготовления</label>
                <input
                  type="number"
                  name="productionCost"
                  value={clientData.productionCost ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Стоимость монтажа</label>
                <input
                  type="number"
                  name="mountingCost"
                  value={clientData.mountingCost ?? ''}
                  onChange={handleChange}
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <hr className={styles.divider} />

              <div className={styles.statLine}>
                <span>Всего расходов:</span>
                <strong>{formatMoney(financials.totalExpenses)}</strong>
              </div>

              <div className={styles.statLine}>
                <span>Чистая прибыль:</span>
                <strong style={{ color: financials.isUnprofitable ? '#ff4d4d' : '#a3ff00' }}>
                  {formatMoney(financials.netProfit)}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className={styles.stickySidebar}>
        <div className={styles.infoCard}>
          <h3>Служебная информация</h3>
          <p>
            Создал: <span>Админ</span>
          </p>
          <p>
            Изменил: <span>Админ</span>
          </p>

          <hr className={styles.divider} />

          <div className={styles.sidebarTotal}>
            <span>Сумма заказа:</span>
            <strong>{formatMoney(financials.retailPrice)}</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSaveClick} disabled={isReadOnly}>
            СОХРАНИТЬ
          </button>
          <button className={styles.exitBtn} onClick={onClose}>
            ВЫЙТИ
          </button>
        </div>
      </aside>
    </div>
  );
}