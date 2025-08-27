import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import type { CartItem, SelectedAddon } from '../api/types';

const LOCAL_STORAGE_KEY = 'laurel_cafe_cart';

interface CartContextType {
    items: CartItem[];
    addItem: (newItem: CartItem) => void;
    increaseQuantity: (itemId: string, variantId: string, quantityToIncrease?: number) => void;
    decreaseQuantity: (itemId: string, variantId: string, quantityToDecrease?: number) => void;
    removeItem: (itemId: string, variantId: string) => void;
    clearCart: () => void;
    getItemCount: (items: CartItem[]) => number;
    getTotalCost: (items: CartItem[]) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

// Функция-валидатор, проверяющая, что один элемент корзины соответствует новой структуре
const isCartItemValid = (item: any): item is CartItem => {
    return (
        item &&
        typeof item === 'object' &&
        typeof item.quantity === 'number' && item.quantity >= 0 &&
        item.cafeItem && typeof item.cafeItem === 'object' && typeof item.cafeItem.id === 'string' &&
        item.variant && typeof item.variant === 'object' && typeof item.variant.id === 'string' &&
        // Ключевая проверка: убеждаемся, что categoryId существует и является строкой
        typeof item.cafeId === 'string' &&
        typeof item.categoryId === 'string'
    );
};


export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    useEffect(() => {
        logger.log("Attempting to load cart from localStorage...");
        try {
            const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedCart) {
                const parsedCart: unknown = JSON.parse(savedCart);
                if (Array.isArray(parsedCart)) {
                    // УЛУЧШЕНИЕ: Используем filter вместо every.
                    // Это отбросит старые, невалидные товары, но сохранит новые.
                    const validItems = parsedCart.filter(isCartItemValid);
                    
                    if (validItems.length < parsedCart.length) {
                        logger.warn("Removed invalid items from cart found in localStorage.");
                    }

                    logger.log("Cart loaded and validated from localStorage.");
                    setCartItems(validItems);
                } else {
                    setCartItems([]);
                }
            }
        } catch (e) {
            logger.error("Failed to load cart from localStorage:", e);
            setCartItems([]);
        }
    }, []);

    useEffect(() => {
        logger.log("Cart state changed. Saving to localStorage...", cartItems);
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
        } catch (e) {
            logger.error("Failed to save cart to localStorage:", e);
        }
    }, [cartItems]);

    const addItem = useCallback((newItem: CartItem) => {
        if (newItem.quantity <= 0) return;

        setCartItems(prevItems => {
            const getAddonsKey = (addons?: SelectedAddon[]) => {
                if (!addons || addons.length === 0) return '';
                return addons.map(a => a.id).sort().join(',');
            };

            const newItemAddonsKey = getAddonsKey(newItem.selectedAddons);

            const existingItemIndex = prevItems.findIndex(item =>
                item.cafeItem.id === newItem.cafeItem.id &&
                item.variant.id === newItem.variant.id &&
                getAddonsKey(item.selectedAddons) === newItemAddonsKey
            );

            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                updatedItems[existingItemIndex].quantity += newItem.quantity;
                return updatedItems;
            } else {
                return [...prevItems, newItem];
            }
        });
    }, []);

    const increaseQuantity = useCallback((itemId: string, variantId: string, quantityToIncrease: number = 1) => {
        setCartItems(prevItems => prevItems.map(item => 
            (item.cafeItem.id === itemId && item.variant.id === variantId)
                ? { ...item, quantity: item.quantity + quantityToIncrease }
                : item
        ));
    }, []);

    const decreaseQuantity = useCallback((itemId: string, variantId: string, quantityToDecrease: number = 1) => {
        setCartItems(prevItems => 
            prevItems.map(item => 
                (item.cafeItem.id === itemId && item.variant.id === variantId)
                    ? { ...item, quantity: Math.max(0, item.quantity - quantityToDecrease) }
                    : item
            ).filter(item => item.quantity > 0)
        );
    }, []);

    const removeItem = useCallback((itemId: string, variantId: string) => {
        setCartItems(prevItems => prevItems.filter(item => !(item.cafeItem.id === itemId && item.variant.id === variantId)));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    const contextValue: CartContextType = {
        items: cartItems,
        addItem,
        increaseQuantity,
        decreaseQuantity,
        removeItem,
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
        const variantCost = parseInt(item.variant.cost, 10);
        const addonsCost = item.selectedAddons?.reduce((addonTotal, addon) => addonTotal + parseInt(addon.cost, 10), 0) || 0;
        const totalItemCost = (variantCost + addonsCost) * item.quantity;
        return total + (isNaN(totalItemCost) ? 0 : totalItemCost);
    }, 0);
}

function getItemCount(items: CartItem[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}