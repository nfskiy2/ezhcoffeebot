// frontend_modern/src/api/index.ts
import axios from 'axios';
import type { CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema, CafeSchema } from './types'; // Removed CafeInfoSchema
import { logger } from '../utils/logger'; // Import logger

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  logger.error("VITE_API_BASE_URL is not set in environment variables!");
  // In a real app, you might throw an error or use a fallback URL
  // throw new Error("VITE_API_BASE_URL is not set!");
} else {
    logger.log(`API Base URL: ${API_BASE_URL}`);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// NEW: Get list of all cafes
export const getAllCafes = async (): Promise<CafeSchema[]> => {
  try {
    const response = await apiClient.get<CafeSchema[]>('/cafes');
    return response.data;
  } catch (error) {
    logger.error("Error fetching all cafes:", error);
    throw error;
  }
};

// NEW: Get info about a specific cafe
export const getCafeById = async (cafeId: string): Promise<CafeSchema> => {
  try {
    const response = await apiClient.get<CafeSchema>(`/cafes/${cafeId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching cafe info for ${cafeId}:`, error);
    throw error;
  }
};

// UPDATED: Get list of categories for a specific cafe
export const getCafeCategories = async (cafeId: string): Promise<CategorySchema[]> => {
  try {
    const response = await apiClient.get<CategorySchema[]>(`/cafes/${cafeId}/categories`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching categories for cafe ${cafeId}:`, error);
    throw error;
  }
};

// UPDATED: Get menu by category for a specific cafe
export const getCafeCategoryMenu = async (cafeId: string, categoryId: string): Promise<MenuItemSchema[]> => {
  try {
    const response = await apiClient.get<MenuItemSchema[]>(`/cafes/${cafeId}/menu/${categoryId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching menu for category ${categoryId} of cafe ${cafeId}:`, error);
    throw error;
  }
};

// UPDATED: Get details of a menu item for a specific cafe
export const getCafeMenuItemDetails = async (cafeId: string, itemId: string): Promise<MenuItemSchema> => {
  try {
    const response = await apiClient.get<MenuItemSchema>(`/cafes/${cafeId}/menu/details/${itemId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching details for item ${itemId} of cafe ${cafeId}:`, error);
    throw error;
  }
};

// UPDATED: Get cafe settings for a specific cafe
export const getCafeSettings = async (cafeId: string): Promise<CafeSettingsSchema> => {
    try {
        const response = await apiClient.get<CafeSettingsSchema>(`/cafes/${cafeId}/settings`);
        return response.data;
    } catch (error) {
        logger.error(`Error fetching settings for cafe ${cafeId}:`, error);
        throw error;
    }
};

// UPDATED: Create an order for a specific cafe
export const createOrder = async (cafeId: string, orderData: OrderRequest): Promise<{ invoiceUrl: string }> => {
  try {
    const response = await apiClient.post<{ invoiceUrl: string }>(`/cafes/${cafeId}/order`, orderData);
    return response.data;
  } catch (error) {
    logger.error("Error creating order:", error);
    if (axios.isAxiosError(error) && error.response && error.response.data && error.response.data.detail) {
         throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const getCafePopularMenu = async (cafeId: string): Promise<MenuItemSchema[]> => {
  try {
    const response = await apiClient.get<MenuItemSchema[]>(`/cafes/${cafeId}/popular`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching popular menu for cafe ${cafeId}:`, error);
    throw error;
  }
};
