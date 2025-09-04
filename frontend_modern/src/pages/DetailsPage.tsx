import React, { useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCafeMenuItemDetails } from '../api';
import type { MenuItemSchema, MenuItemVariantSchema, AddonGroup, AddonItem, CartItem, SelectedAddon} from '../api/types';
import { toDisplayCost } from '../utils/currency';
import { useCart } from '../store/cart';
import { useSnackbar } from '../components/Snackbar';
import { TelegramSDK } from '../telegram/telegram';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import Accordion from '../components/Accordion';
import { getImageUrl } from '../utils/url'; // <-- 1. Импортируйте утилиту


const DetailsPage: React.FC = () => {
    const { cafeId, itemId } = useParams<{ cafeId: string; itemId: string }>();
    const { items: cartItems, addItem } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();
    const navigate = useNavigate();

    const [menuItem, setMenuItem] = useState<MenuItemSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<MenuItemVariantSchema | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [selectedAddons, setSelectedAddons] = useState<{ [key: string]: boolean }>({});

    const isCartNotEmpty = cartItems.length > 0;

    const handleAddonToggle = (addonId: string) => {
        setSelectedAddons(prev => ({ ...prev, [addonId]: !prev[addonId] }));
    };

    useEffect(() => {
        const loadDetails = async () => {
            if (!cafeId || !itemId) return;
            setLoading(true);
            setError(null);
            try {
                const item = await getCafeMenuItemDetails(cafeId, itemId);
                if (item && item.variants.length > 0) {
                    setMenuItem(item);
                    setSelectedVariant(item.variants[0]);
                } else if (item) {
                    setMenuItem(item);
                } else {
                    setError("Товар не найден.");
                }
            } catch (err: any) {
                logger.error("Failed to load item details:", err);
                setError(err.message || "Не удалось загрузить детали товара.");
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
        setQuantity(q => q + 1);
        TelegramSDK.impactOccurred('light');
    }, []);

    const handleDecreaseQuantity = useCallback(() => {
        setQuantity(q => (q > 1 ? q - 1 : 1));
        TelegramSDK.impactOccurred('light');
    }, []);

    const totalCost = useMemo(() => {
        if (!selectedVariant) return 0;
        let addonsCost = 0;
        if (menuItem?.addons) {
            for (const group of menuItem.addons) {
                for (const addon of group.items) {
                    if (selectedAddons[addon.id]) {
                        addonsCost += parseInt(addon.cost, 10);
                    }
                }
            }
        }
        const variantCost = parseInt(selectedVariant.cost, 10);
        return (variantCost + addonsCost) * quantity;
    }, [selectedVariant, selectedAddons, quantity, menuItem]);

    const handleAddToCart = useCallback(() => {
        if (menuItem && selectedVariant && quantity > 0 && selectedCafe) {
            const addonsList: SelectedAddon[] = [];
            if (menuItem.addons) {
                for (const group of menuItem.addons) {
                    for (const addon of group.items) {
                        if (selectedAddons[addon.id]) {
                            addonsList.push({ id: addon.id, name: addon.name, cost: addon.cost });
                        }
                    }
                }
            }

            const cartItemToAdd: CartItem = {
                cafeItem: {
                    id: menuItem.id,
                    name: menuItem.name || 'Неизвестный товар',
                    image: menuItem.image,
                },
                variant: selectedVariant,
                quantity: quantity,
                cafeId: selectedCafe.id,
                categoryId: menuItem.categoryId,
                selectedAddons: addonsList,
            };
            addItem(cartItemToAdd);
            setQuantity(1);
            setSelectedAddons({});
            showSnackbar('Успешно добавлено в корзину!', { style: 'success', backgroundColor: 'var(--success-color)' });
        } else {
            showSnackbar('Не удалось добавить товар. Пожалуйста, выберите опцию.', { style: 'warning' });
        }
    }, [menuItem, selectedVariant, quantity, selectedAddons, addItem, showSnackbar, selectedCafe]);

    useLayoutEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        if (menuItem && selectedVariant && quantity > 0) {
            const displayText = `ДОБАВИТЬ В КОРЗИНУ • ${toDisplayCost(totalCost)}`;
            if (tg.MainButton.text !== displayText) {
                tg.MainButton.hide();
            }
            tg.MainButton.setText(displayText);
            tg.MainButton.show();
            tg.MainButton.onClick(handleAddToCart);
            tg.MainButton.enable();
        } else {
            tg.MainButton.hide();
        }
        
        return () => {
            if (window.Telegram && window.Telegram.WebApp) {
                const tg_cleanup = window.Telegram.WebApp;
                tg_cleanup.MainButton.offClick(handleAddToCart);
                tg_cleanup.MainButton.hide();
            }
        };
    }, [menuItem, selectedVariant, quantity, handleAddToCart, totalCost]);

    if (loading) return <section>{/* Shimmer */}</section>;
    if (error) return <div>Ошибка: {error}</div>;
    if (!menuItem) return <div>Товар не найден.</div>;

    return (
        <section className="cafe-item-details-container">
            {/* ... JSX остается без изменений ... */}
            <div className="cafe-item-details-content">
                <img className="cover" src={getImageUrl(menuItem.image)} alt={menuItem.name || 'Товар'}/>
                <div className="cafe-item-details-title-container">
                    <h1 id="cafe-item-details-name">{menuItem.name}</h1>
                </div>
                {selectedVariant && (
                    <p id="cafe-item-details-selected-variant-weight" className="cafe-item-details-selected-variant-weight">
                        {selectedVariant.weight}
                    </p>
                )}
                <p className="cafe-item-details-description">{menuItem.description}</p>
                {menuItem.variants.length > 0 && (
                    <div className="cafe-item-details-section-price">
                        <div className="cafe-item-details-variants">
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
                            <h2 className="cafe-item-details-selected-variant-price">
                                {toDisplayCost(totalCost / quantity)}
                            </h2>
                        )}
                    </div>
                )}
                {menuItem.addons && menuItem.addons.length > 0 && (
                    <>
                        <h3 className="cafe-item-details-section-title">Добавки</h3>
                        {menuItem.addons.map((addonGroup: AddonGroup) => (
                            <Accordion key={addonGroup.id} title={addonGroup.name}>
                                {addonGroup.items.map((addon: AddonItem) => (
                                    <div key={addon.id} className="addon-item">
                                        <div>
                                            <span className="addon-item-name">{addon.name}</span>
                                            <span className="addon-item-price"> +{toDisplayCost(parseInt(addon.cost, 10))}</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!selectedAddons[addon.id]}
                                            onChange={() => handleAddonToggle(addon.id)}
                                        />
                                    </div>
                                ))}
                            </Accordion>
                        ))}
                    </>
                )}
            </div>
            <div className="cafe-item-details-quantity-selector-container">
                <button className="material-symbols-rounded icon-button" onClick={handleDecreaseQuantity}>remove</button>
                <h2 className="cafe-item-details-quantity-selector-value">{quantity}</h2>
                <button className="material-symbols-rounded icon-button" onClick={handleIncreaseQuantity}>add</button>
            </div>
            {isCartNotEmpty && (
                <button className="go-to-cart-fab" onClick={() => navigate('/cart')}>
                    <span className="material-symbols-rounded">shopping_cart</span>
                </button>
            )}
        </section>
    );
};

export default DetailsPage;