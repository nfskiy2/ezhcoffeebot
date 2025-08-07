// frontend_modern/src/api/types.ts
// Убедитесь, что каждое определение начинается с 'export'

export interface CafeInfoSchema { 
    coverImage: string;
    logoImage: string;
    name: string;
    kitchenCategories: string;
    rating: string;
    cookingTime: string;
    status: string;
}

export interface CategorySchema { 
    id: string;
    icon: string;
    name: string;
    backgroundColor: string;
}

export interface MenuItemVariantSchema { 
    id: string;
    name: string;
    cost: string; // Или number
    weight: string;
}

export interface MenuItemSchema { 
    id: string;
    image: string;
    name: string;
    description: string;
    variants: MenuItemVariantSchema[];
}

// Типы для тела запроса /order
export interface OrderItemCafeItem { 
    id: string;
    name?: string;
}

export interface OrderItemVariant { 
    id: string;
    name: string; 
    cost: string; 
}

export interface CartItemRequest { 
    cafeItem: OrderItemCafeItem;
    variant: OrderItemVariant;
    quantity: number;
}

export interface OrderRequest { 
    _auth: string;
    cartItems: CartItemRequest[];
}

export interface CartItem {
    // Сохраняем данные пункта меню, которые нужны в корзине
    // Возможно, не все поля MenuItemSchema нужны, можно создать более простой тип CartItemCafeItemDetails
    cafeItem: {
         id: string;
         name: string;
         image: string; // Изображение для отображения в корзине
    };
    // Сохраняем выбранный вариант (цена и название важны)
    variant: {
         id: string;
         name: string;
         cost: string; // Цена в минимальных единицах
    };
    quantity: number; // Количество выбранное пользователем
}

// Возможно, тип для состояния корзины
export interface CartState {
    items: CartItem[];
    // Можно добавить другие поля, например, общая стоимость, количество позиций
}