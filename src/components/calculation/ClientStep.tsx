'use client';

import { useState } from 'react';
import styles from './ClientStep.module.css';

const sourceOptions = ['VK', '2Гис', 'Макс', 'Сайт', 'Авито', 'Telegram', 'Яндекс бизнес', 'Яндекс Директ', 'Повторный клиент', 'По рекомендации', 'Проезжал мимо офиса', 'Проезжал мимо цеха', 'От председателя', 'Баннер в СНТ', 'Другое'];
const statusOptions = ['Общение с клиентом', 'Ожидает замер', 'Обещал заплатить', 'Ожидает Монтаж', 'Ожидает изделия', 'Сделка успешна', 'Сделка провалена'];

export default function ClientStep({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
    const [clientData, setClientData] = useState(initialData || {});

    const [openSections, setOpenSections] = useState({
        data: false,
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

                {/* БЛОК 2: ФОТО И МАТЕРИАЛЫ */}
                <div className={styles.section}>
                    <div className={styles.header} onClick={() => toggleSection('media')}>
                        <span>Фото и материалы</span>
                        <span className={styles.arrow}>{openSections.media ? '▲' : '▼'}</span>
                    </div>
                    {openSections.media && (
                        <div className={styles.content}>
                            <div className={styles.inputGroup}>
                                <label>Фото объекта</label>
                                <input type="file" name="photoObject" className={styles.neonInput} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Фото замера</label>
                                <input type="file" name="photoMeasurement" className={styles.neonInput} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Дата монтажа</label>
                                <input type="date" name="installDate" value={clientData.installDate || ''} onChange={handleChange} className={styles.neonInput} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Комментарий инженера</label>
                                <textarea
                                    name="engineerComment"
                                    value={clientData.engineerComment || ''}
                                    onChange={handleChange}
                                    className={styles.neonInput}
                                    style={{ borderRadius: '25px', minHeight: '80px', paddingTop: '12px' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Фото Договора</label>
                                <input type="file" name="photoContract" className={styles.neonInput} />
                            </div>
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
                                <div className={styles.inputGroup}>
                                    <label>Стоимость заказа</label>
                                    <input type="number" name="totalPrice" value={clientData.totalPrice || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Аванс</label>
                                    <input type="number" name="advance" value={clientData.advance || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Остаток</label>
                                    <input type="number" name="balance" value={clientData.balance || ''} onChange={handleChange} className={styles.neonInput} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Тип оплаты</label>
                                    <select name="paymentType" value={clientData.paymentType || ''} onChange={handleChange} className={styles.neonSelect}>
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

                {/* БЛОК 4: РЕЗУЛЬТАТЫ */}
                <div className={styles.section}>
                    <div className={styles.header} onClick={() => toggleSection('results')}>
                        <span>Прибыль и расход</span>
                        <span className={styles.arrow}>{openSections.results ? '▲' : '▼'}</span>
                    </div>
                    {openSections.results && (
                        <div className={styles.content}>
                            <div className={styles.statLine}>Площадь: <strong>0 м²</strong></div>
                            <div className={styles.statLine}>Прибыль: <strong className={styles.profitText}>0 ₽</strong></div>
                        </div>
                    )}
                </div>
            </div>

            {/* САЙДБАР */}
            <div className={styles.stickySidebar}>
                <div className={styles.infoCard}>
                    <h3>Служебная информация</h3>
                    <p>Дата создания: <span>Авто</span></p>
                    <p>Дата изменения: <span>Авто</span></p>
                    <p>Создал: <span>Админ</span></p>
                    <p>Изменил: <span>Админ</span></p>
                    <hr className={styles.divider} />
                    <div className={styles.sidebarTotal}>
                        <span>Сумма заказа:</span>
                        <strong>{clientData.totalPrice || '0'} ₽</strong>
                    </div>
                </div>
                <div className={styles.actions}>
                    <button className={styles.saveBtn} onClick={() => onSave(clientData)}>СОХРАНИТЬ</button>
                    <button className={styles.exitBtn}>ВЫЙТИ</button>
                </div>
            </div>
        </div>
    );
}