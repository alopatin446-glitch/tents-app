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

  // ── Разрешения (полный список) ────────────────────────────────────────
  const permissions = [
    // Клиенты
    { key: 'clients:read',          description: 'Просмотр списка клиентов' },
    { key: 'clients:write',         description: 'Создание и редактирование клиентов' },
    { key: 'clients:delete',        description: 'Удаление клиентов' },
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

  // ── Цены (Справочник: Эталонные значения) ───────────────────────────
  const defaultPrices = [
    // Изделия (Розница)
    { slug: 'pvc_700', name: 'ПВХ 700 микрон', value: 750, unit: 'м2', category: 'retail_products' },
    { slug: 'pvc_500', name: 'ПВХ 500 микрон', value: 600, unit: 'м2', category: 'retail_products' },
    
    // Крепеж (Розница)
    { slug: 'eyelet_10', name: 'Люверс 10мм', value: 15, unit: 'шт', category: 'retail_fasteners' },
    { slug: 'bracket_fixed', name: 'Скоба поворотная', value: 45, unit: 'шт', category: 'retail_fasteners' },
    
    // Допы (Розница)
    { slug: 'zipper_5', name: 'Молния #5', value: 150, unit: 'пог.м', category: 'retail_addons' },
    
    // Монтаж (Розница)
    { slug: 'mont_std', name: 'Монтаж стандартный', value: 350, unit: 'м2', category: 'retail_install' },
    
    // Себестоимость (Пример)
    { slug: 'cost_pvc_700', name: 'Закупка ПВХ 700', value: 320, unit: 'м2', category: 'cost_products' },
  ];

  console.log('Заполнение справочника цен...');
  for (const price of defaultPrices) {
    await prisma.price.upsert({
      where: { slug: price.slug },
      update: {
        name: price.name,
        value: price.value,
        unit: price.unit,
        category: price.category,
      },
      create: price,
    });
  }

  console.log('Seed завершен успешно.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });