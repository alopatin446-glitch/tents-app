'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ClientStep.module.css';

export interface ClientStepWindowItem {
  id: number | string;
  name: string;
  widthTop: number | string;
  heightRight: number | string;
  widthBottom: number | string;
  heightLeft: number | string;
  kantTop: number | string;
  kantRight: number | string;
  kantBottom: number | string;
  kantLeft: number | string;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: number | string;
  diagonalRight: number | string;
  crossbar: number | string;
}

export interface ClientFormData {
  fio: string;
  phone: string;
  address: string;
  source: string;
  status: string;
  totalPrice: number;
  advance: number;
  balance: number;
  paymentType: string;
  measurementDate: string;
  installDate: string;
  items?: ClientStepWindowItem[];
  managerComment: string;
  engineerComment: string;
}

export interface ClientStepInitialData {
  fio?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  status?: string | null;
  totalPrice?: number | string | null;
  advance?: number | string | null;
  balance?: number | string | null;
  paymentType?: string | null;
  measurementDate?: string | Date | null;
  installDate?: string | Date | null;
  items?: ClientStepWindowItem[] | null;
  managerComment?: string | null;
  engineerComment?: string | null;
}

interface ClientStepProps {
  initialData: ClientStepInitialData;
  onSave: (data: Partial<ClientFormData>) => void | Promise<void>;
  onClose: () => void;
  isReadOnly?: boolean;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateToInput(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toISOString().split('T')[0];
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    return value.toISOString().split('T')[0];
  }

  return '';
}

export default function ClientStep({
  initialData,
  onSave,
  onClose,
  isReadOnly = false,
}: ClientStepProps) {
  const router = useRouter();

  const [form, setForm] = useState<ClientFormData>({
    fio: '',
    phone: '',
    address: '',
    source: '',
    status: 'special_case',
    totalPrice: 0,
    advance: 0,
    balance: 0,
    paymentType: '',
    measurementDate: '',
    installDate: '',
    items: [],
    managerComment: '',
    engineerComment: '',
  });

  useEffect(() => {
    setForm({
      fio: initialData.fio ?? '',
      phone: initialData.phone ?? '',
      address: initialData.address ?? '',
      source: initialData.source ?? '',
      status: initialData.status ?? 'special_case',
      totalPrice: normalizeNumber(initialData.totalPrice, 0),
      advance: normalizeNumber(initialData.advance, 0),
      balance: normalizeNumber(initialData.balance, 0),
      paymentType: initialData.paymentType ?? '',
      measurementDate: normalizeDateToInput(initialData.measurementDate),
      installDate: normalizeDateToInput(initialData.installDate),
      items: Array.isArray(initialData.items) ? initialData.items : [],
      managerComment: initialData.managerComment ?? '',
      engineerComment: initialData.engineerComment ?? '',
    });
  }, [initialData]);

  const handleChange = (field: keyof ClientFormData, value: string) => {
    if (isReadOnly) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumberChange = (field: keyof ClientFormData, value: string) => {
    if (isReadOnly) {
      return;
    }

    const normalized = value.replace(',', '.');

    setForm((prev) => ({
      ...prev,
      [field]: normalized === '' ? 0 : normalizeNumber(normalized, 0),
    }));
  };

  const handleSave = async () => {
    if (isReadOnly) {
      return;
    }

    await onSave(form);
  };

  const handleExit = () => {
    if (onClose) {
      onClose();
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className={styles.container}>
      <div className={styles.accordionArea}>
        <div className={styles.section}>
          <h3>Данные клиента</h3>

          <input
            placeholder="ФИО"
            value={form.fio}
            onChange={(e) => handleChange('fio', e.target.value)}
            disabled={isReadOnly}
          />

          <input
            placeholder="Телефон"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            disabled={isReadOnly}
          />

          <input
            placeholder="Адрес"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            disabled={isReadOnly}
          />

          <input
            placeholder="Источник"
            value={form.source}
            onChange={(e) => handleChange('source', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className={styles.section}>
          <h3>Финансы</h3>

          <input
            placeholder="Общая сумма"
            value={form.totalPrice}
            onChange={(e) => handleNumberChange('totalPrice', e.target.value)}
            disabled={isReadOnly}
          />

          <input
            placeholder="Аванс"
            value={form.advance}
            onChange={(e) => handleNumberChange('advance', e.target.value)}
            disabled={isReadOnly}
          />

          <input
            placeholder="Остаток"
            value={form.balance}
            onChange={(e) => handleNumberChange('balance', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className={styles.section}>
          <h3>Комментарии</h3>

          <textarea
            placeholder="Комментарий менеджера"
            value={form.managerComment}
            onChange={(e) => handleChange('managerComment', e.target.value)}
            disabled={isReadOnly}
          />

          <textarea
            placeholder="Комментарий инженера"
            value={form.engineerComment}
            onChange={(e) => handleChange('engineerComment', e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      <div className={styles.stickySidebar}>
        {!isReadOnly && (
          <button className={styles.saveBtn} onClick={handleSave}>
            СОХРАНИТЬ
          </button>
        )}

        <button className={styles.exitBtn} onClick={handleExit}>
          ВЫЙТИ
        </button>
      </div>
    </div>
  );
}