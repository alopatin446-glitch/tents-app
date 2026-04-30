'use client';

import React from 'react';
import { WindowItem } from '@/types';
import DrawingCanvas from './DrawingCanvas';

interface CuttingCanvasProps {
  windowItem: WindowItem;
  rollWidth: number;
}

export default function CuttingCanvas({ windowItem, rollWidth }: CuttingCanvasProps) {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px',
      gap: '12px',
    }}>
      <div style={{
        color: 'rgba(255,255,255,0.75)',
        fontSize: '0.8rem',
        fontWeight: 700,
      }}>
        Ширина рулона: {rollWidth} мм
      </div>

      <DrawingCanvas 
        item={windowItem} 
        showFasteners={true} 
        showExtras={true} 
      />
    </div>
  );
}