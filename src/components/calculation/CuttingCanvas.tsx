'use client';

import React from 'react';
import { WindowItem } from '@/types';
import DrawingCanvas from './DrawingCanvas';

interface CuttingCanvasProps {
  windowItem: WindowItem;
}

export default function CuttingCanvas({ windowItem }: CuttingCanvasProps) {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Вызываем твой родной DrawingCanvas.
        Включаем showFasteners и showExtras, чтобы видеть и люверсы, и молнии.
      */}
      <DrawingCanvas 
        item={windowItem} 
        showFasteners={true} 
        showExtras={true} 
      />
    </div>
  );
}