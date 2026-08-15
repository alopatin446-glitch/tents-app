'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientAction } from './actions';
import { notifyError } from '@/lib/notify';
import styles from './CreateClientModal.module.css';

interface CreateClientModalProps {
  priceMap: Record<string, number>;
  onClose: () => void;
}

export default function CreateClientModal({ onClose }: CreateClientModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fio, setFio] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fio.trim()) {
      notifyError('Введите имя клиента');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createClientAction({
        fio,
        phone,
        address,
      });

      if (res.success) {
        onClose();
        router.refresh();
      } else {
        notifyError(res.error || 'Ошибка создания клиента');
      }
    } catch {
      notifyError('Ошибка сети');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>👤 НОВЫЙ КЛИЕНТ</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSubmitting}>
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label>ФИО / ИМЯ КЛИЕНТА *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Иван Иванов"
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label>ТЕЛЕФОН</label>
              <input
                type="text"
                className={styles.input}
                placeholder="+7 (999) 000-00-00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label>АДРЕС ОБЪЕКТА</label>
              <input
                type="text"
                className={styles.input}
                placeholder="г. Москва, ул. Ленина, д. 10"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <footer className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Создать'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}