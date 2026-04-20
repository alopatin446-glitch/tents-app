'use client';

import { useEffect, useState } from 'react';
import styles from './ClientStep.module.css';

const sourceOptions = [
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

const statusOptions = [
  { id: 'negotiation', label: 'Общение с клиентом' },
  { id: 'waiting_measure', label: 'Ожидает замер' },
  { id: 'promised_pay', label: 'Обещал заплатить' },
  { id: 'waiting_production', label: 'Ожидает изделия' },
  { id: 'waiting_install', label: 'Ожидает монтаж' },
  { id: 'special_case', label: 'Особый случай' },
  { id: 'completed', label: 'Сделка успешна' },
  { id: 'rejected', label: 'Сделка провалена' },
] as const;

type ClientStatus = (typeof statusOptions)[number]['id'];
type SourceOption = (typeof sourceOptions)[number];

export interface ClientStepData {
  fio?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: SourceOption | string | null;
  status?: ClientStatus | string | null;
  measurementDate?: string | null;
  managerComment?: string | null;
  installDate?: string | null;
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
}

interface ClientStepProps {
  initialData: ClientStepData;
  onSave: (data: ClientStepData) => void | Promise<void>;
  onClose: () => void;
  isReadOnly?: boolean;
}

type OpenSections = {
  data: boolean;
  media: boolean;
  payments: boolean;
  results: boolean;
};

type InputChangeEvent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLTextAreaElement>
  | React.ChangeEvent<HTMLSelectElement>;

export default function ClientStep({
  initialData,
  onSave,
  onClose,
  isReadOnly = false,
}: ClientStepProps) {
  const [clientData, setClientData] = useState<ClientStepData>(initialData);

  useEffect(() => {
    setClientData(initialData);
  }, [initialData]);

  const [openSections, setOpenSections] = useState<OpenSections>({
    data: false,
    media: false,
    payments: false,
    results: false,
  });

  const toggleSection = (section: keyof OpenSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (e: InputChangeEvent) => {
    const { name, value, type } = e.target;

    let nextValue: string | number = value;

    if (type === 'number') {
      nextValue = value === '' ? '' : Number(value);
    }

    setClientData((prev) => {
      const newData: ClientStepData = {
        ...prev,
        [name]: nextValue,
      };

      onSave(newData);
      return newData;
    });
  };

  const handleSaveClick = () => {
    if (isReadOnly) return;

    const payload: ClientStepData = {
      ...clientData,
      status: clientData.status || '',
    };

    console.log('Нажали сохранить! Данные:', payload);
    onSave(payload);
  };

  const areaValue = Number(clientData.area || 0);
  const totalPriceValue = Number(clientData.totalPrice || 0);
  const costPriceValue = Number(clientData.costPrice || 0);
  const profitValue = totalPriceValue - costPriceValue;

  return (
    <div className={styles.container}>
      <div className={styles.accordionArea}>
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('data')}>
            <span>Данные клиента</span>
            <span className={styles.arrow}>{openSections.data ? '▲' : '▼'}</span>
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
                  <label>Адрес (Ключ поиска)</label>
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
                  <label>Откуда узнали</label>
                  <select
                    name="source"
                    value={clientData.source || ''}
                    onChange={handleChange}
                    className={styles.neonSelect}
                    disabled={isReadOnly}
                  >
                    <option value="">Выберите источник...</option>
                    {sourceOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
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
                    {statusOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Дата замера</label>
                  <input
                    type="date"
                    name="measurementDate"
                    value={clientData.measurementDate || ''}
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
                  style={{
                    borderRadius: '25px',
                    minHeight: '80px',
                    paddingTop: '12px',
                  }}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('media')}>
            <span>Фото и материалы</span>
            <span className={styles.arrow}>{openSections.media ? '▲' : '▼'}</span>
          </div>

          {openSections.media && (
            <div className={styles.content}>
              <div className={styles.inputGroup}>
                <label>Фото объекта</label>
                <input
                  type="file"
                  name="photoObject"
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Фото замера</label>
                <input
                  type="file"
                  name="photoMeasurement"
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Дата монтажа</label>
                <input
                  type="date"
                  name="installDate"
                  value={clientData.installDate || ''}
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
                  style={{
                    borderRadius: '25px',
                    minHeight: '80px',
                    paddingTop: '12px',
                  }}
                  disabled={isReadOnly}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Фото Договора</label>
                <input
                  type="file"
                  name="photoContract"
                  className={styles.neonInput}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('payments')}>
            <span>Платежи и переводы</span>
            <span className={styles.arrow}>
              {openSections.payments ? '▲' : '▼'}
            </span>
          </div>

          {openSections.payments && (
            <div className={styles.content}>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Стоимость заказа</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={clientData.totalPrice || ''}
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
                    value={clientData.advance || ''}
                    onChange={handleChange}
                    className={styles.neonInput}
                    disabled={isReadOnly}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Остаток</label>
                  <input
                    type="number"
                    name="balance"
                    value={clientData.balance || ''}
                    onChange={handleChange}
                    className={styles.neonInput}
                    disabled={isReadOnly}
                  />
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
                    <option value="">Выберите тип оплаты...</option>
                    <option value="cash">Наличными</option>
                    <option value="transfer">Переводом</option>
                    <option value="mixed">Смешанная оплата</option>
                    <option value="invoice">По расчётному счёту</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('results')}>
            <span>Прибыль и расход</span>
            <span className={styles.arrow}>{openSections.results ? '▲' : '▼'}</span>
          </div>

          {openSections.results && (
            <div className={styles.content}>
              <div className={styles.statLine}>
                <span>Площадь:</span>
                <strong>{Number(areaValue)} м²</strong>
              </div>

              <div className={styles.statLine}>
                <span>Стоимость:</span>
                <strong>{Number(totalPriceValue)} ₽</strong>
              </div>

              <div className={styles.statLine}>
                <span>Себестоимость:</span>
                <strong style={{ color: '#ff4d4d' }}>
                  {Number(costPriceValue)} ₽
                </strong>
              </div>

              <hr className={styles.divider} style={{ margin: '10px 0' }} />

              <div className={styles.statLine}>
                <span>Прибыль/Маржа:</span>
                <strong className={styles.profitText}>
                  {Number(profitValue)} ₽
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.stickySidebar}>
        <div className={styles.infoCard}>
          <h3>Служебная информация</h3>
          <p>
            Дата создания: <span>Авто</span>
          </p>
          <p>
            Дата изменения: <span>Авто</span>
          </p>
          <p>
            Создал: <span>Админ</span>
          </p>
          <p>
            Изменил: <span>Админ</span>
          </p>

          <hr className={styles.divider} />

          <div className={styles.sidebarTotal}>
            <span>Сумма заказа:</span>
            <strong>{Number(totalPriceValue)} ₽</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.saveBtn}
            onClick={handleSaveClick}
            disabled={isReadOnly}
          >
            СОХРАНИТЬ
          </button>

          <button className={styles.exitBtn} onClick={onClose}>
            ВЫЙТИ
          </button>
        </div>
      </div>
    </div>
  );
}