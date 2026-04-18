export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Client {
  id: string;
  companyId: string; // Задел на будущее (многопользовательский режим)
  fio: string;
  phone: string;
  address: string;
  totalPrice: number;
  status: 'negotiation' | 'waiting_measure' | 'promised_pay' | 'waiting_production' | 'waiting_install' | 'special_case';
  createdAt: string;
  products: Product[]; // Массив изделий из твоего 1-го скрина
  comment?: string;
  // Сюда потом добавим ссылки на фото договоров и замеров
}

export interface Stage {
  id: Client['status'];
  title: string;
}