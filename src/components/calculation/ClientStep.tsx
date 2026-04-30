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

type ClientFileItem = {
  id: string;
  clientId: string;
  organizationId: string;
  url: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

type ClientFilesResponse = {
  ok: boolean;
  files?: ClientFileItem[];
  file?: ClientFileItem;
  error?: string;
};

export interface ClientFormData {
  [key: string]: any;

  id?: string | null;

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

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 Б';

  const kb = size / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} КБ`;
  }

  const mb = kb / 1024;

  return `${mb.toFixed(1)} МБ`;
}

function getCategoryLabel(category: string | null): string {
  switch (category) {
    case 'object':
      return 'Объект';
    case 'measurement':
      return 'Замер';
    case 'contract':
      return 'Договор';
    case 'video':
      return 'Видео';
    default:
      return 'Другое';
  }
}

export default function ClientStep({
  initialData,
  onSave,
  onDraftChange,
  onClose,
  isReadOnly = false,
}: ClientStepProps) {
  const [clientData, setClientData] = useState<ClientFormData>(initialData);
  const [clientFiles, setClientFiles] = useState<ClientFileItem[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<OpenSections>({
    data: false,
    media: false,
    payments: false,
    results: false,
  });

  const clientId = typeof clientData.id === 'string' ? clientData.id : '';

  useEffect(() => {
    setClientData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!isReadOnly) {
      onDraftChange?.(clientData);
    }
  }, [clientData, onDraftChange, isReadOnly]);

  useEffect(() => {
    let isMounted = true;

    async function loadClientFiles() {
      if (!clientId) {
        setClientFiles([]);
        return;
      }

      setIsFilesLoading(true);
      setFileActionError(null);

      try {
        const response = await fetch(
          `/api/client-files?clientId=${encodeURIComponent(clientId)}`
        );

        const result = (await response.json().catch(() => null)) as ClientFilesResponse | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || 'Не удалось получить файлы заказа.');
        }

        if (isMounted) {
          setClientFiles(result.files || []);
        }
      } catch (error) {
        if (isMounted) {
          setFileActionError(
            error instanceof Error
              ? error.message
              : 'Не удалось получить файлы заказа.'
          );
        }
      } finally {
        if (isMounted) {
          setIsFilesLoading(false);
        }
      }
    }

    loadClientFiles();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

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

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>, category: string): Promise<void> => {
      if (isReadOnly) return;

      const files = Array.from(e.target.files || []);

      if (files.length === 0) return;

      if (!clientId) {
        setFileActionError(
          'Сначала сохраните карточку заказа, затем загрузите файлы.'
        );
        e.target.value = '';
        return;
      }

      setUploadingCategory(category);
      setFileActionError(null);

      try {
        for (const file of files) {
          const formData = new FormData();

          formData.append('clientId', clientId);
          formData.append('category', category);
          formData.append('file', file);

          const response = await fetch('/api/client-files', {
            method: 'POST',
            body: formData,
          });

          const result = (await response.json().catch(() => null)) as ClientFilesResponse | null;

          if (!response.ok || !result?.ok || !result.file) {
            throw new Error(result?.error || 'Не удалось загрузить файл.');
          }

          setClientFiles((prev) => [...prev, result.file as ClientFileItem]);
        }
      } catch (error) {
        setFileActionError(
          error instanceof Error ? error.message : 'Не удалось загрузить файл.'
        );
      } finally {
        setUploadingCategory(null);
        e.target.value = '';
      }
    },
    [clientId, isReadOnly]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string): Promise<void> => {
      if (isReadOnly) return;

      setDeletingFileId(fileId);
      setFileActionError(null);

      try {
        const response = await fetch('/api/client-files', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId }),
        });

        const result = (await response.json().catch(() => null)) as ClientFilesResponse | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || 'Не удалось удалить файл.');
        }

        setClientFiles((prev) => prev.filter((file) => file.id !== fileId));
      } catch (error) {
        setFileActionError(
          error instanceof Error ? error.message : 'Не удалось удалить файл.'
        );
      } finally {
        setDeletingFileId(null);
      }
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
              {!clientId && (
                <div
                  style={{
                    color: '#ffcc66',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                  }}
                >
                  Чтобы файлы не потерялись, сначала сохраните карточку заказа.
                  После сохранения можно загружать фото, видео и документы.
                </div>
              )}

              {fileActionError && (
                <div
                  style={{
                    color: '#ff4d4d',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                  }}
                >
                  {fileActionError}
                </div>
              )}

                            {uploadingCategory && (
                <div
                  style={{
                    color: '#a3ff00',
                    fontSize: '0.85rem',
                  }}
                >
                  Идёт загрузка: {getCategoryLabel(uploadingCategory)}...
                </div>
              )}

              {isFilesLoading && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                  Загружаем список файлов...
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>Фото объекта</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'object')}
                  className={styles.neonInput}
                  disabled={isReadOnly || !clientId || uploadingCategory !== null}
                />

                {!isFilesLoading && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '12px',
                      marginTop: '10px',
                    }}
                  >
                    {clientFiles
                      .filter((file) => file.category === 'object')
                      .map((file) => (
                        <div
                          key={file.id}
                          style={{
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            overflow: 'hidden',
                          }}
                        >
                          <a href={file.url} target="_blank" rel="noreferrer">
                            {file.mimeType.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.fileName}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                              />
                            ) : file.mimeType.startsWith('video/') ? (
                              <video
                                src={file.url}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                                muted
                              />
                            ) : (
                              <div
                                style={{
                                  height: '90px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(255,255,255,0.06)',
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                }}
                              >
                                Файл
                              </div>
                            )}
                          </a>

                          <div
                            style={{
                              marginTop: '8px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              wordBreak: 'break-word',
                            }}
                          >
                            {file.fileName}
                          </div>

                          <div
                            style={{
                              marginTop: '3px',
                              color: 'rgba(255,255,255,0.5)',
                              fontSize: '0.7rem',
                            }}
                          >
                            {formatFileSize(file.size)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file.id)}
                            disabled={isReadOnly || deletingFileId === file.id}
                            style={{
                              marginTop: '8px',
                              width: '100%',
                              border: '1px solid rgba(255,77,77,0.35)',
                              background: 'rgba(255,77,77,0.08)',
                              color: '#ff7a7a',
                              borderRadius: '14px',
                              padding: '6px 8px',
                              cursor: isReadOnly ? 'not-allowed' : 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {deletingFileId === file.id ? '...' : 'Удалить'}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label>Фото замера</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'measurement')}
                  className={styles.neonInput}
                  disabled={isReadOnly || !clientId || uploadingCategory !== null}
                />

                {!isFilesLoading && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '12px',
                      marginTop: '10px',
                    }}
                  >
                    {clientFiles
                      .filter((file) => file.category === 'measurement')
                      .map((file) => (
                        <div
                          key={file.id}
                          style={{
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            overflow: 'hidden',
                          }}
                        >
                          <a href={file.url} target="_blank" rel="noreferrer">
                            {file.mimeType.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.fileName}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                              />
                            ) : file.mimeType.startsWith('video/') ? (
                              <video
                                src={file.url}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                                muted
                              />
                            ) : (
                              <div
                                style={{
                                  height: '90px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(255,255,255,0.06)',
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                }}
                              >
                                Файл
                              </div>
                            )}
                          </a>

                          <div
                            style={{
                              marginTop: '8px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              wordBreak: 'break-word',
                            }}
                          >
                            {file.fileName}
                          </div>

                          <div
                            style={{
                              marginTop: '3px',
                              color: 'rgba(255,255,255,0.5)',
                              fontSize: '0.7rem',
                            }}
                          >
                            {formatFileSize(file.size)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file.id)}
                            disabled={isReadOnly || deletingFileId === file.id}
                            style={{
                              marginTop: '8px',
                              width: '100%',
                              border: '1px solid rgba(255,77,77,0.35)',
                              background: 'rgba(255,77,77,0.08)',
                              color: '#ff7a7a',
                              borderRadius: '14px',
                              padding: '6px 8px',
                              cursor: isReadOnly ? 'not-allowed' : 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {deletingFileId === file.id ? '...' : 'Удалить'}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label>Договор / материалы</label>
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'contract')}
                  className={styles.neonInput}
                  disabled={isReadOnly || !clientId || uploadingCategory !== null}
                />

                {!isFilesLoading && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '12px',
                      marginTop: '10px',
                    }}
                  >
                    {clientFiles
                      .filter((file) => file.category === 'contract')
                      .map((file) => (
                        <div
                          key={file.id}
                          style={{
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            overflow: 'hidden',
                          }}
                        >
                          <a href={file.url} target="_blank" rel="noreferrer">
                            {file.mimeType.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.fileName}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                              />
                            ) : file.mimeType.startsWith('video/') ? (
                              <video
                                src={file.url}
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  display: 'block',
                                }}
                                muted
                              />
                            ) : (
                              <div
                                style={{
                                  height: '90px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(255,255,255,0.06)',
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                }}
                              >
                                Файл
                              </div>
                            )}
                          </a>

                          <div
                            style={{
                              marginTop: '8px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              wordBreak: 'break-word',
                            }}
                          >
                            {file.fileName}
                          </div>

                          <div
                            style={{
                              marginTop: '3px',
                              color: 'rgba(255,255,255,0.5)',
                              fontSize: '0.7rem',
                            }}
                          >
                            {formatFileSize(file.size)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file.id)}
                            disabled={isReadOnly || deletingFileId === file.id}
                            style={{
                              marginTop: '8px',
                              width: '100%',
                              border: '1px solid rgba(255,77,77,0.35)',
                              background: 'rgba(255,77,77,0.08)',
                              color: '#ff7a7a',
                              borderRadius: '14px',
                              padding: '6px 8px',
                              cursor: isReadOnly ? 'not-allowed' : 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {deletingFileId === file.id ? '...' : 'Удалить'}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
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