// frontend_modern/src/App.tsx
import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { logger } from './utils/logger';

// Import pages
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import DetailsPage from './pages/DetailsPage';
import CartPage from './pages/CartPage';

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Эффект для инициализации Telegram Web App SDK
    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            logger.log("Telegram Web App SDK detected.");

            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();

            // Обработка темы
            const setTheme = () => {
                document.documentElement.className = tg.colorScheme;
                logger.log("Initial theme:", tg.colorScheme);
            };
            tg.onEvent('themeChanged', setTheme);
            setTheme();

            // Обработка кнопки "Назад"
            const handleBackButton = () => navigate(-1);
            tg.BackButton.onClick(handleBackButton);
            logger.log("Telegram BackButton onClick handler added.");

            return () => {
                tg.offEvent('themeChanged', setTheme);
                tg.BackButton.offClick(handleBackButton);
            };
        } else {
            logger.warn("Telegram Web App SDK not detected.");
        }
    }, [navigate]);

    // Эффект для управления видимостью кнопки "Назад"
    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (location.pathname !== '/') {
                tg.BackButton.show();
            } else {
                tg.BackButton.hide();
            }
        }
    }, [location.pathname]);

    return (
        <main>
            <Routes>
                {/* Главная страница */}
                <Route path="/" element={<HomePage />} />

                {/* НОВЫЕ МАРШРУТЫ С cafeId */}
                <Route path="/cafe/:cafeId/category/:categoryId" element={<CategoryPage />} />
                <Route path="/cafe/:cafeId/details/:itemId" element={<DetailsPage />} />

                {/* Страница корзины */}
                <Route path="/cart" element={<CartPage />} />

                {/* Страница 404 или редирект */}
                <Route path="*" element={<div>Page Not Found</div>} />
            </Routes>
        </main>
    );
};

export default App;