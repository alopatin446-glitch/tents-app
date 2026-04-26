import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function main(): Promise<void> {
  // ── Администратор-владелец ────────────────────────────────────────────
  const existingOwnerAdmin = await prisma.user.findFirst({
    where: { isOwnerAdmin: true },
  });

  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@test.com' },
  });

  if (!existingAdmin) {
    const passwordHash = await hashPassword('admin');

    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash,
        name: 'Администратор',
        organizationName: 'Tents App',
        role: 'ADMIN',
        status: 'ACTIVE',
        isOwnerAdmin: existingOwnerAdmin ? false : true,
      },
    });
  }

  // ── Разрешения (полный список, соответствует PERMISSION_GROUPS) ────────
  const permissions = [
    // Заказы
    { key: 'orders:read',           description: 'Просмотр заказов' },
    { key: 'orders:write',          description: 'Управление заказами' },
    // Клиенты
    { key: 'clients:read',          description: 'Просмотр клиентов' },
    { key: 'clients:write',         description: 'Создание и редактирование клиентов' },
    // Расчёты
    { key: 'calculations:read',     description: 'Просмотр расчётов' },
    { key: 'calculations:write',    description: 'Создание и редактирование расчётов' },
    // Монтаж
    { key: 'mounting:read',         description: 'Просмотр монтажа' },
    { key: 'mounting:write',        description: 'Управление монтажом' },
    // Календарь
    { key: 'calendar:read',         description: 'Просмотр календаря' },
    { key: 'calendar:write',        description: 'Управление календарём' },
    // Спецификация
    { key: 'specification:read',    description: 'Просмотр спецификации' },
    { key: 'specification:write',   description: 'Редактирование спецификации' },
    // Цены
    { key: 'prices:read',           description: 'Просмотр цен' },
    { key: 'prices:write',          description: 'Редактирование цен' },
    // Архив
    { key: 'archive:read',          description: 'Просмотр архива' },
    // Настройки
    { key: 'team:manage',           description: 'Управление командой монтажников' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  console.log(`Seeded ${permissions.length} permissions.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });