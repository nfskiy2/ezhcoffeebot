import axios from 'axios';
import type { CafeInfoSchema, CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema } from './types'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Создаем экземпляр клиента axios с базовым URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Получить информацию о кафе
export const getCafeInfo = async (): Promise<CafeInfoSchema> => {
  try {
    const response = await apiClient.get<CafeInfoSchema>('/info');
    return response.data;
  } catch (error) {
    throw error; // Пробросить ошибку для обработки в UI
  }
};

// Получить список категорий
export const getCategories = async (): Promise<CategorySchema[]> => {
  try {
    const response = await apiClient.get<CategorySchema[]>('/categories');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Получить меню по категории
export const getCategoryMenu = async (categoryId: string): Promise<MenuItemSchema[]> => {
  try {
    const response = await apiClient.get<MenuItemSchema[]>(`/menu/${categoryId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Получить детали пункта меню
export const getMenuItemDetails = async (itemId: string): Promise<MenuItemSchema> => {
  try {
    const response = await apiClient.get<MenuItemSchema>(`/menu/details/${itemId}`);
    return response.data;
  } catch (error) {
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
    // Если ошибка от бэкенда содержит детали (например, HTTPException)
    if (axios.isAxiosError(error) && error.response && error.response.data && error.response.data.detail) {
         throw new Error(error.response.data.detail); // Пробросить специфическое сообщение
    }
    throw error; // Пробросить общую ошибку
  }
};

export const getCafeSettings = async (): Promise<CafeSettingsSchema> => {
  try {
    const response = await apiClient.get<CafeSettingsSchema>('/settings');
    return response.data;
  } catch (error) {
    throw error;
  }
};
