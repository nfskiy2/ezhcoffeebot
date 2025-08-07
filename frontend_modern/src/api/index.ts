// frontend_modern/src/api/index.ts (если используете TypeScript)
import axios from 'axios';
// Импортируйте типы данных, которые будут соответствовать вашим Pydantic схемам на бэкенде
// Мы создадим эти типы позже, пока используйте any или определите базовые типы
import type { CafeInfoSchema, CategorySchema, MenuItemSchema, OrderRequest } from './types'; // Создайте файл types.ts позже

// Получаем базовый URL бэкенда из переменных окружения Vite
// VITE_API_BASE_URL должен быть определен в вашем .env файле в корне фронтенда
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Если переменная окружения не установлена (например, в standalone режиме)
if (!API_BASE_URL) {
  console.error("VITE_API_BASE_URL is not set in environment variables!");
  // Можно выбросить ошибку или использовать заглушку URL
  // throw new Error("VITE_API_BASE_URL is not set!");
} else {
    console.log(`API Base URL: ${API_BASE_URL}`);
}


// Создаем экземпляр клиента axios с базовым URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Функции для взаимодействия с API бэкенда ---

// Получить информацию о кафе
export const getCafeInfo = async (): Promise<CafeInfoSchema> => {
  try {
    const response = await apiClient.get<CafeInfoSchema>('/info');
    return response.data;
  } catch (error) {
    console.error("Error fetching cafe info:", error);
    throw error; // Пробросить ошибку для обработки в UI
  }
};

// Получить список категорий
export const getCategories = async (): Promise<CategorySchema[]> => {
  try {
    const response = await apiClient.get<CategorySchema[]>('/categories');
    return response.data;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
};

// Получить меню по категории
export const getCategoryMenu = async (categoryId: string): Promise<MenuItemSchema[]> => {
  try {
    const response = await apiClient.get<MenuItemSchema[]>(`/menu/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching menu for category ${categoryId}:`, error);
    throw error;
  }
};

// Получить детали пункта меню
export const getMenuItemDetails = async (itemId: string): Promise<MenuItemSchema> => {
  try {
    const response = await apiClient.get<MenuItemSchema>(`/menu/details/${itemId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for item ${itemId}:`, error);
    throw error;
  }
};

// Создать заказ (отправить корзину на бэкенд)
// В ответ ожидаем URL инвойса от Telegram
export const createOrder = async (orderData: OrderRequest): Promise<{ invoiceUrl: string }> => {
  try {
    const response = await apiClient.post<{ invoiceUrl: string }>('/order', orderData);
    return response.data;
  } catch (error) {
    console.error("Error creating order:", error);
    // Если ошибка от бэкенда содержит детали (например, HTTPException)
    if (axios.isAxiosError(error) && error.response && error.response.data && error.response.data.detail) {
         console.error("Backend error detail:", error.response.data.detail);
         throw new Error(error.response.data.detail); // Пробросить специфическое сообщение
    }
    throw error; // Пробросить общую ошибку
  }
};