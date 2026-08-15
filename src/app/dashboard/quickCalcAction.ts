'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function createQuickOrderAction(data: {
  totalPrice: number;
  windows: any[];
}) {
  const user = await requireAuth();

  // Генерируем "рыбу" изделий СТРОГО по интерфейсу WindowItem
  const itemsArray = data.windows.map((w: any, index: number) => {
    // 1. Уникальный числовой ID (как того требует typeof obj['id'] === 'number')
    const id = Date.now() + index; 

    // Раскидываем молнии по изделию, если они есть
    const zippers = Array.from({ length: Number(w.zippers) }).map((_, zIdx) => ({
      id: `z_${Date.now()}_${zIdx}`,
      orientation: 'vertical',
      positionFromStart: 10 + (zIdx * 50),
      offsetStart: 0,
      offsetEnd: 0,
      bandLeft: 0,
      bandRight: 0,
    }));

    // Идеальный объект WindowItem
    return {
      id: id,
      name: `Проём ${index + 1} (Быстрый)`,
      material: w.material,
      widthTop: w.width,
      widthBottom: w.width,
      heightLeft: w.height,
      heightRight: w.height,
      kantTop: 5,
      kantRight: 5,
      kantBottom: 5,
      kantLeft: 5,
      kantColor: 'Коричневый', // Строка, как требует валидатор
      isTrapezoid: false,
      diagonalLeft: 0,  // строго числа (0)
      diagonalRight: 0, // строго числа (0)
      crossbar: 0,      // строго числа (0)
      fasteners: {
        type: w.fastener,
        sides: { top: 'default', right: true, bottom: true, left: true }, 
        finish: null,
        priceRetail: 0,
        priceCost: 0,
      },
      additionalElements: {
        straps: { count: 0, isManual: false, type: 'grommet' },
        zippers: zippers,
        dividers: [],
        cutouts: [],
        welding: [],
        hasSkirt: false,
        skirtWidth: 0,
        hasWeight: w.weight,
      }
    };
  });

  // Создаем клиента в базе
  const client = await prisma.client.create({
    data: {
      organizationId: user.organizationId,
      fio: `Быстрый расчет на ${data.totalPrice.toLocaleString('ru-RU')} ₽`,
      phone: '',
      status: 'negotiation', 
      totalPrice: data.totalPrice,
      items: JSON.stringify(itemsArray), // Упаковываем валидный массив
      createdById: user.id,
      createdByName: user.name,
    }
  });

  return client.id;
}