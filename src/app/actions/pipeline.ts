'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { STATUS_DEFINITIONS } from '@/lib/logic/statusDictionary';
import { logger } from '@/lib/logger';

// 🎨 Дефолтные неоновые цвета для твоих старых колонок
const DEFAULT_COLORS: Record<string, string> = {
  'negotiation': '#00d2ff',       // Голубой
  'waiting_measure': '#ff007f',   // Розовый/Малиновый
  'promised_pay': '#ffd166',      // Желтый
  'waiting_production': '#a3ff00',// Салатовый
  'waiting_install': '#bc00ff',   // Пурпурный
  'special_case': '#ff4d4d',      // Красный
  'completed': '#00ff00',         // Зеленый (Архив)
  'rejected': '#444444',          // Серый (Архив)
};

/**
 * Получает все стадии (колонки) для организации текущего пользователя.
 * Если колонок нет — автоматически создаёт их из старого хардкод-словаря.
 */
export async function getPipelineStages() {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    // 1. Ищем существующие колонки в базе
    let stages = await prisma.pipelineStage.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' },
    });

    // 2. БЕСШОВНАЯ МИГРАЦИЯ: Если колонок нет -> создаем их из старого словаря
    if (stages.length === 0) {
      logger.info('[getPipelineStages] Создаем базовые колонки для организации', { orgId });

      const newStagesData = STATUS_DEFINITIONS.map((def) => ({
        id: def.id, // 🔥 МАГИЯ: мы сохраняем старые строковые ID, чтобы старые клиенты не потерялись!
        organizationId: orgId,
        name: def.label,
        color: DEFAULT_COLORS[def.id] || '#7BFF00',
        order: def.kanbanOrder ?? 99,
        isSystem: true, // Базовые колонки удалять нельзя, чтобы не сломать легаси-логику
        isArchive: def.group === 'terminal', // 'completed' и 'rejected' сразу помечаем как архивные
      }));

      await prisma.pipelineStage.createMany({
        data: newStagesData,
        skipDuplicates: true,
      });

      // Сразу же вытаскиваем только что созданные колонки
      stages = await prisma.pipelineStage.findMany({
        where: { organizationId: orgId },
        orderBy: { order: 'asc' },
      });
    }

    return { success: true, data: stages };
  } catch (error) {
    logger.error('[getPipelineStages] Ошибка загрузки колонок', error);
    return { success: false, error: 'Не удалось загрузить колонки канбана' };
  }
}

/**
 * Создаёт новую колонку (стадию) для организации текущего пользователя.
 */
export async function createPipelineStage(name: string, color: string = '#7BFF00') {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Название стадии не может быть пустым' };
    }

    // Узнаем текущий максимальный порядок order, чтобы поставить новую колонку в конец доски
    const lastStage = await prisma.pipelineStage.findFirst({
      where: { organizationId: orgId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = (lastStage?.order ?? 0) + 1;

    const newStage = await prisma.pipelineStage.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        color,
        order: nextOrder,
        isSystem: false, // Пользовательские колонки можно будет удалять
        isArchive: false, // По умолчанию колонка попадает на активную доску
      },
    });

    return { success: true, data: newStage };
  } catch (error) {
    logger.error('[createPipelineStage] Ошибка создания стадии', error);
    return { success: false, error: 'Не удалось создать новую стадию' };
  }
}

/**
 * 🔥 НОВОЕ: Обновляет название и цвет существующей колонки.
 */
export async function updatePipelineStage(id: string, name: string, color: string) {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Название стадии не может быть пустым' };
    }

    // Проверяем права на эту колонку
    const existing = await prisma.pipelineStage.findFirst({
      where: { id: id, organizationId: orgId },
    });

    if (!existing) {
      return { success: false, error: 'Стадия не найдена' };
    }

    const updatedStage = await prisma.pipelineStage.update({
      where: { id },
      data: {
        name: name.trim(),
        color,
      },
    });

    return { success: true, data: updatedStage };
  } catch (error) {
    logger.error('[updatePipelineStage] Ошибка обновления стадии', error);
    return { success: false, error: 'Не удалось обновить стадию' };
  }
}

/**
 * 🔥 НОВОЕ: Удаляет колонку (со встроенной защитой от потери клиентов).
 */
export async function deletePipelineStage(id: string) {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: id, organizationId: orgId },
    });

    if (!stage) {
      return { success: false, error: 'Стадия не найдена' };
    }

    // Защита №1: Нельзя удалять системные колонки
    if (stage.isSystem) {
      return { success: false, error: 'Базовые (системные) стадии удалять нельзя' };
    }

    // Защита №2: Нельзя удалять колонку, если в ней есть клиенты
    const clientsCount = await prisma.client.count({
      where: {
        organizationId: orgId,
        status: id,
      },
    });

    if (clientsCount > 0) {
      return { 
        success: false, 
        error: `Нельзя удалить стадию. В ней находятся карточки клиентов (${clientsCount} шт.). Перенесите их в другую колонку перед удалением.` 
      };
    }

    await prisma.pipelineStage.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    logger.error('[deletePipelineStage] Ошибка удаления стадии', error);
    return { success: false, error: 'Не удалось удалить стадию' };
  }
}