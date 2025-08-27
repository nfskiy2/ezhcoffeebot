// frontend_modern/src/api/types.ts

export interface SelectedAddon {
    id: string;
    name: string;
    cost: string;
}

export interface CartItem {
    cafeItem: {
        id: string;
        name: string;
        image?: string;
        selectedAddons?: SelectedAddon[];
    };
    variant: {
        id: string;
        name: string;
        cost: string;
    };
    quantity: number;
    cafeId: string;
    categoryId: string;
    selectedAddons?: SelectedAddon[];
}

export interface AddonItem {
    id: string;
    name: string;
    cost: string;
}

export interface AddonGroup {
    id: string;
    name: string;
    items: AddonItem[];
}

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
    cafeId: string;
    categoryId: string;
    image?: string;
    name?: string;
    description?: string;
    variants: MenuItemVariantSchema[];
    addons?: AddonGroup[];
    subCategory?: string; 
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
    cartItems: CartItemRequest[];
}
