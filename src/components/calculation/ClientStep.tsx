'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ClientStep.module.css';
import { createClientDeal } from '@/app/lib/actions'; // <-- ИМПОРТИРУЕМ НАШ ЭКШН

const sourceOptions = ['VK', '2Гис', 'Макс', 'Сайт', 'Авито', 'Telegram', 'Яндекс бизнес', 'Яндекс Директ', 'Повторный клиент', 'По рекомендации', 'Проезжал мимо офиса', 'Проезжал мимо цеха', 'От председателя', 'Баннер в СНТ', 'Другое'];
const statusOptions = ['Общение с клиентом', 'Ожидает замер', 'Обещал заплатить', 'Ожидает Монтаж', 'Ожидает изделия', 'Сделка успешна', 'Сделка провалена'];

// Хелпер для перевода статуса в формат базы данных
const getStatusKey = (status: string) => {
    switch (status) {
        case 'Общение с клиентом': return 'negotiation';
        case 'Ожидает замер': return 'waiting_measure';
        case 'Обещал заплатить': return 'promised_pay';
        case 'Ожидает изделия': return 'waiting_production';
        case 'Ожидает Монтаж': return 'waiting_install';
        case 'Сделка успешна': return 'completed';
        case 'Сделка провалена': return 'cancelled';
        default: return 'negotiation';
    }
};

export default function ClientStep({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
    const [clientData, setClientData] = useState(initialData || {});
    const [isSaving, setIsSaving] = useState(false); // Состояние загрузки
    const router = useRouter();

    const [openSections, setOpenSections] = useState({
        data: true, // Сделал по умолчанию открытым для удобства
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

    // --- НОВАЯ ФУНКЦИЯ СОХРАНЕНИЯ В БАЗУ ---
    const handleFinalSave = async () => {
        setIsSaving(true);
        
        const dataToSave = {
            name: clientData.fio || 'Без имени',
            phone: clientData.phone || '',
            address: clientData.address || '',
            totalPrice: Number(clientData.totalPrice) || 0,
            status: getStatusKey(clientData.status) // Переводим в английский ключ
        };

        const result = await createClientDeal(dataToSave);

        if (result.success) {
            alert('Сделка сохранена в PostgreSQL!');
            onSave(clientData); // Вызываем оригинальный колбэк, если нужно
            router.push('/dashboard/clients'); // Перекидываем на канбан
        } else {
            alert('Ошибка при сохранении в базу. Проверь терминал.');
        }
        setIsSaving(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.accordionArea}>
                {/* БЛОК 1: ДАННЫЕ */}
                <div className={styles.section}>
                    <div className={styles.header} onClick={() => toggleSection('data')}>
                        <span>Данные клиента</span>
                        <span className={styles.arrow}>{openSections.data ? '▲' : '▼'}</span>
                    </div>
                    {openSections.data && (
                        <div className={styles.content}>
                            <div className={styles.inputGroup}>
                                <label>ФИО</label>
                                <input type="text" name="fio" value={clientData.fio || ''} onChange={handleChange} className={styles.neonInput} />
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>Телефон</label>
                                    <input type="tel" name="phone" value={clientData.phone || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Адрес (Ключ поиска)</label>
                                    <input type="text" name="address" value={clientData.address || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Откуда узнали</label>
                                    <select name="source" value={clientData.source || ''} onChange={handleChange} className={styles.neonSelect}>
                                        <option value="">Выберите источник...</option>
                                        {sourceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>Статус</label>
                                    <select name="status" value={clientData.status || ''} onChange={handleChange} className={styles.neonSelect}>
                                        <option value="">Выберите статус...</option>
                                        {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Дата замера</label>
                                    <input type="date" name="measurementDate" value={clientData.measurementDate || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                            </div>
                            
                            <div className={styles.inputGroup}>
                                <label>Комментарий менеджера</label>
                                <textarea
                                    name="managerComment"
                                    value={clientData.managerComment || ''}
                                    onChange={handleChange}
                                    className={styles.neonInput}
                                    style={{ borderRadius: '25px', minHeight: '80px', paddingTop: '12px' }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Остальные блоки (Медиа, Платежи) остаются без изменений... */}
            </div>

            <div className={styles.stickySidebar}>
                <div className={styles.infoCard}>
                    <h3>Служебная информация</h3>
                    <p>Статус базы: <span style={{color: '#00ff00'}}>Подключено</span></p>
                    <hr className={styles.divider} />
                    <div className={styles.sidebarTotal}>
                        <span>Сумма заказа:</span>
                        <strong>{clientData.totalPrice || '0'} ₽</strong>
                    </div>
                </div>
                <div className={styles.actions}>
                    <button 
                        className={styles.saveBtn} 
                        onClick={handleFinalSave} 
                        disabled={isSaving}
                    >
                        {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
                    </button>
                    <button
                        className={styles.exitBtn}
                        onClick={() => router.push('/dashboard')}
                    >
                        ВЫЙТИ
                    </button>
                </div>
            </div>
        </div>
    );
}