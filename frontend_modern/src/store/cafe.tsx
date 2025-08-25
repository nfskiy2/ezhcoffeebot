// frontend_modern/src/store/cafe.tsx
import * as React from 'react'; // Use * as React
import { createContext, useContext, useState, useEffect, useCallback } from 'react'; // Explicitly import hooks
import type { CafeSchema } from '../api/types';
import { logger } from '../utils/logger'; // Import logger
import { getAllCafes } from '../api'; // Import getAllCafes

// Define types for cafe context
interface CafeContextType {
    selectedCafe: CafeSchema | null;
    cafes: CafeSchema[];
    setSelectedCafeId: (cafeId: string | null) => void;
    isLoading: boolean;
    error: string | null;
        retryLoad: () => void; 

}

// Create context
const CafeContext = createContext<CafeContextType | undefined>(undefined);

// Hook for using cafe context
export const useCafe = () => {
    const context = useContext(CafeContext);
    if (!context) {
        throw new Error('useCafe must be used within a CafeProvider');
    }
    return context;
};

// Cafe context provider
export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCafe, setSelectedCafe] = useState<CafeSchema | null>(null);
    const [cafes, setCafes] = useState<CafeSchema[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCafes = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data: CafeSchema[] = await getAllCafes();
            setCafes(data);
            if (data.length > 0) {
                const savedCafeId = localStorage.getItem('selectedCafeId');
                const savedCafe = savedCafeId ? data.find(c => c.id === savedCafeId) : null;
                setSelectedCafe(savedCafe || data[0]);
            }
        } catch (err: any) {
            logger.error('Failed to load cafes:', err);
            setError(err.message || 'Failed to load cafes.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    
    useEffect(() => {
        const loadCafes = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data: CafeSchema[] = await getAllCafes();
                setCafes(data);
                if (data.length > 0) {
                    const savedCafeId = localStorage.getItem('selectedCafeId');
                    // ИСПРАВЛЕНИЕ: Ищем сохраненное кафе. Если его нет, выбираем первое.
                    const savedCafe = savedCafeId ? data.find(c => c.id === savedCafeId) : null;
                    if (savedCafe) {
                        setSelectedCafe(savedCafe);
                    } else {
                        setSelectedCafe(data[0]);
                        localStorage.setItem('selectedCafeId', data[0].id); // Обновляем сохраненное значение
                    }
                }
            } catch (err: any) {
                logger.error('Failed to load cafes:', err);
                setError(err.message || 'Не удалось загрузить кофейни.');
            } finally {
                setIsLoading(false);
            }
        };
        loadCafes();
    }, []);


    const setSelectedCafeId = useCallback((cafeId: string | null) => {
        if (cafeId === null) {
            setSelectedCafe(null);
            localStorage.removeItem('selectedCafeId');
        } else {
            const foundCafe = cafes.find(cafe => cafe.id === cafeId);
            if (foundCafe) {
                setSelectedCafe(foundCafe);
                localStorage.setItem('selectedCafeId', cafeId);
            } else {
                logger.error(`Cafe with ID ${cafeId} not found.`);
                setError(`Cafe with ID ${cafeId} not found.`);
            }
        }
    }, [cafes]);

    const contextValue: CafeContextType = {
        selectedCafe,
        cafes,
        setSelectedCafeId,
        isLoading,
        error,
        retryLoad: loadCafes,
    };

    // // Render loading/error state if cafes are not loaded yet or there's an error at the provider level
    // if (isLoading) {
    //     return <div>Loading cafes...</div>;
    // }

    // if (error) {
    //     return <div>Error loading cafes: {error}</div>;
    // }

    // If no cafe is selected, but list of cafes is available, the HomePage will handle selection UI
    // The provider just ensures data is loaded. If selectedCafe is null, HomePage will show selection UI.
    // So this provider itself doesn't need to render a selection screen here.
    return (
        <CafeContext.Provider value={contextValue}>
            {children}
        </CafeContext.Provider>
    );
};