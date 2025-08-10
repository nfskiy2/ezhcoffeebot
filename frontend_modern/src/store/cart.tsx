import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'; 
// Импортируем типы данных для корзины и пунктов меню
import type { CartItem, MenuItemSchema, MenuItemVariantSchema } from '../api/types'; // Убедитесь, что типы импортируются правильно

// Импортируем вспомогательную функцию для форматирования стоимости (если нужна в геттере, хотя лучше форматировать при отображении)
// import { toDisplayCost } from '../utils/currency';


// Ключ для сохранения корзины в localStorage
const LOCAL_STORAGE_KEY = 'laurel_cafe_cart';

// Интерфейс для контекста корзины
interface CartContextType {
    items: CartItem[]; // Список элементов в корзине
    addItem: (cafeItem: MenuItemSchema, variant: MenuItemVariantSchema, quantity: number) => void; // Функция для добавления/обновления товара
    increaseQuantity: (itemId: string, variantId: string, quantityToIncrease?: number) => void; // Увеличить количество существующего товара
    decreaseQuantity: (itemId: string, variantId: string, quantityToDecrease?: number) => void; // Уменьшить количество или удалить
    removeItem: (itemId: string, variantId: string) => void; // Удалить товар
    clearCart: () => void; // Очистить корзину
    getItemCount: (items: CartItem[]) => number; // Общее количество позиций (сумма quantity)
    getTotalCost: (items: CartItem[]) => number; // Общая стоимость корзины (в минимальных единицах)
    // Можно добавить другие полезные функции, например, getItem(id, variantId)
}

// Создаем контекст с дефолтными значениями (которые будут переопределены провайдером)
// Используем `undefined` и проверяем его в хуке useCart
const CartContext = createContext<CartContextType | undefined>(undefined);

// Создаем провайдер контекста.
// Объявляем как обычную функцию React, БЕЗ export здесь в начале
function CartProvider({ children }: { children: React.ReactNode }) { // <-- Изменен синтаксис
    // Состояние корзины
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    // --- Хук для загрузки корзины из localStorage при инициализации ---
    // Выполняется один раз при первом рендере провайдера
    useEffect(() => {
        try {
            const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedCart) {
                // Парсим JSON. Добавляем проверку на валидность структуры
                const parsedCart: unknown = JSON.parse(savedCart); // Парсим как unknown сначала
                 // Проверяем, что это массив и элементы похожи на CartItem
                if (
                    Array.isArray(parsedCart) &&
                    parsedCart.every(item =>
                        item &&
                        typeof item === 'object' &&
                        typeof item.quantity === 'number' && item.quantity >= 0 && // количество должно быть числом >= 0
                        item.cafeItem && typeof item.cafeItem === 'object' && typeof item.cafeItem.id === 'string' && typeof item.cafeItem.name === 'string' && typeof item.cafeItem.image === 'string' &&
                        item.variant && typeof item.variant === 'object' && typeof item.variant.id === 'string' && typeof item.variant.name === 'string' && typeof item.variant.cost === 'string' // cost может быть строкой
                    )
                ) {
                    setCartItems(parsedCart as CartItem[]); // Утверждаем тип после проверки
                } else {
                    setCartItems([]); // Начинаем с пустой корзины, если данные некорректны
                }
            } else {
                setCartItems([]); // Начинаем с пустой корзины, если ничего нет в localStorage
            }
        } catch (e) {
             setCartItems([]); // В случае ошибки парсинга или другой ошибки, начинаем с пустой корзины
        }
    }, []); // Пустой массив зависимостей: выполняется только один раз при монтировании провайдера

    // --- Хук для сохранения корзины в localStorage при изменении ---
    // Выполняется при каждом изменении состояния cartItems (после его инициализации)
    useEffect(() => {
         // Проверяем, что состояние не является undefined или null (после загрузки)
        if (cartItems !== undefined && cartItems !== null) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
            } catch (e) {
                // В реальном приложении можно уведомить пользователя
            }
        }
    }, [cartItems]); // Зависит от cartItems: выполняется при каждом изменении состояния корзины


    // --- Функции для управления корзиной (используем useCallback) ---
    // Оборачиваем функции в useCallback, чтобы они имели стабильную ссылку,
    // что важно для зависимостей других хуков и для оптимизации.

    const addItem = useCallback((cafeItem: MenuItemSchema, variant: MenuItemVariantSchema, quantity: number) => {
        if (quantity <= 0) {
             return; // Не добавляем товары с некорректным количеством
        }
        // Создаем новый элемент корзины с нужными полями
        const newItem: CartItem = {
            cafeItem: {
                id: cafeItem.id,
                name: cafeItem.name,
                image: cafeItem.image,
            },
            variant: {
                id: variant.id,
                name: variant.name,
                cost: variant.cost, // Цена в минимальных единицах (строка или число)
            },
            quantity: quantity, // Количество, которое добавляем
        };

        setCartItems(prevItems => {
            // Ищем, существует ли уже товар с таким же ID пункта меню и варианта
            const existingItemIndex = prevItems.findIndex(
                item => item.cafeItem.id === newItem.cafeItem.id && item.variant.id === newItem.variant.id
            );

            if (existingItemIndex > -1) {
                // Если товар существует, создаем обновленный массив с увеличенным количеством
                const updatedItems = [...prevItems]; // Копируем массив для иммутабельности
                updatedItems[existingItemIndex] = {
                     ...updatedItems[existingItemIndex], // Копируем существующий элемент
                     quantity: updatedItems[existingItemIndex].quantity + newItem.quantity // Увеличиваем количество
                };
                return updatedItems; // Возвращаем новый массив для обновления состояния
            } else {
                // Если товар новый, добавляем его в конец массива
                return [...prevItems, newItem]; // Возвращаем новый массив с добавленным элементом
            }
        });
    }, []); // Нет зависимостей, так как используем функцию обновления состояния prevItems => ...


    // Увеличить количество существующего товара по ID и ID варианта
     const increaseQuantity = useCallback((itemId: string, variantId: string, quantityToIncrease: number = 1) => {
         if (quantityToIncrease <= 0) return; // Не увеличиваем на некорректное количество
         setCartItems(prevItems => {
             const updatedItems = prevItems.map(item => {
                 if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                     return { ...item, quantity: item.quantity + quantityToIncrease }; // Возвращаем обновленный элемент
                 }
                 return item; // Возвращаем элемент без изменений
             });
             return updatedItems; // Возвращаем новый массив
         });
     }, []); // Нет зависимостей


    // Уменьшить количество существующего товара по ID и ID варианта
     const decreaseQuantity = useCallback((itemId: string, variantId: string, quantityToDecrease: number = 1) => {
          if (quantityToDecrease <= 0) return; // Не уменьшаем на некорректное количество
         setCartItems(prevItems => {
             const updatedItems = prevItems.map(item => {
                 if (item.cafeItem.id === itemId && item.variant.id === variantId) {
                     const newQuantity = item.quantity - quantityToDecrease;
                     // Если количество становится <= 0, возвращаем элемент с quantity: 0 для фильтрации
                     return { ...item, quantity: Math.max(0, newQuantity) }; // Убедимся, что не уходим в минус
                 }
                 return item; // Возвращаем элемент без изменений
             });
             // Фильтруем товары с количеством === 0, создавая новый массив
             return updatedItems.filter(item => item.quantity > 0);
         });
     }, []); // Нет зависимостей


    // Удалить товар по ID и ID варианта
    const removeItem = useCallback((itemId: string, variantId: string) => {
        setCartItems(prevItems => {
             // Фильтруем, оставляя только те товары, которые НЕ соответствуют удаляемому
             const updatedItems = prevItems.filter(
                item => !(item.cafeItem.id === itemId && item.variant.id === variantId)
             );
             return updatedItems; // Возвращаем новый массив
         });
     }, []); // Нет зависимостей


    // Очистить корзину
    const clearCart = useCallback(() => {
        setCartItems([]); // Устанавливаем пустой массив
    }, []); // Нет зависимостей


    // --- Вспомогательные геттеры (используем useCallback для мемоизации, но основная выгода в зависимости от cartItems) ---

    // Получить общее количество позиций (сумма quantity всех товаров)
    const getItemCount = (items: CartItem[]) => { 
        return items.reduce((total, item) => total + item.quantity, 0);
    };

    const getTotalCost = (items: CartItem[]) => { // <-- Теперь принимает items
        return items.reduce((total, item) => {
            const itemCost = parseInt(item.variant.cost, 10);
            if (isNaN(itemCost)) {
                 return total;
            }
            return total + itemCost * item.quantity;
        }, 0);
    };

    // Объект контекста, предоставляющий состояние и функции
    // Этот объект создается заново при каждом рендере провайдера,
    // но функции внутри него имеют стабильные ссылки благодаря useCallback.
    const contextValue: CartContextType = {
        items: cartItems,
        addItem,
        increaseQuantity,
        decreaseQuantity,
        removeItem,
        clearCart,
        getItemCount: getItemCount, 
        getTotalCost: getTotalCost, 
    };

    return (
        // Здесь используются теги <div>
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
} 

// --- Хук для использования контекста корзины ---
// Позволяет компонентам-потомкам получать доступ к значениям контекста
export const useCart = () => {
    const context = useContext(CartContext);
    // Проверяем, что хук используется внутри компонента, обернутого в CartProvider
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context; // Возвращаем объект с items и функциями
};

export { CartProvider }; 