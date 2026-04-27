import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

// Константа для ID нашей основной организации
const DEFAULT_ORG_ID = 'default_org_id';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function main(): Promise<void> {
  console.log('Начало инициализации базы данных...');

  // ── 0. Создаем или находим базовую организацию ────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: { name: 'Tents App (Главный Офис)' },
    create: {
      id: DEFAULT_ORG_ID,
      name: 'Tents App (Главный Офис)',
    },
  });
  console.log('Организация готова.');

  // ── 1. Администратор-владелец ────────────────────────────────────────────
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
        role: 'ADMIN',
        status: 'ACTIVE',
        isOwnerAdmin: existingOwnerAdmin ? false : true,
        organizationId: org.id, // Привязываем к организации
      },
    });
    console.log('Аккаунт администратора создан.');
  }

  // ── 2. Разрешения ────────────────────────────────────────────────────────
  const permissions = [
    { key: 'clients:read',      description: 'Просмотр списка клиентов' },
    { key: 'clients:write',     description: 'Создание и редактирование клиентов' },
    { key: 'clients:delete',    description: 'Удаление клиентов' },
    { key: 'calculations:read',  description: 'Просмотр расчётов' },
    { key: 'calculations:write', description: 'Создание и редактирование расчётов' },
    { key: 'mounting:read',     description: 'Просмотр монтажа' },
    { key: 'mounting:write',    description: 'Управление монтажом' },
    { key: 'calendar:read',     description: 'Просмотр календаря' },
    { key: 'calendar:write',    description: 'Управление календарём' },
    { key: 'specification:read', description: 'Просмотр спецификации' },
    { key: 'specification:write', description: 'Редактирование спецификации' },
    { key: 'prices:read',       description: 'Просмотр цен' },
    { key: 'prices:write',      description: 'Редактирование цен' },
    { key: 'archive:read',      description: 'Просмотр архива' },
    { key: 'team:manage',       description: 'Управление командой монтажников' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.log('Разрешения обновлены.');

  // ── 3. Цены (Справочник: Эталонные значения) ───────────────────────────
  const defaultPrices = [
    { slug: 'pvc_700', name: 'ПВХ 700 микрон', value: 750, unit: 'м2', category: 'retail_products' },
    { slug: 'pvc_500', name: 'ПВХ 500 микрон', value: 600, unit: 'м2', category: 'retail_products' },
    { slug: 'eyelet_10', name: 'Люверс 10мм', value: 15, unit: 'шт', category: 'retail_fasteners' },
    { slug: 'bracket_fixed', name: 'Скоба поворотная', value: 45, unit: 'шт', category: 'retail_fasteners' },
    { slug: 'zipper_5', name: 'Молния #5', value: 150, unit: 'пог.м', category: 'retail_addons' },
    { slug: 'mont_std', name: 'Монтаж стандартный', value: 350, unit: 'м2', category: 'retail_install' },
    { slug: 'cost_pvc_700', name: 'Закупка ПВХ 700', value: 320, unit: 'м2', category: 'cost_products' },
  ];

  console.log('Заполнение справочника цен...');
  for (const price of defaultPrices) {
    await prisma.price.upsert({
      // Теперь уникальный ключ составной: slug + organizationId
      where: {
        slug_organizationId: {
          slug: price.slug,
          organizationId: org.id,
        }
      },
      update: {
        name: price.name,
        value: price.value,
        unit: price.unit,
        category: price.category,
      },
      create: {
        ...price,
        organizationId: org.id,
      },
    });
  }

  console.log('Seed завершен успешно.');
}

main()
  .catch((e) => {
    console.error('Ошибка при выполнении seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });