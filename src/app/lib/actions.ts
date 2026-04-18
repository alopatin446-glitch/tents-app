'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function createClientDeal(data: any) {
  console.log('--- СЕРВЕР: ПОЛУЧЕНЫ ДАННЫЕ ---', data);
  
  try {
    // 1. Подготавливаем данные, исключая пустые даты и NaN
    const cleanData = {
      fio: String(data.fio || 'Без имени'),
      phone: String(data.phone || ''),
      address: String(data.address || ''),
      source: String(data.source || ''),
      status: String(data.status || 'special_case'), // По умолчанию в Особый случай
      totalPrice: Number(data.totalPrice) || 0,
      advance: Number(data.advance) || 0,
      balance: Number(data.balance) || 0,
      paymentType: String(data.paymentType || ''),
      managerComment: String(data.managerComment || ''),
      engineerComment: String(data.engineerComment || ''),
      // Даты обрабатываем отдельно
      measurementDate: data.measurementDate ? new Date(data.measurementDate) : null,
      installDate: data.installDate ? new Date(data.installDate) : null,
    };

    // 2. Сама запись в базу
    const newClient = await prisma.client.create({
      data: cleanData
    });

    console.log('--- СЕРВЕР: ЗАПИСЬ УСПЕШНА ---', newClient.id);

    // 3. Сброс кэша
    revalidatePath('/dashboard/clients');
    
    return { success: true, id: newClient.id };

  } catch (error: any) {
    console.error('--- СЕРВЕР: ОШИБКА ПРИЗМЫ ---');
    console.error(error); // Это вылетит в терминал VS Code
    return { 
      success: false, 
      error: error.message || 'Ошибка на стороне сервера базы данных' 
    };
  }
}