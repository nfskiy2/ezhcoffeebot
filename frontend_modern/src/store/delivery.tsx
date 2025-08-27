import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

const LOCAL_STORAGE_KEY = 'laurel_cafe_delivery_info';

export type OrderType = 'in_store' | 'delivery';

export interface DeliveryAddress {
    city: string;
    street: string;
    house: string;
    apartment: string;
    comment: string;
}

interface DeliveryContextType {
    orderType: OrderType;
    address: DeliveryAddress | null;
    availableCities: string[];
    setOrderType: (type: OrderType) => void;
    saveAddress: (address: DeliveryAddress) => void;
    getFormattedAddress: () => string | null;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

export const useDelivery = () => {
    const context = useContext(DeliveryContext);
    if (!context) {
        throw new Error('useDelivery must be used within a DeliveryProvider');
    }
    return context;
};

// Список городов, где доступна доставка
const AVAILABLE_CITIES = ["Томск", "Северск", "Новосибирск"];

export const DeliveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [orderType, setOrderTypeState] = useState<OrderType>('in_store');
    const [address, setAddress] = useState<DeliveryAddress | null>(null);

    useEffect(() => {
        logger.log("Attempting to load delivery info from localStorage...");
        try {
            const savedInfo = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedInfo) {
                const { orderType: savedType, address: savedAddress } = JSON.parse(savedInfo);
                if (savedType === 'in_store' || savedType === 'delivery') {
                    setOrderTypeState(savedType);
                }
                if (savedAddress) {
                    setAddress(savedAddress);
                }
                logger.log("Delivery info loaded from localStorage.");
            }
        } catch (e) {
            logger.error("Failed to load delivery info from localStorage:", e);
        }
    }, []);

    const saveToLocalStorage = (type: OrderType, addr: DeliveryAddress | null) => {
        try {
            const data = JSON.stringify({ orderType: type, address: addr });
            localStorage.setItem(LOCAL_STORAGE_KEY, data);
            logger.log("Delivery info saved to localStorage.");
        } catch (e) {
            logger.error("Failed to save delivery info to localStorage:", e);
        }
    };

    const setOrderType = (type: OrderType) => {
        setOrderTypeState(type);
        saveToLocalStorage(type, address);
    };

    const saveAddress = (newAddress: DeliveryAddress) => {
        setAddress(newAddress);
        saveToLocalStorage(orderType, newAddress);
    };

    const getFormattedAddress = useCallback(() => {
        if (orderType !== 'delivery' || !address || !address.street || !address.house) {
            return null;
        }
        let formatted = `${address.city}, ул. ${address.street}, д. ${address.house}`;
        if (address.apartment) {
            formatted += `, кв./офис ${address.apartment}`;
        }
        return formatted;
    }, [address, orderType]);


    const contextValue: DeliveryContextType = {
        orderType,
        address,
        availableCities: AVAILABLE_CITIES,
        setOrderType,
        saveAddress,
        getFormattedAddress
    };

    return (
        <DeliveryContext.Provider value={contextValue}>
            {children}
        </DeliveryContext.Provider>
    );
};