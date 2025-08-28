// frontend_modern/src/store/cart.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import type { CartItem } from '../api/types';

const LOCAL_STORAGE_KEY = 'laurel_cafe_cart_v2'; // Используем новый ключ для избежания конфликтов

// --- ИЗМЕНЕНИЕ: Добавляем уникальный ID в тип элемента корзины ---
export interface CartItemWithId extends CartItem {
    cartItemId: string; // e.g., "cappuccino-cappuccino-m-syrup-vanilla,milk-oat"
}

// --- Хелпер для генерации уникального ID ---
const generateCartItemId = (item: CartItem): string => {
    const addonsKey = (item.selectedAddons || [])
        .map(a => a.id)
        .sort()
        .join(',');
    return `${item.cafeItem.id}-${item.variant.id}-${addonsKey}`;
};


interface CartContextType {
    items: CartItemWithId[];
    addItem: (newItem: CartItem) => void;
    // --- ИЗМЕНЕНИЕ: Функции теперь принимают уникальный cartItemId ---
    increaseQuantity: (cartItemId: string) => void;
    decreaseQuantity: (cartItemId: string) => void;
    clearCart: () => void;
    getItemCount: (items: CartItem[]) => number;
    getTotalCost: (items: CartItem[]) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartItems, setCartItems] = useState<CartItemWithId[]>([]);

    useEffect(() => {
        try {
            const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedCart) {
                const parsedCart = JSON.parse(savedCart);
                if (Array.isArray(parsedCart)) {
                    // Простая проверка, что у элементов есть cartItemId
                    const validItems = parsedCart.filter(item => typeof item.cartItemId === 'string');
                    setCartItems(validItems);
                }
            }
        } catch (e) {
            logger.error("Failed to load cart from localStorage:", e);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
    }, [cartItems]);

    const addItem = useCallback((newItem: CartItem) => {
        if (newItem.quantity <= 0) return;

        setCartItems(prevItems => {
            const newItemId = generateCartItemId(newItem);
            const existingItemIndex = prevItems.findIndex(item => item.cartItemId === newItemId);

            if (existingItemIndex > -1) {
                // Если такой товар уже есть, просто увеличиваем количество
                const updatedItems = [...prevItems];
                updatedItems[existingItemIndex].quantity += newItem.quantity;
                return updatedItems;
            } else {
                // Иначе добавляем новый товар с уникальным ID
                const itemToAdd: CartItemWithId = { ...newItem, cartItemId: newItemId };
                return [...prevItems, itemToAdd];
            }
        });
    }, []);

    const increaseQuantity = useCallback((cartItemId: string) => {
        setCartItems(prevItems => prevItems.map(item => 
            item.cartItemId === cartItemId
                ? { ...item, quantity: item.quantity + 1 }
                : item
        ));
    }, []);

    const decreaseQuantity = useCallback((cartItemId: string) => {
        setCartItems(prevItems => 
            prevItems
                .map(item => 
                    item.cartItemId === cartItemId
                        ? { ...item, quantity: item.quantity - 1 }
                        : item
                )
                .filter(item => item.quantity > 0) // Удаляем товар, если количество стало 0
        );
    }, []);

    const clearCart = useCallback(() => setCartItems([]), []);
    
    const contextValue: CartContextType = {
        items: cartItems,
        addItem,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        getItemCount,
        getTotalCost,
    };

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
};

function getTotalCost(items: CartItem[]): number {
    return items.reduce((total, item) => {
        const variantCost = parseInt(item.variant.cost, 10) || 0;
        const addonsCost = item.selectedAddons?.reduce((sum, addon) => sum + (parseInt(addon.cost, 10) || 0), 0) || 0;
        return total + (variantCost + addonsCost) * item.quantity;
    }, 0);
}

function getItemCount(items: CartItem[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}