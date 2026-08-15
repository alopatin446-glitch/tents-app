'use client';

import { useState } from 'react';
import CreateClientModal from '@/app/dashboard/clients/CreateClientModal';
import { ClientProvider } from '@/app/dashboard/clients/ClientContext';
import styles from './dashboard.module.css';

interface NewClientBtnProps {
    priceMap: Record<string, number>;
}

export default function NewClientBtn({ priceMap }: NewClientBtnProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={styles.quickCard}
                style={{
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    width: '100%',
                }}
            >
                <span className={`${styles.quickIcon} ${styles.qiGreen}`}>👤</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>Новый клиент</b>
                    <small>Добавить клиента</small>
                </span>
            </button>

            {isOpen && (
                <ClientProvider initialClients={[]}>
                    <CreateClientModal
                        priceMap={priceMap}
                        onClose={() => setIsOpen(false)}
                    />
                </ClientProvider>
            )}
        </>
    );
}