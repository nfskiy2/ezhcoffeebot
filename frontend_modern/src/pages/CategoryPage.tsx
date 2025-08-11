// frontend_modern/src/pages/CategoryPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getCategoryMenu } from '../api';
import type { MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard'; // Убедимся, что MenuItemCard импортирован

const CategoryPage: React.FC = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();

    const [menuItems, setMenuItems] = useState<MenuItemSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMenu = async () => {
            if (!categoryId) {
                setError("Category ID is missing in URL.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const items = await getCategoryMenu(categoryId);
                if (Array.isArray(items)) {
                    setMenuItems(items);
                } else {
                    const errorMessage = `API did not return an array for menu in category ${categoryId}.`;
                    setError(errorMessage);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load menu.");
            } finally {
                setLoading(false);
            }
        };

        loadMenu();

    }, [categoryId]);


    const handleMainButtonClick = useCallback(() => {
        navigate('/cart');
    }, [navigate]);


    useEffect(() => {
         if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
              const tg = window.Telegram.WebApp;
              const cartItemCount = getItemCount(items);

             if (cartItemCount > 0) {
                 const buttonText = `MY CART • ${cartItemCount} POSITION${cartItemCount > 1 ? 'S' : ''}`;
                 tg.MainButton.setText(buttonText).show();
                 tg.MainButton.onClick(handleMainButtonClick);
                 tg.MainButton.enable();
                 // console.log(`MainButton shown for category page with ${cartItemCount} items.`); // Удаляем console.log
             } else {
                 tg.MainButton.hide();
                 // console.log("MainButton hidden on category page (no items in cart)."); // Удаляем console.log
             }

             return () => {
                 // console.log("CategoryPage cleanup: removing MainButton handler."); // Удаляем console.log
                 if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
                      const tg = window.Telegram.WebApp;
                     tg.MainButton.offClick(handleMainButtonClick);
                 }
             };
         }
    }, [handleMainButtonClick, getItemCount, items]);


    if (loading) {
        // Здесь можно использовать шиммер-плейсхолдеры для двух колонок, как на главной
        return (
            <section className="cafe-section-vertical"> {/* Используем vertical для двух колонок */}
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
        return <div>Error loading menu: {error}</div>;
    }

    return (
        <section>
            {/* УДАЛЯЕМ ЗАГОЛОВОК "Menu for {categoryId}" */}
            {/* <h2>Menu for {categoryId}</h2> */}
            <div id="cafe-category" className="cafe-section-vertical"> {/* ИЗМЕНЯЕМ КЛАСС НА cafe-section-vertical */}
                {Array.isArray(menuItems) && menuItems.map(item => (
                     // Используем MenuItemCard для отображения элементов
                     <MenuItemCard key={item.id} item={item} />
                ))}
                 {Array.isArray(menuItems) && menuItems.length === 0 && !loading && !error && <p>No items found in this category.</p>}
            </div>
        </section>
    );
};

export default CategoryPage;