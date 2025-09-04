import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CafeSchema } from '../api/types';
import { logger } from '../utils/logger';
import { getAllCafes, getAppLogoUrl } from '../api';

// --- ИЗМЕНЕНИЕ: Добавляем getCafeById в тип ---
interface CafeContextType {
    selectedCafe: CafeSchema | null;
    cafes: CafeSchema[];
    logoUrl: string; 
    setSelectedCafeId: (cafeId: string | null) => void;
    isLoading: boolean;
    error: string | null;
    retryLoad: () => void;
    getCafeById: (cafeId: string) => CafeSchema | null;
}

const CafeContext = createContext<CafeContextType | undefined>(undefined);

export const useCafe = () => {
    const context = useContext(CafeContext);
    if (!context) {
        throw new Error('useCafe must be used within a CafeProvider');
    }
    return context;
};

export const CafeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCafe, setSelectedCafe] = useState<CafeSchema | null>(null);
    const [cafes, setCafes] = useState<CafeSchema[]>([]);
    const [logoUrl, setLogoUrl] = useState<string>('/icons/logo-laurel.svg');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCafes = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [cafesData, logoData] = await Promise.all([
                getAllCafes(),
                getAppLogoUrl()
            ]);
            
            setCafes(cafesData);
            setLogoUrl(logoData);

            const savedCafeId = localStorage.getItem('selectedCafeId');
            if (savedCafeId) {
                const savedCafe = cafesData.find(c => c.id === savedCafeId);
                setSelectedCafe(savedCafe || null);
            }
        } catch (err: any) {
            logger.error('Failed to load initial app data:', err);
            setError(err.message || 'Failed to load data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCafes();
    }, [loadCafes]);

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
            }
        }
    }, [cafes]);
    
    // --- ИЗМЕНЕНИЕ: Добавляем реализацию функции ---
    const getCafeById = useCallback((cafeId: string): CafeSchema | null => {
        return cafes.find(cafe => cafe.id === cafeId) || null;
    }, [cafes]);

    const contextValue: CafeContextType = {
        selectedCafe,
        cafes,
        logoUrl,
        setSelectedCafeId,
        isLoading,
        error,
        retryLoad: loadCafes,
        getCafeById, // <-- Добавляем в контекст
    };

    return (
        <CafeContext.Provider value={contextValue}>
            {children}
        </CafeContext.Provider>
    );
};
