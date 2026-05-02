'use client';

import { useRouter } from 'next/navigation';
import { updateClientAction } from './actions';
import styles from './KanbanBoard.module.css';
import ClientStep, {
  type ClientFormData,
  type ClientStepWindowItem,
} from '@/components/calculation/ClientStep';
import { useClients } from './ClientContext';
import { toFinancialNumber, calculateClientBalance } from '@/lib/logic/financialCalculations';
import { type ClientStatus } from '@/lib/logic/statusDictionary';
import { notifyError, notifySuccess } from '@/lib/notify';

interface EditModalClient {
  id: string;
  fio?: string | null;
  name?: string | null;
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

interface EditModalProps {
  client: EditModalClient;
  onClose: () => void;
  // Добавляем обязательный пропс согласно требованию ClientStep
  priceMap: Record<string, number>;
}

export default function EditModal({ client, onClose, priceMap }: EditModalProps) {
  const router = useRouter();
  const { updateClient } = useClients();

  const handleUpdate = async (updatedData: ClientFormData): Promise<void> => {
    const nextTotalPrice = toFinancialNumber(
      updatedData.totalPrice,
      toFinancialNumber(client.totalPrice as string | number | null | undefined, 0)
    );
    const nextAdvance = toFinancialNumber(
      updatedData.advance,
      toFinancialNumber(client.advance as string | number | null | undefined, 0)
    );

    const hasExplicitBalance =
      updatedData.balance !== undefined &&
      updatedData.balance !== null &&
      String(updatedData.balance).trim() !== '';

    const nextBalance = hasExplicitBalance
      ? toFinancialNumber(updatedData.balance, 0)
      : calculateClientBalance(nextTotalPrice, nextAdvance);

    const dataToSave = {
      fio: updatedData.fio ?? client.fio ?? '',
      phone: updatedData.phone ?? client.phone ?? '',
      address: updatedData.address ?? client.address ?? null,
      source: updatedData.source ?? client.source ?? null,
      status: updatedData.status ?? client.status ?? 'special_case',
      totalPrice: nextTotalPrice,
      advance: nextAdvance,
      balance: nextBalance,
      managerComment: updatedData.managerComment ?? client.managerComment ?? null,
      engineerComment: updatedData.engineerComment ?? client.engineerComment ?? null,
      paymentType: updatedData.paymentType ?? client.paymentType ?? null,
      measurementDate: updatedData.measurementDate ?? client.measurementDate ?? null,
      installDate: updatedData.installDate ?? client.installDate ?? null,
      items: updatedData.items ?? client.items ?? null,
    };

    const result = await updateClientAction(client.id, dataToSave);

    if (result.success) {
      const nextStatus = String(dataToSave.status || 'special_case') as ClientStatus;
      updateClient(String(client.id), {
        fio: String(dataToSave.fio || ''),
        phone: String(dataToSave.phone || ''),
        address: dataToSave.address ? String(dataToSave.address) : null,
        totalPrice: nextTotalPrice,
        advance: nextAdvance,
        balance: nextBalance,
        status: nextStatus,
      });
      notifySuccess('Данные клиента обновлены');
      onClose();
      router.refresh();
    } else {
      notifyError('Ошибка при сохранении: ' + result.error);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.editModal}
        style={{ 
          width: '1200px', 
          maxWidth: '95vw', 
          height: '95vh', 
          overflowY: 'auto', 
          padding: '20px', 
          background: '#182234', 
          borderRadius: '16px', 
          position: 'relative' 
        }}
      >
        <div style={{ 
          padding: '10px 0', 
          borderBottom: '1px solid rgba(123, 255, 0, 0.2)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ color: '#7BFF00', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>
            Редактирование: {client.fio || client.name}
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}
          >
            ×
          </button>
        </div>
        
        {/* ОШИБКА ИСПРАВЛЕНА: Пробрасываем priceMap в ядро расчетов */}
        <ClientStep
          initialData={client}
          onSave={handleUpdate}
          onClose={onClose}
          priceMap={priceMap}
        />
      </div>
    </div>
  );
}