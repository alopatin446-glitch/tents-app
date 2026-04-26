import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import ProfileClient from './ProfileClient';

/**
 * Серверная страница профиля.
 * Загружает данные текущего пользователя и передает их в клиентский компонент.
 */
export default async function ProfilePage() {
  // 1. Получаем текущего пользователя из сессии
  const user = await getCurrentUser();

  // 2. Если пользователь не найден (сессия протухла) — на логин
  if (!user) {
    redirect('/login');
  }

  // 3. Формируем объект данных для клиента
  // Превращаем данные из БД в формат, который ждет ProfileClient
  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    telegramId: user.telegramId,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isOwnerAdmin: user.isOwnerAdmin,
  };

  return <ProfileClient user={userData} />;
}