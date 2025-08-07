import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// Импортируем функцию API
import { getMenuItemDetails } from '../api';
// Импортируем типы
import type { MenuItemSchema, MenuItemVariantSchema } from '../api/types';

// Импортируем вспомогательную утилиту
import { toDisplayCost } from '../utils/currency';

// Импортируем хук корзины
import { useCart } from '../store/cart';


const DetailsPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const { addItem } = useCart();

    const [menuItem, setMenuItem] = useState<MenuItemSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedVariant, setSelectedVariant] = useState<MenuItemVariantSchema | null>(null);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        const loadDetails = async () => {
            if (!itemId) {
                setError("Item ID is missing in URL.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const item = await getMenuItemDetails(itemId);
                if (item && Array.isArray(item.variants) && item.variants.length > 0) {
                    setMenuItem(item);
                    setSelectedVariant(item.variants[0]);
                } else if (item) {
                     const errorMessage = `No variants found for item ${itemId}.`;
                     setError(errorMessage);
                     setMenuItem(item);
                } else {
                    const errorMessage = `API did not return valid data for item ${itemId}.`;
                    setError(errorMessage);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load item details.");
            } finally {
                setLoading(false);
            }
        };

        loadDetails();

    }, [itemId]);


    const handleSelectVariant = (variant: MenuItemVariantSchema) => {
        setSelectedVariant(variant);
        setQuantity(1);
    };

    const handleIncreaseQuantity = () => {
        setQuantity(prevQuantity => prevQuantity + 1);
    };

    const handleDecreaseQuantity = () => {
        setQuantity(prevQuantity => Math.max(1, prevQuantity - 1));
    };

    const handleAddToCart = useCallback(() => {
        if (menuItem && selectedVariant && quantity > 0) {
            console.log(`Adding item ${menuItem.name} (${selectedVariant.name}) x${quantity} to cart.`);
            addItem(menuItem, selectedVariant, quantity);
            setQuantity(1); // Сбрасываем количество после добавления
             // Можно добавить haptic feedback или snackbar
             if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             }
        } else {
             console.warn("Cannot add item to cart: missing item, variant, or quantity is zero.");
        }
    }, [menuItem, selectedVariant, quantity, addItem]);


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
        return <div>Loading item details for {itemId}...</div>;
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
                <img id="cafe-item-details-image" className="cover" src={menuItem.image} alt={menuItem.name}/>
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

            {/* --- ВРЕМЕННАЯ КНОПКА ДЛЯ ТЕСТИРОВАНИЯ В БРАУЗЕРЕ --- */}
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <button
                    style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#609F6D', color: 'white', border: 'none', borderRadius: '8px' }}
                    onClick={handleAddToCart}
                >
                    Add to Cart (Test)
                </button>
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