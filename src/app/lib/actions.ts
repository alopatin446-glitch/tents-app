export async function createClientDeal(data: any) {
  try {
    // Создаем запись в базе без лишних связей
    const newClient = await prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        totalPrice: data.totalPrice,
        status: data.status,
        surveyDate: new Date(data.surveyDate), // Убедимся, что это объект Date
        source: data.source || 'Не указан',
        managerComment: data.managerComment || '',
      }
    })

    revalidatePath('/dashboard/clients') // Обновляем страницу канбана
    return { success: true, id: newClient.id }
  } catch (error) {
    console.error("Ошибка при сохранении:", error)
    return { success: false }
  }
}