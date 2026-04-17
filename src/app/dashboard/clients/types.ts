export interface Client {
  id: string;
  name: string;
  address: string;
  totalPrice: number;
  status: 'new' | 'calc' | 'negotiation' | 'install';
  phone?: string;
  lastContactDate?: string; // Для тех самых уведомлений о срочности
}

export interface Stage {
  id: Client['status'];
  title: string;
}