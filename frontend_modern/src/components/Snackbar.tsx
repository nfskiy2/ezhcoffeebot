// frontend_modern/src/components/Snackbar.tsx
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { TelegramSDK } from 'D:/programming/tma-cafe/frontend_modern/src/telegram/telegram.ts'; 

// Определение типов для параметров Snackbar
interface SnackbarOptions {
    style?: 'success' | 'warning' | 'error'; // Для Haptic Feedback
    duration?: number; // Длительность показа в мс (по умолчанию 2000)
    backgroundColor?: string; // Прямое указание цвета фона
    textColor?: string; // Прямое указание цвета текста
}

// Определение типов для контекста Snackbar
interface SnackbarContextType {
    showSnackbar: (message: string, options?: SnackbarOptions) => void;
}

// Создание контекста
const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

// Хук для использования Snackbar
export const useSnackbar = () => {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
};

// Провайдер Snackbar
export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [message, setMessage] = useState<string | null>(null);
    const [options, setOptions] = useState<SnackbarOptions | undefined>(undefined);
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    
    const showSnackbar = useCallback((msg: string, opts?: SnackbarOptions) => {
        // Очищаем предыдущий таймаут, если Snackbar уже показан
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        setMessage(msg);
        setOptions(opts);
        setIsVisible(true);

        // Отправляем Haptic Feedback: только если стиль явно указан и он допустим для notificationOccurred
        if (opts?.style === 'success' || opts?.style === 'warning' || opts?.style === 'error') {
            TelegramSDK.notificationOccurred(opts.style);
        } else {
            // Если стиль не указан или он 'info', можно использовать light impactOccurred
            TelegramSDK.impactOccurred('light');
        }

        const duration = opts?.duration || 2000;
        if (timeoutRef.current) { // Убедимся, что timeoutRef.current не null перед очисткой
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setMessage(null);
        }, duration + 300) as unknown as number;
    }, []);




    // Стилизация Snackbar'а
    const snackbarStyle: React.CSSProperties = {
        backgroundColor: options?.backgroundColor || 'var(--accent-color)',
        color: options?.textColor || 'var(--on-accent-color)',
    };

    // При изменении видимости добавляем/удаляем класс 'show'
    useEffect(() => {
        // Дополнительная логика, если нужно что-то сделать при изменении видимости
    }, [isVisible]);

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            {message && (
                <div
                    className={`snackbar ${isVisible ? 'show' : ''}`}
                    style={snackbarStyle}
                    // Дополнительный рендеринг сообщения
                    onTransitionEnd={() => {
                        // Если переход закончился и Snackbar должен быть скрыт, можно очистить сообщение
                        if (!isVisible) setMessage(null);
                    }}
                >
                    {message}
                </div>
            )}
        </SnackbarContext.Provider>
    );
};