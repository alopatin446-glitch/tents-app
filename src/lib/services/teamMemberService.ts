/**
 * Сервис получения активных членов монтажной бригады.
 *
 * SSOT-правило:
 *   1. Если в таблице TeamMember есть хотя бы одна запись → используем только активные из БД.
 *   2. Если таблица пуста → fallback на статический TEAM_MEMBERS из pricing.ts.
 *   3. Если в таблице есть записи, но ВСЕ неактивны → возвращаем пустой список (НЕ fallback).
 *
 * Логика sync с User.role:
 *   - ensureTeamMemberForEngineer(userId, name) — вызывать при создании ENGINEER.
 *   - setTeamMemberStatusByUserId(userId, 'inactive') — вызывать при блокировке ENGINEER.
 *   - setTeamMemberStatusByUserId(userId, 'active')   — вызывать при разблокировке ENGINEER.
 *   Записи НИКОГДА не удаляются — только меняется status.
 *
 * @module src/lib/services/teamMemberService.ts
 */

import { prisma } from '@/lib/prisma';
import { TEAM_MEMBERS, type TeamMemberConfig } from '@/constants/pricing';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные типы и константы
// ─────────────────────────────────────────────────────────────────────────────

type TeamCategory = 'pro' | 'mid' | 'junior';

const VALID_CATEGORIES: readonly TeamCategory[] = ['pro', 'mid', 'junior'] as const;

const DEFAULT_CATEGORY: TeamCategory = 'mid';
const DEFAULT_COLOR = '#7BFF00';

// ─────────────────────────────────────────────────────────────────────────────
// Адаптер (маппер DB → TeamMemberConfig)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Приводит строковое значение category из БД к строго типизированному TeamCategory.
 * Если значение не входит в допустимые → mid как безопасный дефолт.
 */
function toTeamCategory(raw: string): TeamCategory {
  return VALID_CATEGORIES.includes(raw as TeamCategory)
    ? (raw as TeamCategory)
    : DEFAULT_CATEGORY;
}

/**
 * Маппер: запись из таблицы TeamMember → TeamMemberConfig (формат pricing.ts).
 * Это единственное место адаптации — нигде больше не дублировать.
 */
function mapDbRecordToConfig(record: {
  id: string;
  name: string;
  category: string;
  color: string;
}): TeamMemberConfig {
  return {
    id: record.id,
    name: record.name,
    category: toTeamCategory(record.category),
    color: record.color || DEFAULT_COLOR,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Публичный API сервиса
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Возвращает список активных монтажников в формате TeamMemberConfig.
 *
 * Алгоритм (fallback STRICT):
 *   1. Получаем все записи TeamMember из БД.
 *   2. Если записей нет вообще → fallback на TEAM_MEMBERS (статика).
 *   3. Если записи есть, но все status !== 'active' → пустой массив (не fallback!).
 *   4. Если есть активные → возвращаем только их.
 *
 * Ошибки БД: НЕ скрываются, логируются и пробрасываются наверх.
 */
export async function getActiveTeamMembers(): Promise<TeamMemberConfig[]> {
  try {
    const allRecords = await prisma.teamMember.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // УДАЛЯЕМ ПРОВЕРКУ НА allRecords.length === 0 СО СТАТИКОЙ

    // Оставляем только фильтрацию по активным
    const activeRecords = allRecords.filter((r) => r.status === 'active');

    if (activeRecords.length === 0) {
      logger.info('[teamMemberService] Активные монтажники не найдены');
      return []; // Возвращаем пустой массив, а не статику!
    }

    logger.info('[teamMemberService] Загружено из БД', { count: activeRecords.length });
    return activeRecords.map(mapDbRecordToConfig);
  } catch (error) {
    logger.error('[teamMemberService] Ошибка получения монтажников', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync-операции: ENGINEER ↔ TeamMember
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Создаёт TeamMember для пользователя с ролью ENGINEER, если запись ещё не существует.
 * Вызывать при создании / повышении пользователя до роли ENGINEER.
 *
 * Категория по умолчанию: 'mid'. Цвет по умолчанию: '#7BFF00'.
 * Позже управляется через интерфейс настроек бригады.
 *
 * @param userId - ID пользователя из таблицы User
 * @param name   - Имя (берётся из User.name)
 */
export async function ensureTeamMemberForEngineer(
  userId: string,
  name: string,
): Promise<void> {
  try {
    const existing = await prisma.teamMember.findUnique({
      where: { userId },
    });

    if (existing) {
      // Уже существует — убеждаемся, что активна
      if (existing.status !== 'active') {
        await prisma.teamMember.update({
          where: { userId },
          data: { status: 'active', name },
        });
        logger.info('[teamMemberService] TeamMember переведён в active', { userId });
      }
      return;
    }

    await prisma.teamMember.create({
      data: {
        organizationId: 'default_org_id', // <--- ДОБАВЬ ЭТО
        name,
        category: DEFAULT_CATEGORY,
        color: DEFAULT_COLOR,
        status: 'ACTIVE',
        userId: userId,
      },
    });

    logger.info('[teamMemberService] TeamMember создан для инженера', { userId, name });
  } catch (error) {
    logger.error('[teamMemberService] Ошибка ensureTeamMemberForEngineer', { userId, error });
    throw error;
  }
}

/**
 * Обновляет статус TeamMember, привязанного к пользователю.
 * Если запись не существует — ничего не делает (not an error).
 *
 * НИКОГДА не удаляет запись — только меняет status.
 *
 * @param userId - ID пользователя
 * @param status - 'active' | 'inactive'
 */
export async function setTeamMemberStatusByUserId(
  userId: string,
  status: 'active' | 'inactive',
): Promise<void> {
  try {
    const member = await prisma.teamMember.findUnique({
      where: { userId },
    });

    if (!member) {
      logger.info('[teamMemberService] TeamMember не найден для пользователя — пропускаем', { userId });
      return;
    }

    await prisma.teamMember.update({
      where: { userId },
      data: { status },
    });

    logger.info('[teamMemberService] Статус TeamMember обновлён', { userId, status });
  } catch (error) {
    logger.error('[teamMemberService] Ошибка setTeamMemberStatusByUserId', { userId, status, error });
    throw error;
  }
}