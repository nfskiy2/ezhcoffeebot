// frontend_modern/src/api/types.ts
// import type { CartItem } from '../store/cart';

export interface CafeSchema {
    id: string;
    name: string;
    coverImage?: string;
    logoImage?: string;
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
    minOrderAmount: number;
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
    cartItems: CartItemRequest[]; // <--- ИСПОЛЬЗУЕМ camelCase
}