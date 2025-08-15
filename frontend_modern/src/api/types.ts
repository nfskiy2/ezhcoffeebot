// frontend_modern/src/api/types.ts
import type { CartItem } from '../store/cart';

// --- Схемы данных, соответствующие моделям SQLAlchemy ---
export interface CafeSchema {
    id: string;
    name: string;
    coverImage?: string; // camelCase
    logoImage?: string;   // camelCase
    kitchenCategories?: string;
    rating?: string;
    cookingTime?: string;
    status?: string;
    openingHours?: string;
    minOrderAmount?: number;
}

export interface CategorySchema {
    id: string;
    cafe_id: string;
    icon?: string;
    name?: string;
    backgroundColor?: string;
}

export interface MenuItemVariantSchema {
    id: string;
    name: string;
    cost: string;
    weight?: string;
}

export interface MenuItemSchema {
    id: string;
    cafe_id: string;
    category_id: string;
    image?: string;
    name?: string;
    description?: string;
    variants: MenuItemVariantSchema[];
}

export interface CafeSettingsSchema {
    min_order_amount: number;
}


// --- Схемы для тела запроса /order ---
export interface OrderItemCafeItem {
    id: string;
    name?: string;
}

export interface OrderItemVariant {
    id: string;
    name?: string;
    cost?: string;
}

export interface CartItemRequest {
    cafeItem: OrderItemCafeItem;
    variant: OrderItemVariant;
    quantity: number;
    categoryId: string;
}

// Главная схема запроса заказа (соответствует backend/app/schemas.py)
export interface OrderRequest {
    auth: string;
    cart_items: CartItem[]; // Используем CartItem напрямую
}