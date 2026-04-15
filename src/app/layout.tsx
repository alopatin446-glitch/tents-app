import type { Metadata } from "next";
import { Montserrat } from "next/font/google"; // Импортируем Montserrat
import "./globals.css";

// Настраиваем шрифт
const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"], // Обязательно добавляем кириллицу
  weight: ["400", "700", "800"], // Выбираем нужные веса
  variable: "--font-montserrat",  // Создаем CSS-переменную
});

export const metadata: Metadata = {
  title: "EASY MO CORE | CRM мягких окон",
  description: "Профессиональная система расчета мягких окон",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      {/* Добавляем класс шрифта к body */}
      <body className={`${montserrat.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}