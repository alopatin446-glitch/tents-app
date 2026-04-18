'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function createClientDeal(data: any) {
  try {
    console.log("Попытка сохранения данных:", data);

    const newClient = await prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        totalPrice: Number(data.totalPrice) || 0,
        status: data.status,
        surveyDate: new Date(data.surveyDate),
        source: data.source || 'Не указан',
        managerComment: data.managerComment || '',
      }
    })

    console.log("Клиент успешно создан, ID:", newClient.id);
    
    revalidatePath('/dashboard/clients')
    return { success: true, id: newClient.id }
  } catch (error) {
    // Выводим детальную ошибку в логи сервера
    console.error("КРИТИЧЕСКАЯ ОШИБКА PRISMA:", error)
    return { success: false }
  }
}