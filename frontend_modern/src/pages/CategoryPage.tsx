// frontend_modern/src/pages/CategoryPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getCafeCategoryMenu } from '../api';
import type { MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { logger } from '../utils/logger';

const CategoryPage: React.FC = () => {
    const { cafeId, categoryId } = useParams<{ cafeId: string; categoryId: string }>();
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();
    
    const [menuItems, setMenuItems] = useState<MenuItemSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMenu = async () => {
            if (!cafeId || !categoryId) {
                setError("ID кофейни или категории отсутствует в URL.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const items = await getCafeCategoryMenu(cafeId, categoryId);
                setMenuItems(items || []);
            } catch (err: any) {
                logger.error("Failed to load menu:", err);
                setError(err.message || "Не удалось загрузить меню.");
            } finally {
                setLoading(false);
            }
        };
        loadMenu();
    }, [cafeId, categoryId]);

    const handleMainButtonClick = useCallback(() => {
        navigate('/cart');
    }, [navigate]);

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

    if (loading) {
        return (
            <section className="cafe-section-vertical">
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
            </section>
        );
    }

    if (error) {
        return <div>Ошибка загрузки меню: {error}</div>;
    }

    return (
        <section>
            <div id="cafe-category" className="cafe-section-vertical">
                {menuItems.length > 0 ? (
                    menuItems.map(item => (
                        <MenuItemCard key={item.id} item={item} cafeId={cafeId!} />
                    ))
                ) : (
                    <p>В этой категории нет товаров.</p>
                )}
            </div>
        </section>
    );
};

export default CategoryPage;