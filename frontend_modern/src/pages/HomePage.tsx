import React, { useEffect, useCallback, useMemo } from 'react';
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
    const { items, getItemCount } = useCart();
    const { selectedCafe, isLoading: isCafeLoading, error: cafeError, retryLoad: retryLoadCafes } = useCafe();
    const { orderType, getFormattedAddress } = useDelivery();
    
    const [categories, setCategories] = React.useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = React.useState<MenuItemSchema[]>([]);
    const [isLoadingCafeData, setIsLoadingCafeData] = React.useState(true);

    const cafeStatus = useMemo(() => getCafeStatus(selectedCafe?.openingHours), [selectedCafe]);

    useEffect(() => {
        const loadCafeSpecificData = async () => {
            if (!selectedCafe) {
                setIsLoadingCafeData(false);
                return;
            }
            setIsLoadingCafeData(true);
            try {
                const [categoriesData, popularData] = await Promise.all([
                    getCafeCategories(selectedCafe.id),
                    getCafePopularMenu(selectedCafe.id)
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
    }, [selectedCafe]);

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
    const isDelivery = orderType === 'delivery' && formattedAddress;
    const headerTitle = isDelivery ? formattedAddress : selectedCafe?.name;
    const headerSubTitle = isDelivery ? `Готовит: ${selectedCafe?.name}` : null;

    if (isCafeLoading) {
        return <section>{/* Можете добавить здесь компонент-заглушку (шиммер) */}</section>;
    }

    if (cafeError) {
        return <ErrorState message={cafeError} onRetry={retryLoadCafes} />;
    }

    if (!selectedCafe) {
        return (
            <section className="selection-redirect">
                <h2>Добро пожаловать!</h2>
                <p>Пожалуйста, выберите кофейню или укажите адрес доставки, чтобы продолжить.</p>
                <button onClick={() => navigate('/select-location')}>Начать</button>
            </section>
        )
    }

    return (
        <section>
            <div className="cafe-logo-container" onClick={() => navigate('/select-location')} style={{ cursor: 'pointer' }}>
                <img id="cafe-logo" className="cafe-logo" src={selectedCafe.logoImage || "/icons/icon-transparent.svg"} alt="Логотип кафе"/>
            </div>
            <img id="cafe-cover" className="cover" src={selectedCafe.coverImage || "/icons/icon-transparent.svg"} alt="Обложка кафе"/>

            <div id="cafe-info" className="cafe-info-container">
                <button
                    onClick={() => navigate('/select-location')}
                    className="header-button"
                >
                    <div className="header-text-content">
                        <h1>{headerTitle}</h1>
                        {headerSubTitle && <p className="header-subtitle">{headerSubTitle}</p>}
                    </div>
                    <span className="material-symbols-rounded">arrow_drop_down</span>
                </button>
                <p id="cafe-kitchen-categories" className="cafe-kitchen-categories">{selectedCafe.kitchenCategories}</p>
                <div className="cafe-parameters-container">
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Время работы"/>
                        <div>
                            {formatOpeningHours(selectedCafe.openingHours).split(',').map((line, index) => (
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
                            <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                            <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                            <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                        </>
                    ) : (
                        Array.isArray(categories) && categories.length > 0 ? categories.map(category => (
                            <button
                                key={category.id}
                                className="cafe-category-container"
                                onClick={() => navigate(`/cafe/${selectedCafe.id}/category/${category.id}`)}
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
                            <div className="cafe-item-container"><div className="cafe-item-image shimmer"></div></div>
                            <div className="cafe-item-container"><div className="cafe-item-image shimmer"></div></div>
                        </>
                    ) : (
                        Array.isArray(popularItems) && popularItems.length > 0 ? popularItems.map(item => (
                            <MenuItemCard key={item.id} item={item} cafeId={selectedCafe.id} />
                        )) : <p style={{ paddingLeft: '16px' }}>Нет популярных товаров.</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HomePage;