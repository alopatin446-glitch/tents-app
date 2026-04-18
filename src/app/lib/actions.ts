'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function createClientDeal(data: any) {
  try {
    const newClient = await prisma.client.create({
      data: {
        fio: data.fio || 'Без имени',
        phone: data.phone || '',
        address: data.address || '',
        source: data.source || '',
        status: data.status || 'negotiation',
        
        // Преобразуем строки в числа для базы
        totalPrice: parseFloat(data.totalPrice) || 0,
        advance: parseFloat(data.advance) || 0,
        balance: parseFloat(data.balance) || 0,
        paymentType: data.paymentType || '',

        // Преобразуем строки дат в объекты Date для Prisma
        measurementDate: data.measurementDate ? new Date(data.measurementDate) : null,
        installDate: data.installDate ? new Date(data.installDate) : null,

        managerComment: data.managerComment || '',
        engineerComment: data.engineerComment || '',
      },
    });

    revalidatePath('/dashboard/clients'); // Обновим кэш страницы, чтобы клиент сразу появился
    return { success: true, id: newClient.id };
  } catch (error: any) {
    console.error('Ошибка при создании клиента:', error);
    return { success: false, error: error.message };
  }
}