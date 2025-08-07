import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, MenuItemSchema, MenuItemVariantSchema } from '../api/types';

// Ключ для сохранения корзины в localStorage
const LOCAL_STORAGE_KEY = 'laurel_cafe_cart';

// Интерфейс для контекста корзины
interface CartContextType {
    items: CartItem[];
    addItem: (cafeItem: MenuItemSchema, variant: MenuItemVariantSchema, quantity: number) => void;
    increaseQuantity: (itemId: string, variantId: string, quantityToIncrease?: number) => void;
    decreaseQuantity: (itemId: string, variantId: string, quantityToDecrease?: number) => void;
    removeItem: (itemId: string, variantId: string) => void;
    clearCart: () => void;
    getItemCount: (items: CartItem[]) => number; // <-- Убедитесь, что здесь ТАК
    getTotalCost: (items: CartItem[]) => number; // <-- Убедитесь, что здесь ТАК
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function CartProvider({ children }: { children: React.ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    useEffect(() => {
        console.log("Attempting to load cart from localStorage...");
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
                        item.cafeItem && typeof item.cafeItem === 'object' && typeof item.cafeItem.id === 'string' && typeof item.cafeItem.name === 'string' && typeof item.cafeItem.image === 'string' &&
                        item.variant && typeof item.variant === 'object' && typeof item.variant.id === 'string' && typeof item.variant.name === 'string' && typeof item.variant.cost === 'string'
                    )
                ) {
                    console.log("Cart loaded from localStorage.");
                    setCartItems(parsedCart as CartItem[]);
                } else {
                    console.warn("Invalid data in localStorage for cart. Starting with empty cart.");
                    setCartItems([]);
                }
            } else {
                console.log("No cart found in localStorage. Starting with empty cart.");
                setCartItems([]);
            }
        } catch (e) {
            console.error("Failed to load cart from localStorage:", e);
            setCartItems([]);
        }
    }, []);

    useEffect(() => {
        console.log("Cart state changed. Attempting to save to localStorage...", cartItems);
        if (cartItems !== undefined && cartItems !== null) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
                console.log("Cart saved to localStorage.");
            } catch (e) {
                console.error("Failed to save cart to localStorage:", e);
            }
        }
    }, [cartItems]);

    const addItem = useCallback((cafeItem: MenuItemSchema, variant: MenuItemVariantSchema, quantity: number) => {
        if (quantity <= 0) {
            console.warn("Attempted to add item with quantity 0 or less.");
            return;
        }
        const newItem: CartItem = {
            cafeItem: {
                id: cafeItem.id,
                name: cafeItem.name,
                image: cafeItem.image,
            },
            variant: {
                id: variant.id,
                name: variant.name,
                cost: variant.cost,
            },
            quantity: quantity,
        };

        setCartItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(
                item => item.cafeItem.id === newItem.cafeItem.id && item.variant.id === newItem.variant.id
            );

            if (existingItemIndex > -1) {
                const updatedItems = [...prevItems];
                updatedItems[existingItemIndex] = {
                    ...updatedItems[existingItemIndex],
                    quantity: updatedItems[existingItemIndex].quantity + newItem.quantity
                };
                console.log(`Increased quantity for item ${newItem.cafeItem.name} (${newItem.variant.name}). New quantity: ${updatedItems[existingItemIndex].quantity}`);
                return updatedItems;
            } else {
                console.log(`Added new item to cart: ${newItem.cafeItem.name} (${newItem.variant.name}) x${newItem.quantity}`);
                return [...prevItems, newItem];
            }
        });
    }, []);

    const increaseQuantity = useCallback((itemId: string, variantId: string, quantityToIncrease: number = 1) => {
        if (quantityToIncrease <= 0) return;
        setCartItems(prevItems => {
            const updatedItems = prevItems.map(item => {
                if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                    console.log(`Increasing quantity for item ${item.cafeItem.name} (${item.variant.name}).`);
                    return { ...item, quantity: item.quantity + quantityToIncrease };
                }
                return item;
            });
            return updatedItems;
        });
    }, []);

    const decreaseQuantity = useCallback((itemId: string, variantId: string, quantityToDecrease: number = 1) => {
        if (quantityToDecrease <= 0) return;
        setCartItems(prevItems => {
            const updatedItems = prevItems.map(item => {
                if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                    console.log(`Decreasing quantity for item ${item.cafeItem.name} (${item.variant.name}).`);
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
            console.log(`Removed item with ID ${itemId} and variant ${variantId}.`);
            return updatedItems;
        });
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
        console.log("Cart cleared.");
    }, []);

    const contextValue: CartContextType = {
        items: cartItems,
        addItem,
        increaseQuantity,
        decreaseQuantity,
        removeItem,
        clearCart,
        getItemCount: getItemCount, // <-- Убедитесь, что здесь ТАК
        getTotalCost: getTotalCost, // <-- Убедитесь, что здесь ТАК
    };

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

export { CartProvider };

function getTotalCost(items: CartItem[]): number {
    return items.reduce((total, item) => {
        const cost = parseFloat(item.variant.cost);
        return total + (isNaN(cost) ? 0 : cost * item.quantity);
    }, 0);
}
function getItemCount(items: CartItem[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
}

