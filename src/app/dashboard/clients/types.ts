export interface Client {
  id: string;
  name: string;
  address: string;
  totalPrice: number;
  // Обновляем список допустимых статусов
  status: 'negotiation' | 'waiting_measure' | 'promised_pay' | 'waiting_production' | 'waiting_install' | 'special_case';
  phone?: string;
}

export interface Stage {
  // И здесь тоже разрешаем новые ID для колонок
  id: 'negotiation' | 'waiting_measure' | 'promised_pay' | 'waiting_production' | 'waiting_install' | 'special_case';
  title: string;
}