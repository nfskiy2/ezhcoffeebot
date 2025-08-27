// frontend_modern/src/store/order.tsx
import React, { createContext, useContext, useState } from 'react';

export type FulfillmentMethod = 'delivery' | 'dine-in';
export type PackingOption = 'dine-in' | 'takeaway'; // Для выбора в корзине

export interface DeliveryAddress {
    street: string;
    house: string;
    apartment: string;
    comment: string;
}

interface OrderContextType {
    fulfillmentMethod: FulfillmentMethod;
    deliveryAddress: DeliveryAddress | null;
    packingOption: PackingOption;
    setFulfillmentMethod: (method: FulfillmentMethod) => void;
    setDeliveryAddress: (address: DeliveryAddress | null) => void;
    setPackingOption: (option: PackingOption) => void;
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
    const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('dine-in');
    const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
    const [packingOption, setPackingOption] = useState<PackingOption>('dine-in'); // По умолчанию "в зале"

    // Можно добавить сохранение в localStorage по аналогии с корзиной, если нужно

    const value = {
        fulfillmentMethod,
        deliveryAddress,
        packingOption,
        setFulfillmentMethod,
        setDeliveryAddress,
        setPackingOption,
    };

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
};