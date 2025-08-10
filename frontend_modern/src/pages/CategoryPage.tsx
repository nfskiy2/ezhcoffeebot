import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getCategoryMenu } from '../api';
import type { MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';


const CategoryPage: React.FC = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const navigate = useNavigate();
    const { items, getItemCount } = useCart(); // Получаем items и getItemCount

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
              const cartItemCount = getItemCount(items); // <-- Передаем items

             if (cartItemCount > 0) {
                 const buttonText = `MY CART • ${cartItemCount} POSITION${cartItemCount > 1 ? 'S' : ''}`;
                 tg.MainButton.setText(buttonText).show();
                 tg.MainButton.onClick(handleMainButtonClick);
                 tg.MainButton.enable();
             } else {
                 tg.MainButton.hide();
             }

             return () => {
                 if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
                      const tg = window.Telegram.WebApp;
                     tg.MainButton.offClick(handleMainButtonClick);
                 }
             };
         }
    }, [handleMainButtonClick, getItemCount, items]); // <-- Добавлена зависимость items


    if (loading) {
        return <div>Loading menu for {categoryId}...</div>;
    }

    if (error) {
        return <div>Error loading menu: {error}</div>;
    }

    return (
        <section>
            <h2>Menu for {categoryId}</h2>
            <div id="cafe-category" className="cafe-section-column">
                {Array.isArray(menuItems) && menuItems.map(item => (
                     <button
                        key={item.id}
                        className="cafe-item-container"
                        onClick={() => navigate(`/details/${item.id}`)}
                     >
                         <img className="cafe-item-image" src={item.image} alt={item.name}/>
                         <h6 className="cafe-item-name">{item.name}</h6>
                         <p className="small cafe-item-description">{item.description}</p>
                     </button>
                ))}
                 {Array.isArray(menuItems) && menuItems.length === 0 && !loading && !error && <p>No items found in this category.</p>}
            </div>
        </section>
    );
};

export default CategoryPage;