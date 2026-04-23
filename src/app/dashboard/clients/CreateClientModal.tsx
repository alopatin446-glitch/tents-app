'use client';

import { useRouter } from 'next/navigation';
// createClientAction живёт в @/app/actions, а не в ./actions
import { createClientAction } from '@/app/actions';
import { useClients } from './ClientContext';
import ClientStep, { type ClientFormData } from '@/components/calculation/ClientStep';
import styles from './KanbanBoard.module.css';

export default function CreateClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { addClient } = useClients();

  // Сигнатура совпадает с ClientStep.onSave: (data: ClientFormData) => void | Promise<void>
  const handleFinalSave = async (formData: ClientFormData): Promise<void> => {
    try {
      const result = await createClientAction({
        fio: formData.fio,
        phone: formData.phone,
        address: formData.address,
        source: formData.source,
        totalPrice: formData.totalPrice,
        advance: formData.advance,
        status: formData.status ?? 'negotiation',
      });

      if (result.success) {
        addClient({
          id: result.id,
          fio: String(formData.fio || 'Без имени'),
          phone: String(formData.phone || ''),
          address: formData.address ? String(formData.address) : null,
          source: formData.source ? String(formData.source) : null,
          totalPrice: Number(formData.totalPrice || 0),
          advance: Number(formData.advance || 0),
          balance: Number(formData.totalPrice || 0) - Number(formData.advance || 0),
          status: (formData.status as
            | 'negotiation' | 'waiting_measure' | 'promised_pay'
            | 'waiting_production' | 'waiting_install' | 'special_case'
            | 'completed' | 'rejected') || 'negotiation',
          createdAt: new Date().toISOString(),
          paymentType: formData.paymentType ? String(formData.paymentType) : null,
          managerComment: formData.managerComment ? String(formData.managerComment) : null,
          engineerComment: formData.engineerComment ? String(formData.engineerComment) : null,
        });
        onClose();
        router.refresh();
      } else {
        alert(result.error || 'Ошибка при сохранении карточки');
      }
    } catch (err) {
      console.error('[CreateClientModal] Ошибка:', err);
      alert('Ошибка при сохранении карточки');
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.editModal}
        style={{ width: '1000px', maxWidth: '95vw', height: '90vh', overflowY: 'auto', padding: '0', background: '#0a0a0a' }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,243,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#00f3ff', margin: 0, fontSize: '1.2rem' }}>НОВЫЙ ЗАКАЗ / КЛИЕНТ</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>
        <ClientStep
          initialData={{ status: 'negotiation' }}
          onSave={handleFinalSave}
          onClose={onClose}
        />
      </div>
    </div>
  );
}