'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function createClientDeal(data: any) {
  try {
    // Создаем запись в базе
    const newClient = await prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        totalPrice: data.totalPrice,
        status: data.status, // Важно: здесь должен быть ключ (например, 'negotiation')
        // Привязываем к компании (пока создадим одну дефолтную для теста)
        company: {
          connectOrCreate: {
            where: { id: 'default-id' },
            create: { id: 'default-id', name: 'Моя Компания' }
          }
        }
      }
    })

    revalidatePath('/dashboard/clients') // Обновляем страницу канбана
    return { success: true, id: newClient.id }
  } catch (error) {
    console.error("Ошибка при сохранении:", error)
    return { success: false }
  }
}