// frontend_modern/src/pages/CategoryPage.tsx
import * as React from 'react'; // Use * as React
import { useEffect, useState, useCallback } from 'react'; // Explicitly import hooks
import { useParams, useNavigate } from 'react-router-dom';

import { getCafeCategoryMenu } from '../api';
import type { MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { useCafe } from '../store/cafe'; // Keep useCafe for context access
import { logger } from '../utils/logger'; // Import logger

const CategoryPage: React.FC = () => {
    const { cafeId, categoryId } = useParams<{ cafeId: string; categoryId: string }>();
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();
    const { selectedCafe } = useCafe(); // Keep selectedCafe if you want to display cafe name for context

    const [menuItems, setMenuItems] = useState<MenuItemSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMenu = async () => {
            if (!cafeId || !categoryId) {
                logger.error("Cafe ID or Category ID is missing in URL.");
                setError("Cafe ID or Category ID is missing in URL.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const items = await getCafeCategoryMenu(cafeId, categoryId);
                if (Array.isArray(items)) {
                    setMenuItems(items);
                } else {
                    const errorMessage = `API did not return an array for menu in category ${categoryId} for cafe ${cafeId}.`;
                    logger.error(errorMessage);
                    setError(errorMessage);
                }
            } catch (err: any) {
                logger.error("Failed to load menu:", err);
                setError(err.message || "Failed to load menu.");
            } finally {
                setLoading(false);
            }
        };

        loadMenu();

    }, [cafeId, categoryId]); // Dependencies: cafeId and categoryId

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
        return <div>Error loading menu: {error}</div>;
    }

    return (
         <section>
            <div id="cafe-category" className="cafe-section-vertical">
                {Array.isArray(menuItems) && menuItems.map(item => (
                     // cafeId! is safe here because of the initial check in useEffect
                     <MenuItemCard key={item.id} item={item} cafeId={cafeId!} />
                ))}
                 {Array.isArray(menuItems) && menuItems.length === 0 && !loading && !error && <p>No items found in this category.</p>}
            </div>
        </section>
    );
};

export default CategoryPage;