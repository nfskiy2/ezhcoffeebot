import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCafeCategories, getCafePopularMenu } from '../api';
import type { CategorySchema, MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { getContrastingTextColor } from '../utils/colorUtils';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import ErrorState from '../components/ErrorState';
import { getCafeStatus, formatOpeningHours } from '../utils/timeUtils';
import { useDelivery } from '../store/delivery';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    // const location = useLocation();
    const { items, getItemCount } = useCart();
    const { selectedCafe, isLoading: isCafeLoading, error: cafeError, retryLoad: retryLoadCafes } = useCafe();
    const { orderType, getFormattedAddress } = useDelivery();
    
    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = useState<MenuItemSchema[]>([]);
    const [isLoadingCafeData, setIsLoadingCafeData] = useState(true);
    
    // Используем selectedCafe напрямую. Логика с displayCafe была избыточной.
    const cafeToDisplay = selectedCafe; 

    const cafeStatus = useMemo(() => getCafeStatus(cafeToDisplay?.openingHours), [cafeToDisplay]);

    useEffect(() => {
        const loadCafeSpecificData = async () => {
            if (!cafeToDisplay) {
                setIsLoadingCafeData(false);
                return;
            }
            setIsLoadingCafeData(true);
            try {
                logger.log(`Loading data for cafe: ${cafeToDisplay.id}`);
                const [categoriesData, popularData] = await Promise.all([
                    getCafeCategories(cafeToDisplay.id),
                    getCafePopularMenu(cafeToDisplay.id)
                ]);
                setCategories(categoriesData || []);
                setPopularItems(popularData || []);
            } catch (err: any) {
                logger.error("Failed to load cafe specific data:", err);
            } finally {
                setIsLoadingCafeData(false);
            }
        };
        loadCafeSpecificData();
    }, [cafeToDisplay]);

    const handleMainButtonClick = useCallback(() => {
        if (getItemCount(items) > 0) {
            navigate('/cart');
        }
    }, [navigate, getItemCount, items]);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        const positions = getItemCount(items);
        if (positions > 0) {
            let plural = 'ПОЗИЦИЙ';
            if (positions === 1) plural = 'ПОЗИЦИЯ';
            else if (positions > 1 && positions < 5) plural = 'ПОЗИЦИИ';
            const buttonText = `МОЯ КОРЗИНА • ${positions} ${plural}`;
            tg.MainButton.setText(buttonText).show().enable();
            tg.MainButton.onClick(handleMainButtonClick);
        } else {
            tg.MainButton.hide();
        }

        return () => {
            tg.MainButton.offClick(handleMainButtonClick);
        };
    }, [items, handleMainButtonClick, getItemCount]);
    
    const formattedAddress = getFormattedAddress();
    const headerTitle = (orderType === 'delivery' && formattedAddress) ? formattedAddress : cafeToDisplay?.name;
    
    // --- УСЛОВИЯ ОТОБРАЖЕНИЯ ---
    if (isCafeLoading) {
        return <section>{/* Шиммер-заглушка */}</section>;
    }

    if (cafeError) {
        return <ErrorState message={cafeError} onRetry={retryLoadCafes} />;
    }

    if (!cafeToDisplay) {
        // Если кафе еще не выбрано (первый запуск), показываем заглушку
        return (
            <section className="selection-redirect">
                <h2>Добро пожаловать!</h2>
                <p>Пожалуйста, выберите кофейню или укажите адрес доставки, чтобы продолжить.</p>
                <button onClick={() => navigate('/select-location')}>Начать</button>
            </section>
        );
    }

    // --- ОСНОВНАЯ РАЗМЕТКА ---
    return (
        <section>
            <div className="cafe-logo-container" onClick={() => navigate('/select-location')} style={{ cursor: 'pointer' }}>
                <img id="cafe-logo" className="cafe-logo" src={cafeToDisplay.logoImage || "/icons/icon-transparent.svg"} alt="Логотип кафе"/>
            </div>
            <img id="cafe-cover" className="cover" src={cafeToDisplay.coverImage || "/icons/icon-transparent.svg"} alt="Обложка кафе"/>

            <div id="cafe-info" className="cafe-info-container">
                <button
                    onClick={() => navigate('/select-location')}
                    className="header-button"
                >
                    <h1>{headerTitle}</h1>
                    <span className="material-symbols-rounded">arrow_drop_down</span>
                </button>
                <p id="cafe-kitchen-categories" className="cafe-kitchen-categories">{cafeToDisplay.kitchenCategories}</p>
                <div className="cafe-parameters-container">
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Время работы"/>
                        <div>
                            {formatOpeningHours(cafeToDisplay.openingHours).split(',').map((line, index) => (
                                <div key={index} className="cafe-parameter-value" style={{ opacity: 0.72 }}>
                                    {line.trim()}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div id="cafe-status" className="cafe-status" style={{ backgroundColor: cafeStatus.color }}>
                        {cafeStatus.status}
                    </div>
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Категории</h3>
                <div className="cafe-section-horizontal">
                    {isLoadingCafeData ? (
                        <>
                           {/* Шиммеры */}
                        </>
                    ) : (
                        Array.isArray(categories) && categories.length > 0 ? categories.map(category => (
                            <button
                                key={category.id}
                                className="cafe-category-container"
                                onClick={() => navigate(`/cafe/${cafeToDisplay.id}/category/${category.id}`)}
                                style={{ backgroundColor: category.backgroundColor || '#ccc' }}
                            >
                                <img className="cafe-category-icon" src={category.icon || "/icons/icon-transparent.svg"} alt={category.name + " иконка"}/>
                                <div
                                    className="cafe-category-name"
                                    style={{ color: getContrastingTextColor(category.backgroundColor || '#ccc') }}
                                >
                                    {category.name}
                                </div>
                            </button>
                        )) : <p style={{ paddingLeft: '16px' }}>Нет доступных категорий.</p>
                    )}
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Популярное</h3>
                <div className="cafe-section-horizontal">
                    {isLoadingCafeData ? (
                        <>
                           {/* Шиммеры */}
                        </>
                    ) : (
                        Array.isArray(popularItems) && popularItems.length > 0 ? popularItems.map(item => (
                            <MenuItemCard key={item.id} item={item} cafeId={cafeToDisplay.id} />
                        )) : <p style={{ paddingLeft: '16px' }}>Нет популярных товаров.</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HomePage;