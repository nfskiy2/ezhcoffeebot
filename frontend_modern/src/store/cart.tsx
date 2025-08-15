// frontend_modern/src/store/cart.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

// ЭКСПОРТИРУЕМ CartItem, чтобы он был доступен для других модулей
export interface CartItem {
    cafeItem: {
        id: string;
        name: string;
        image?: string;
    };
    variant: {
        id: string;
        name: string;
        cost: string;
    };
    quantity: number;
    cafeId: string;
    categoryId: string;
}

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

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    useEffect(() => {
        logger.log("Attempting to load cart from localStorage...");
        try {
            const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedCart) {
                const parsedCart: unknown = JSON.parse(savedCart);
                if (
                    Array.isArray(parsedCart) &&
                    parsedCart.every(item =>
                        item &&
                        typeof item === 'object' &&
                        typeof item.quantity === 'number' && item.quantity >= 0 &&
                        item.cafeItem && typeof item.cafeItem === 'object' && typeof item.cafeItem.id === 'string' && typeof item.cafeItem.name === 'string' &&
                        ('image' in item.cafeItem ? typeof item.cafeItem.image === 'string' : true) &&
                        item.variant && typeof item.variant === 'object' && typeof item.variant.id === 'string' && typeof item.variant.name === 'string' && typeof item.variant.cost === 'string' &&
                        'cafeId' in item && typeof item.cafeId === 'string' &&
                        'categoryId' in item && typeof item.categoryId === 'string'
                    )
                ) {
                    logger.log("Cart loaded from localStorage.");
                    setCartItems(parsedCart as CartItem[]);
                } else {
                    logger.warn("Invalid data in localStorage for cart. Starting with empty cart.");
                    setCartItems([]);
                }
            } else {
                logger.log("No cart found in localStorage. Starting with empty cart.");
                setCartItems([]);
            }
        } catch (e) {
            logger.error("Failed to load cart from localStorage:", e);
            setCartItems([]);
        }
    }, []);

    useEffect(() => {
        logger.log("Cart state changed. Attempting to save to localStorage...", cartItems);
        if (cartItems !== undefined && cartItems !== null) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
                logger.log("Cart saved to localStorage.");
            } catch (e) {
                logger.error("Failed to save cart to localStorage:", e);
            }
        }
    }, [cartItems]);

    const addItem = useCallback((newItem: CartItem) => {
        if (newItem.quantity <= 0) {
            logger.warn("Attempted to add item with quantity 0 or less.");
            return;
        }
        setCartItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(
                item => item.cafeId === newItem.cafeId &&
                        item.cafeItem.id === newItem.cafeItem.id &&
                        item.variant.id === newItem.variant.id
            );
            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                updatedItems[existingItemIndex] = {
                    ...updatedItems[existingItemIndex],
                    quantity: updatedItems[existingItemIndex].quantity + newItem.quantity
                };
                logger.log(`Increased quantity for item ${newItem.cafeItem.name} (${newItem.variant.name}) in cafe ${newItem.cafeId}. New quantity: ${updatedItems[existingItemIndex].quantity}`);
                return updatedItems;
            } else {
                logger.log(`Added new item to cart: ${newItem.cafeItem.name} (${newItem.variant.name}) in cafe ${newItem.cafeId} x${newItem.quantity}. Category: ${newItem.categoryId}`);
                return [...prevItems, newItem];
            }
        });
    }, []);

    const increaseQuantity = useCallback((itemId: string, variantId: string, quantityToIncrease: number = 1) => {
        if (quantityToIncrease <= 0) return;
        setCartItems(prevItems => prevItems.map(item => {
            if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                logger.log(`Increasing quantity for item ${item.cafeItem.name} (${item.variant.name}).`);
                return { ...item, quantity: item.quantity + quantityToIncrease };
            }
            return item;
        }));
    }, []);

    const decreaseQuantity = useCallback((itemId: string, variantId: string, quantityToDecrease: number = 1) => {
        if (quantityToDecrease <= 0) return;
        setCartItems(prevItems => {
            const updatedItems = prevItems.map(item => {
                if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                    logger.log(`Decreasing quantity for item ${item.cafeItem.name} (${item.variant.name}).`);
                    const newQuantity = item.quantity - quantityToDecrease;
                    return { ...item, quantity: Math.max(0, newQuantity) };
                }
                return item;
            });
            return updatedItems.filter(item => item.quantity > 0);
        });
    }, []);

    const removeItem = useCallback((itemId: string, variantId: string) => {
        setCartItems(prevItems => {
            const updatedItems = prevItems.filter(
                item => !(item.cafeItem.id === itemId && item.variant.id === variantId)
            );
            logger.log(`Removed item with ID ${itemId} and variant ${variantId}.`);
            return updatedItems;
        });
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
        logger.log("Cart cleared.");
    }, []);

    const contextValue: CartContextType = {
        items: cartItems,
        addItem,
        increaseQuantity,
        decreaseQuantity,
        removeItem,
        clearCart,
        getItemCount, // ИСПРАВЛЕНО
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
        const cost = parseFloat(item.variant.cost);
        return total + (isNaN(cost) ? 0 : cost * item.quantity);
    }, 0);
}

function getItemCount(items: CartItem[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}