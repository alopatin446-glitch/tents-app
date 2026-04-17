'use client';

import { useState } from 'react';
import styles from './ClientStep.module.css';

const sourceOptions = ['VK', '2Гис', 'Макс', 'Сайт', 'Авито', 'Telegram', 'Яндекс бизнес', 'Яндекс Директ', 'Повторный клиент', 'По рекомендации', 'Проезжал мимо офиса', 'Проезжал мимо цеха', 'От председателя', 'Баннер в СНТ', 'Другое'];
const statusOptions = ['Общение с клиентом', 'Ожидает замер', 'Обещал заплатить', 'Ожидает Монтаж', 'Ожидает изделия', 'Сделка успешна', 'Сделка провалена'];

export default function ClientStep({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
  const [clientData, setClientData] = useState(initialData || {});
  // Состояния для раскрытия аккордеонов
  const [openSections, setOpenSections] = useState({
    data: true, // Первый пусть будет открыт по умолчанию
    media: false,
    payments: false,
    results: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setClientData((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className={styles.container}>
      {/* ЛЕВАЯ ЧАСТЬ: АККОРДЕОНЫ */}
      <div className={styles.accordionArea}>
        
        {/* БЛОК 1: ДАННЫЕ */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('data')}>
            <span>Данные клиента</span>
            <span className={styles.arrow}>{openSections.data ? '▲' : '▼'}</span>
          </div>
          {openSections.data && (
            <div className={styles.content}>
              <div className={styles.inputGroup}><label>ФИО</label><input type="text" name="fio" value={clientData.fio} onChange={handleChange} className={styles.neonInput} /></div>
              <div className={styles.row}>
                <div className={styles.inputGroup}><label>Телефон</label><input type="tel" name="phone" className={styles.neonInput} /></div>
                <div className={styles.inputGroup}><label>Источник</label>
                  <select name="source" className={styles.neonSelect}>
                    {sourceOptions.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.inputGroup}><label>Адрес</label><input type="text" name="address" className={styles.neonInput} /></div>
              <div className={styles.row}>
                <div className={styles.inputGroup}><label>Статус</label>
                  <select name="status" className={styles.neonSelect}>
                    {statusOptions.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}><label>Дата замера</label><input type="date" className={styles.neonInput} /></div>
              </div>
            </div>
          )}
        </div>

        {/* БЛОК 2: МАТЕРИАЛЫ */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('media')}>
            <span>Фото и материалы</span>
            <span className={styles.arrow}>{openSections.media ? '▲' : '▼'}</span>
          </div>
          {openSections.media && (
            <div className={styles.content}>
               <div className={styles.inputGroup}><label>Фото объекта</label><input type="file" className={styles.neonInput} /></div>
               <div className={styles.inputGroup}><label>Дата монтажа</label><input type="date" className={styles.neonInput} /></div>
            </div>
          )}
        </div>

        {/* БЛОК 3: ПЛАТЕЖИ */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('payments')}>
            <span>Платежи и переводы</span>
            <span className={styles.arrow}>{openSections.payments ? '▲' : '▼'}</span>
          </div>
          {openSections.payments && (
            <div className={styles.content}>
              <div className={styles.row}>
                <div className={styles.inputGroup}><label>Стоимость</label><input type="number" className={styles.neonInput} /></div>
                <div className={styles.inputGroup}><label>Аванс</label><input type="number" className={styles.neonInput} /></div>
              </div>
            </div>
          )}
        </div>

        {/* БЛОК 4: ИТОГИ */}
        <div className={styles.section}>
          <div className={styles.header} onClick={() => toggleSection('results')}>
            <span>Прибыль и расход</span>
            <span className={styles.arrow}>{openSections.results ? '▲' : '▼'}</span>
          </div>
          {openSections.results && (
            <div className={styles.content}>
              <div className={styles.statLine}>Площадь: <strong>0 м²</strong></div>
              <div className={styles.statLine}>Прибыль: <strong>0 ₽</strong></div>
            </div>
          )}
        </div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ: СЛУЖЕБКА (STICKY) */}
      <div className={styles.stickySidebar}>
        <div className={styles.infoCard}>
          <h3>Служебная информация</h3>
          <p>Дата создания: <span>Авто</span></p>
          <p>Создал: <span>Админ</span></p>
          <p>Изменил: <span>Админ</span></p>
        </div>
        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={() => onSave(clientData)}>СОХРАНИТЬ</button>
          <button className={styles.exitBtn}>ВЫЙТИ</button>
        </div>
      </div>
    </div>
  );
}