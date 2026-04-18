'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// 1. ПОЛУЧЕНИЕ КЛИЕНТА ПО ID (Для "умной" загрузки формы)
export async function getClientById(id: string) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: id },
    });
    if (!client) return { success: false, error: 'Клиент не найден' };
    return { success: true, data: client };
  } catch (error: any) {
    console.error('Ошибка getClientById:', error);
    return { success: false, error: 'Не удалось загрузить данные из базы' };
  }
}

// 2. ОБНОВЛЕНИЕ КЛИЕНТА (Чтобы не плодить дубликаты)
export async function updateClientDeal(id: string, data: any) {
  console.log('--- СЕРВЕР: ОБНОВЛЕНИЕ ДАННЫХ ---', id);
  try {
    const cleanData = {
      fio: String(data.fio || 'Без имени'),
      phone: String(data.phone || ''),
      address: String(data.address || ''),
      source: String(data.source || ''),
      status: String(data.status || 'special_case'),
      totalPrice: Number(data.totalPrice) || 0,
      advance: Number(data.advance) || 0,
      balance: Number(data.balance) || 0,
      paymentType: String(data.paymentType || ''),
      managerComment: String(data.managerComment || ''),
      engineerComment: String(data.engineerComment || ''),
      measurementDate: data.measurementDate ? new Date(data.measurementDate) : null,
      installDate: data.installDate ? new Date(data.installDate) : null,
    };

    const updatedClient = await prisma.client.update({
      where: { id: id },
      data: cleanData,
    });

    revalidatePath('/dashboard/clients');
    return { success: true, id: updatedClient.id };
  } catch (error: any) {
    console.error('Ошибка updateClientDeal:', error);
    return { success: false, error: 'Ошибка при обновлении записи' };
  }
}

// 3. СОЗДАНИЕ КЛИЕНТА (Твой старый код)
export async function createClientDeal(data: any) {
  console.log('--- СЕРВЕР: ПОЛУЧЕНЫ ДАННЫЕ (NEW) ---', data);
  try {
    const cleanData = {
      fio: String(data.fio || 'Без имени'),
      phone: String(data.phone || ''),
      address: String(data.address || ''),
      source: String(data.source || ''),
      status: String(data.status || 'special_case'),
      totalPrice: Number(data.totalPrice) || 0,
      advance: Number(data.advance) || 0,
      balance: Number(data.balance) || 0,
      paymentType: String(data.paymentType || ''),
      managerComment: String(data.managerComment || ''),
      engineerComment: String(data.engineerComment || ''),
      measurementDate: data.measurementDate ? new Date(data.measurementDate) : null,
      installDate: data.installDate ? new Date(data.installDate) : null,
    };

    const newClient = await prisma.client.create({ data: cleanData });
    revalidatePath('/dashboard/clients');
    return { success: true, id: newClient.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}