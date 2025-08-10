// frontend_modern/src/telegram/telegram.ts

// 1. УБЕРИТЕ ПРЕДЫДУЩИЙ declare global { interface Window { Telegram?: { WebApp: { ... } } } }
// ВМЕСТО ЭТОГО, используйте @types/telegram-web-app (он уже есть у вас в devDependencies)
// Если @types/telegram-web-app установлен, он должен предоставить глобальный Telegram.WebApp

// Если вы НЕ ИСПОЛЬЗУЕТЕ @types/telegram-web-app, или он не работает, тогда
// НАИБОЛЕЕ ПРОСТОЕ И БЕЗОПАСНОЕ ГЛОБАЛЬНОЕ ОБЪЯВЛЕНИЕ ДЛЯ БРАУЗЕРА:
// ЭТО ГЛОБАЛЬНО ОБЪЯВЛЯЕТ ТИП WebApp (для Window.Telegram.WebApp)
interface TelegramWebApp {
    initData: string;
    ready: () => void;
    MainButton: {
        text: string;
        isVisible: boolean;
        isActive: boolean;
        show: () => any;
        hide: () => any;
        setText: (text: string) => any;
        showProgress: (leaveActive: boolean) => any;
        hideProgress: () => any;
        onClick: (callback: () => void) => any;
        offClick: (callback: () => void) => any;
        enable: () => any;
        disable: () => any;
    };
    BackButton: {
        isVisible: boolean;
        show: () => any;
        hide: () => any;
        onClick: (callback: () => void) => any;
        offClick: (callback: () => void) => any;
    };
    HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
        selectionChanged: () => void;
    };
    openInvoice: (url: string, callback?: (status: string) => void) => void;
    expand: () => void;
    close: () => void;
    colorScheme: 'light' | 'dark';
    onEvent: (eventType: string, callback: (...args: any[]) => void) => void;
    offEvent: (eventType: string, callback: (...args: any[]) => void) => void;
    showAlert: (message: string, callback?: () => void) => void;
    isVersionAtLeast: (version: string) => boolean;
    // Добавьте другие свойства по мере необходимости, например initDataUnsafe
    // initDataUnsafe: any; // Пример
}

declare global {
    interface Window {
        Telegram?: { // Теперь Telegram может быть просто объектом с свойством WebApp
            WebApp: TelegramWebApp;
        };
    }
}


// 2. Класс-обертка TelegramSDK
export class TelegramSDK {

    // Приватный геттер для безопасного доступа к window.Telegram.WebApp
    private static get webApp(): TelegramWebApp | undefined { // <-- ИСПРАВЛЕНО ТИПИЗАЦИЯ ЗДЕСЬ
        // Теперь просто обращаемся к window.Telegram?.WebApp,
        // так как глобальный тип Window уже был объявлен
        return window.Telegram?.WebApp;
    }

    static getInitData(): string {
        return this.webApp?.initData || '';
    }

    static showMainButton(text: string, onClick: () => void): void {
        this.webApp?.MainButton
            .offClick(onClick)
            .setText(text)
            .show()
            .onClick(onClick);
    }

    static setMainButtonLoading(isLoading: boolean): void {
        if (isLoading) {
            this.webApp?.MainButton.showProgress(false);
        } else {
            this.webApp?.MainButton.hideProgress();
        }
    }

    static hideMainButton(): void {
        this.webApp?.MainButton.hide();
    }

    static showBackButton(onClick: () => void): void {
        this.webApp?.BackButton
            .offClick(onClick)
            .onClick(onClick)
            .show();
    }

    static hideBackButton(): void {
        this.webApp?.BackButton.hide();
    }

    static impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void {
        if (this.webApp?.HapticFeedback && this.webApp.isVersionAtLeast('6.1')) {
            this.webApp.HapticFeedback.impactOccurred(style);
        }
    }

    static notificationOccurred(type: 'success' | 'warning' | 'error'): void {
        if (this.webApp?.HapticFeedback && this.webApp.isVersionAtLeast('6.1')) {
            this.webApp.HapticFeedback.notificationOccurred(type);
        }
    }

    static openInvoice(url: string, callback?: (status: string) => void): void {
        this.webApp?.openInvoice(url, callback);
    }

    static expand(): void {
        this.webApp?.expand();
    }

    static close(): void {
        this.webApp?.close();
    }

    static showAlert(message: string, callback?: () => void): void {
        this.webApp?.showAlert(message, callback);
    }
}