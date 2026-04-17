'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './ClientCard.module.css';
import { Client } from './types';

export default function ClientCard({ client }: { client: Client }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: client.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={styles.card}
        >
            <div className={styles.cardHeader}>
                <span className={styles.clientName}>{client.name}</span>
                <div className={styles.statusDot}></div>
            </div>
            <span className={styles.address}>{client.address}</span>
            <div className={styles.cardFooter}>
                <div className={styles.priceBadge}>{client.totalPrice.toLocaleString()} ₽</div>
            </div>
        </div>
    );
}