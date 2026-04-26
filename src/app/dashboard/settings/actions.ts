'use server';

/**
 * Server Actions для управления профилем и командой.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAuth, requireRole } from '@/lib/auth/requireAuth';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { hashSessionToken } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import type { UserRole } from '@prisma/client';

// ИСПРАВЛЕННЫЙ ИМПОРТ: Импортируем конкретные функции из сервиса
import { 
  ensureTeamMemberForEngineer, 
  setTeamMemberStatusByUserId 
} from '@/lib/services/teamMemberService';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

const VALID_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'ENGINEER'];
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function isValidRole(value: string): value is UserRole {
  return VALID_ROLES.includes(value as UserRole);
}

// ---------------------------------------------------------------------------
// PART 1 — ПРОФИЛЬ
// ---------------------------------------------------------------------------

export type UpdateProfilePayload = {
  name: string;
  phone: string;
  telegramId: string;
};

export type UpdateProfileResult =
  | { success: true }
  | { success: false; error: string };

export async function updateUserProfileAction(
  data: UpdateProfilePayload
): Promise<UpdateProfileResult> {
  try {
    const user = await requireAuth();

    const name = data.name.trim();
    if (!name) {
      return { success: false, error: 'Имя не может быть пустым' };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        name, 
        phone: data.phone.trim() || null, 
        telegramId: data.telegramId.trim() || null 
      },
    });

    // Синхронизация имени, если это инженер
    if ((updatedUser.role as string) === 'ENGINEER') {
      await ensureTeamMemberForEngineer(updatedUser.id, updatedUser.name);
    }

    revalidatePath('/dashboard/settings/profile');
    return { success: true };
  } catch (error) {
    logger.error('[updateUserProfileAction] Ошибка', error);
    return { success: false, error: 'Не удалось обновить профиль' };
  }
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    if (!user.isOwnerAdmin) return { success: false, error: 'Недостаточно прав' };
    if (!newPassword || newPassword.length < 6) return { success: false, error: 'Пароль слишком короткий' };

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { success: false, error: 'Неверный текущий пароль' };

    const newHash = await hashPassword(newPassword);
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const currentTokenHash = currentToken ? hashSessionToken(currentToken) : null;

    await prisma.session.deleteMany({
      where: { 
        userId: user.id, 
        ...(currentTokenHash ? { NOT: { tokenHash: currentTokenHash } } : {}) 
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    return { success: true };
  } catch (error) {
    logger.error('[changePasswordAction] Ошибка', error);
    return { success: false, error: 'Ошибка смены пароля' };
  }
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    const user = await requireAuth();
    const file = formData.get('avatar') as File;
    if (!file) return { success: false, error: 'Файл не найден' };

    const safeFilename = `${randomBytes(16).toString('hex')}${extname(file.name) || '.jpg'}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, safeFilename), Buffer.from(await file.arrayBuffer()));

    const avatarUrl = `/uploads/avatars/${safeFilename}`;
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    revalidatePath('/dashboard/settings/profile');
    return { success: true, avatarUrl };
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки аватара' };
  }
}

// ---------------------------------------------------------------------------
// PART 2 — КОМАНДА (ADMIN ONLY)
// ---------------------------------------------------------------------------

export async function createEmployeeAction(
  data: any
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const currentUser = await requireRole(['ADMIN']);
    const { name, email, password, role } = data;

    if (role === 'ADMIN' && !currentUser.isOwnerAdmin) return { success: false, error: 'Только владелец создает админов' };

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: { 
        email: email.toLowerCase(), 
        passwordHash, 
        name, 
        role: role as UserRole, 
        status: 'ACTIVE', 
        isOwnerAdmin: false 
      },
    });

    if ((role as string) === 'ENGINEER') {
      await ensureTeamMemberForEngineer(newUser.id, newUser.name);
    }

    revalidatePath('/dashboard/settings/team');
    return { success: true, userId: newUser.id };
  } catch (error) {
    return { success: false, error: 'Ошибка при создании сотрудника' };
  }
}

export async function updateEmployeeAction(
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole(['ADMIN']);
    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target || (target.isOwnerAdmin && !currentUser.isOwnerAdmin)) return { success: false, error: 'Отказ в доступе' };

    const prevRole = target.role;
    const newRole = data.role as UserRole;

    const updatedUser = await prisma.user.update({
      where: { id: data.userId },
      data: { name: data.name, role: newRole },
    });

    if ((newRole as string) === 'ENGINEER') {
      await ensureTeamMemberForEngineer(updatedUser.id, updatedUser.name);
      await setTeamMemberStatusByUserId(updatedUser.id, 'active');
    } else if ((prevRole as string) === 'ENGINEER' && (newRole as string) !== 'ENGINEER') {
      await setTeamMemberStatusByUserId(updatedUser.id, 'inactive');
    }

    revalidatePath('/dashboard/settings/team');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ошибка обновления' };
  }
}

export async function toggleUserStatusAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole(['ADMIN']);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.isOwnerAdmin) return { success: false, error: 'Нельзя изменить статус' };

    const newStatus = target.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    if ((updatedUser.role as string) === 'ENGINEER') {
      const memberStatus = updatedUser.status === 'ACTIVE' ? 'active' : 'inactive';
      await setTeamMemberStatusByUserId(updatedUser.id, memberStatus);
    }

    if (newStatus === 'BLOCKED') {
      await prisma.session.deleteMany({ where: { userId } });
    }

    revalidatePath('/dashboard/settings/team');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ошибка смены статуса' };
  }
}

// ---------------------------------------------------------------------------

export async function updateUserPermissionsAction(
  userId: string,
  permissionKeys: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['ADMIN']);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.role === 'ADMIN') return { success: false, error: 'Запрещено' };

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    await prisma.userPermission.deleteMany({ where: { userId } });
    if (permissions.length > 0) {
      await prisma.userPermission.createMany({
        data: permissions.map((p) => ({ userId, permissionId: p.id })),
      });
    }

    revalidatePath('/dashboard/settings/team');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ошибка разрешений' };
  }
}

export async function resetEmployeePasswordAction(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['ADMIN']);
    if (newPassword.length < 6) return { success: false, error: 'Короткий пароль' };
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    await prisma.session.deleteMany({ where: { userId } });
    revalidatePath('/dashboard/settings/team');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ошибка сброса' };
  }
}

export async function transferOwnerAdminAction(
  newOwnerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    if (!currentUser.isOwnerAdmin || newOwnerId === currentUser.id) return { success: false, error: 'Отказ' };

    const target = await prisma.user.findUnique({ where: { id: newOwnerId } });
    if (!target || target.role !== 'ADMIN') return { success: false, error: 'Цель должна быть админом' };

    await prisma.$transaction([
      prisma.user.update({ where: { id: currentUser.id }, data: { isOwnerAdmin: false } }),
      prisma.user.update({ where: { id: newOwnerId }, data: { isOwnerAdmin: true } }),
    ]);

    revalidatePath('/dashboard/settings/team');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Ошибка передачи прав' };
  }
}