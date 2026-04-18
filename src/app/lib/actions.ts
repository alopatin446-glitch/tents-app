'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function createClientDeal(data: any) {
  try {
    const newClient = await prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        totalPrice: Number(data.totalPrice) || 0, // Приводим к числу на всякий случай
        status: data.status,
        surveyDate: new Date(data.surveyDate),
        source: data.source || 'Не указан',
        managerComment: data.managerComment || '',
      }
    })

    revalidatePath('/dashboard/clients')
    return { success: true, id: newClient.id }
  } catch (error) {
    console.error("Ошибка при сохранении в базу:", error)
    return { success: false }
  }
}