// frontend_modern/src/pages/DetailsPage.tsx
import React, { useEffect, useState, useCallback } from 'react'; // ОБЯЗАТЕЛЬНО ИМПОРТИРУЕМ React
import { useParams } from 'react-router-dom';

import { getCafeMenuItemDetails } from '../api';
import type { MenuItemSchema, MenuItemVariantSchema } from '../api/types';
import type { CartItem } from '../store/cart'; // ИМПОРТИРУЕМ CartItem из cart.tsx
import { toDisplayCost } from '../utils/currency';
import { useCart } from '../store/cart';
import { useSnackbar } from '../components/Snackbar';
import { TelegramSDK } from '../telegram/telegram';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';

const DetailsPage: React.FC = () => { // ВОЗВРАЩАЕМ React.FC
    const { cafeId, itemId } = useParams<{ cafeId: string; itemId: string }>();
    const { addItem } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();

    const [menuItem, setMenuItem] = useState<MenuItemSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedVariant, setSelectedVariant] = useState<MenuItemVariantSchema | null>(null);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        const loadDetails = async () => {
            if (!cafeId || !itemId) {
                logger.error("Cafe ID or Item ID is missing in URL.");
                setError("Cafe ID or Item ID is missing in URL.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const item = await getCafeMenuItemDetails(cafeId, itemId);
                if (item && Array.isArray(item.variants) && item.variants.length > 0) {
                    setMenuItem(item);
                    setSelectedVariant(item.variants[0]);
                } else if (item) {
                    logger.warn(`No variants found for item ${itemId} of cafe ${cafeId}.`);
                    setMenuItem(item);
                } else {
                    const errorMessage = `API did not return valid data for item ${itemId} of cafe ${cafeId}.`;
                    logger.error(errorMessage);
                    setError(errorMessage);
                }
            } catch (err: any) {
                logger.error("Failed to load item details:", err);
                setError(err.message || "Failed to load item details.");
            } finally {
                setLoading(false);
            }
        };

        loadDetails();

    }, [cafeId, itemId]);

    const handleSelectVariant = useCallback((variant: MenuItemVariantSchema) => {
        setSelectedVariant(variant);
        setQuantity(1);
        TelegramSDK.impactOccurred('light');
    }, []);

    const handleIncreaseQuantity = useCallback(() => {
        setQuantity(prevQuantity => prevQuantity + 1);
        TelegramSDK.impactOccurred('light');
    }, []);

    const handleDecreaseQuantity = useCallback(() => {
        setQuantity(prevQuantity => {
            if (prevQuantity > 1) {
                TelegramSDK.impactOccurred('light');
                return prevQuantity - 1;
            }
            return 1;
        });
    }, []);

    const handleAddToCart = useCallback(() => {
        if (menuItem && selectedVariant && quantity > 0) {
            if (selectedCafe) {
                const cartItemToAdd: CartItem = {
                    cafeItem: {
                        id: menuItem.id,
                        name: menuItem.name || 'Unknown Item',
                        image: menuItem.image || '/icons/icon-transparent.svg',
                    },
                    variant: {
                        id: selectedVariant.id,
                        name: selectedVariant.name,
                        cost: selectedVariant.cost,
                    },
                    quantity: quantity,
                    cafeId: selectedCafe.id,
                    categoryId: menuItem.category_id,
                };
                addItem(cartItemToAdd);
                setQuantity(1);

                showSnackbar('Successfully added to cart!', { style: 'success', backgroundColor: 'var(--success-color)' });
                TelegramSDK.notificationOccurred('success');
            } else {
                showSnackbar('Please select a cafe first.', { style: 'warning' });
            }
        } else {
            showSnackbar('Could not add item to cart. Please select an option and quantity.', { style: 'warning' });
        }
    }, [menuItem, selectedVariant, quantity, addItem, showSnackbar, selectedCafe]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
            const tg = window.Telegram.WebApp;

            if (menuItem && selectedVariant && quantity > 0) {
                const currentTotalCost = parseInt(selectedVariant.cost, 10) * quantity;
                const displayText = `ADD TO CART • ${toDisplayCost(currentTotalCost)}`;

                tg.MainButton.setText(displayText).show();
                tg.MainButton.onClick(handleAddToCart);
                tg.MainButton.enable();
            } else {
                tg.MainButton.hide();
                tg.MainButton.offClick(handleAddToCart);
            }
        }

        return () => {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
                const tg = window.Telegram.WebApp;
                tg.MainButton.hide();
                tg.MainButton.offClick(handleAddToCart);
            }
        };
    }, [menuItem, selectedVariant, quantity, handleAddToCart]);

    if (loading) {
        return (
            <section className="cafe-item-details-container">
                <img id="cafe-item-details-image" className="cover shimmer" src="/icons/icon-transparent.svg" alt="Loading"/>
                <div className="cafe-item-details-title-container">
                    <h1 id="cafe-item-details-name" className="shimmer" style={{minWidth: '60%'}}></h1>
                    <p id="cafe-item-details-selected-variant-weight" className="shimmer" style={{minWidth: '30%'}}></p>
                </div>
                <p id="cafe-item-details-description" className="cafe-item-details-description shimmer" style={{minHeight: '3em', minWidth: '90%'}}></p>
                <h3 id="cafe-item-details-section-title" className="cafe-item-details-section-title shimmer" style={{minWidth: '50%'}}></h3>
                <div className="cafe-item-details-section-price">
                    <div id="cafe-item-details-variants" className="cafe-item-details-variants">
                        <button className="cafe-item-details-variant shimmer" style={{minWidth: '60px'}}></button>
                        <button className="cafe-item-details-variant shimmer" style={{minWidth: '80px'}}></button>
                    </div>
                    <h2 id="cafe-item-details-selected-variant-price" className="shimmer" style={{minWidth: '30px'}}></h2>
                </div>
                <div className="cafe-item-details-quantity-selector-container">
                    <button className="material-symbols-rounded icon-button shimmer" style={{opacity: 0.1}}>remove</button>
                    <h2 className="cafe-item-details-quantity-selector-value shimmer" style={{minWidth: '40px'}}></h2>
                    <button className="material-symbols-rounded icon-button shimmer" style={{opacity: 0.1}}>add</button>
                </div>
            </section>
        );
    }

    if (error) {
        return <div>Error loading item details: {error}</div>;
    }

    if (!menuItem) {
        return <div>Item not found.</div>;
    }

    return (
        <section className="cafe-item-details-container">
            <div className="cafe-item-details-content">
                <img id="cafe-item-details-image" className="cover" src={menuItem.image || "/icons/icon-transparent.svg"} alt={menuItem.name || 'Menu Item'}/>
                <div className="cafe-item-details-title-container">
                    <h1 id="cafe-item-details-name">{menuItem.name}</h1>
                    {selectedVariant && (
                        <p id="cafe-item-details-selected-variant-weight" className="cafe-item-details-selected-variant-weight small">{selectedVariant.weight}</p>
                    )}
                </div>
                <p id="cafe-item-details-description" className="cafe-item-details-description small">{menuItem.description}</p>
                <h3 id="cafe-item-details-section-title" className="cafe-item-details-section-title">Options</h3>
                <div className="cafe-item-details-section-price">
                    <div id="cafe-item-details-variants" className="cafe-item-details-variants">
                        {menuItem.variants.map(variant => (
                            <button
                                key={variant.id}
                                className={`cafe-item-details-variant ${selectedVariant?.id === variant.id ? 'selected' : ''}`}
                                onClick={() => handleSelectVariant(variant)}
                            >
                                {variant.name}
                            </button>
                        ))}
                    </div>
                    {selectedVariant && (
                        <h2 id="cafe-item-details-selected-variant-price" className="cafe-item-details-selected-variant-price">
                            {toDisplayCost(parseInt(selectedVariant.cost, 10))}
                        </h2>
                    )}
                </div>
            </div>

            <div className="cafe-item-details-quantity-selector-container">
                <button id="cafe-item-details-quantity-decrease-button" className="material-symbols-rounded icon-button" onClick={handleDecreaseQuantity}>remove</button>
                <h2 id="cafe-item-details-quantity-value" className="cafe-item-details-quantity-selector-value">{quantity}</h2>
                <button id="cafe-item-details-quantity-increase-button" className="material-symbols-rounded icon-button" onClick={handleIncreaseQuantity}>add</button>
            </div>
        </section>
    );
};

export default DetailsPage;