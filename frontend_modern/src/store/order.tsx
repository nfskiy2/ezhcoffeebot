// frontend_modern/src/store/order.tsx
import React, { createContext, useContext, useState, } from 'react';

export type FulfillmentMethod = 'dine-in' | 'takeaway' | 'delivery';

export interface DeliveryAddress {
    street: string;
    house: string;
    apartment: string;
    comment: string;
}

interface OrderContextType {
    fulfillmentMethod: FulfillmentMethod;
    deliveryAddress: DeliveryAddress | null;
    setFulfillmentMethod: (method: FulfillmentMethod) => void;
    setDeliveryAddress: (address: DeliveryAddress | null) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrder = () => {
    const context = useContext(OrderContext);
    if (!context) {
        throw new Error('useOrder must be used within an OrderProvider');
    }
    return context;
};

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('takeaway');
    const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);

    // Можно добавить сохранение в localStorage по аналогии с корзиной, если нужно

    const value = {
        fulfillmentMethod,
        deliveryAddress,
        setFulfillmentMethod,
        setDeliveryAddress
    };

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
};