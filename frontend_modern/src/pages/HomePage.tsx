// frontend_modern/src/pages/HomePage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCafeCategories, getCafePopularMenu } from '../api';
import type { CategorySchema, MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { getContrastingTextColor } from '../utils/colorUtils';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import ErrorState from '../components/ErrorState';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();
    const {
        selectedCafe,
        cafes,
        setSelectedCafeId,
        isLoading: isCafeLoading,
        error: cafeError,
        retryLoad: retryLoadCafes
    } = useCafe();

    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = useState<MenuItemSchema[]>([]);
    const [isLoadingCafeData, setIsLoadingCafeData] = useState(true);

    useEffect(() => {
        const loadCafeSpecificData = async () => {
            if (!selectedCafe) {
                setCategories([]);
                setPopularItems([]);
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
        const positions = getItemCount(items);
        if (positions > 0) {
            navigate('/cart');
        }
    }, [navigate, getItemCount, items]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const positions = getItemCount(items);
            if (positions > 0) {
                let plural = 'ПОЗИЦИЙ';
                if (positions === 1) plural = 'ПОЗИЦИЯ';
                else if (positions > 1 && positions < 5) plural = 'ПОЗИЦИИ';
                const buttonText = `МОЯ КОРЗИНА • ${positions} ${plural}`;
                tg.MainButton.setText(buttonText).show();
                tg.MainButton.onClick(handleMainButtonClick);
                tg.MainButton.enable();
            } else {
                tg.MainButton.hide();
            }
            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    tg.MainButton.offClick(handleMainButtonClick);
                }
            };
        }
    }, [handleMainButtonClick, getItemCount, items]);

    if (isCafeLoading) {
        return (
            <section>
                <div className="cafe-logo-container shimmer"></div>
                <img className="cover shimmer" alt="Загрузка..."/>
                <div className="cafe-info-container shimmer" style={{minHeight: '100px'}}></div>
                <div className="cafe-section-container">
                    <h3 className="cafe-section-title shimmer" style={{minWidth: '120px'}}></h3>
                    <div className="cafe-section-horizontal">
                        <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                        <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                        <div className="cafe-category-container shimmer" style={{width: '80px', height: '80px'}}></div>
                    </div>
                </div>
            </section>
        );
    }

    if (cafeError) {
        return <ErrorState message={cafeError} onRetry={retryLoadCafes} />;
    }

    if (!selectedCafe) {
        return (
            <section style={{ padding: '24px' }}>
                <h2 style={{ marginBottom: '16px' }}>Выберите кофейню</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cafes.map(cafe => (
                        <button
                            key={cafe.id}
                            onClick={() => setSelectedCafeId(cafe.id)}
                            style={{
                                width: '100%', textAlign: 'left', padding: '16px',
                                backgroundColor: 'var(--popover-bg-color)', borderRadius: '12px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '16px',
                                fontWeight: 500, color: 'var(--text-color)',
                                border: '1px solid var(--divider-color)', cursor: 'pointer',
                                transition: 'background-color 0.2s ease-out'
                            }}
                        >
                            {cafe.name}
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    // Основной рендеринг страницы
    return (
        <section>
            <div className="cafe-logo-container" onClick={() => setSelectedCafeId(null)} style={{ cursor: 'pointer' }}>
                <img id="cafe-logo" className="cafe-logo" src={selectedCafe.logoImage || "/icons/icon-transparent.svg"} alt="Логотип кафе"/>
            </div>
            <img id="cafe-cover" className="cover" src={selectedCafe.coverImage || "/icons/icon-transparent.svg"} alt="Обложка кафе"/>

            <div id="cafe-info" className="cafe-info-container">
                <button
                    onClick={() => setSelectedCafeId(null)}
                    style={{
                        padding: 0,
                        backgroundColor: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <h1 style={{ marginRight: '4px' }}>{selectedCafe.name}</h1>
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--text-color)' }}>arrow_drop_down</span>
                </button>
                <p id="cafe-kitchen-categories" className="cafe-kitchen-categories">{selectedCafe.kitchenCategories}</p>
                <div className="cafe-parameters-container">
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-star.svg" className="cafe-parameter-icon" alt="Рейтинг"/>
                        <div id="cafe-rating" className="cafe-parameter-value">{selectedCafe.rating}</div>
                    </div>
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Время работы"/>
                        <div id="cafe-cooking-time" className="cafe-parameter-value">{selectedCafe.openingHours}</div>
                    </div>
                    <div id="cafe-status" className="cafe-status">{selectedCafe.status}</div>
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
                        categories.length > 0 ? categories.map(category => (
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
                        popularItems.length > 0 ? popularItems.map(item => (
                            <MenuItemCard key={item.id} item={item} cafeId={selectedCafe.id} />
                        )) : <p style={{ paddingLeft: '16px' }}>Нет популярных товаров.</p>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HomePage;