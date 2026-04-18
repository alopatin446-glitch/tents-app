'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function createClientDeal(data: any) {
  try {
    console.log("Входящие данные формы:", data);

    // Безопасная обработка даты
    // Если дата пустая или некорректная, ставим текущий момент
    const rawDate = data.surveyDate;
    const parsedDate = new Date(rawDate);
    const finalDate = (rawDate && !isNaN(parsedDate.getTime())) 
      ? parsedDate 
      : new Date();

    const newClient = await prisma.client.create({
      data: {
        name: data.name || 'Без имени',
        phone: data.phone || 'Нет телефона',
        address: data.address || 'Адрес не указан',
        totalPrice: Number(data.totalPrice) || 0,
        status: data.status || 'new',
        surveyDate: finalDate, // Теперь здесь всегда валидный объект Date
        source: data.source || 'Не указан',
        managerComment: data.managerComment || '',
      }
    })

    console.log("Успех! Клиент в базе, ID:", newClient.id);
    
    revalidatePath('/dashboard/clients')
    return { success: true, id: newClient.id }
  } catch (error: any) {
    // Выводим максимум информации в логи Vercel
    console.error("КРИТИЧЕСКАЯ ОШИБКА PRISMA:", {
      message: error.message,
      code: error.code,
      meta: error.meta
    })
    return { success: false, error: error.message }
  }
}