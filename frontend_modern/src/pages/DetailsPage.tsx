// frontend_modern/src/pages/DetailsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getCafeMenuItemDetails } from '../api';
import type { MenuItemSchema, MenuItemVariantSchema, AddonGroup, AddonItem, CartItem, SelectedAddon} from '../api/types';
import { toDisplayCost } from '../utils/currency';
import { useCart } from '../store/cart';
import { useSnackbar } from '../components/Snackbar';
import { TelegramSDK } from '../telegram/telegram';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import Accordion from '../components/Accordion';

const DetailsPage: React.FC = () => {
    const { cafeId, itemId } = useParams<{ cafeId: string; itemId: string }>();
    const { addItem } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();

    const [menuItem, setMenuItem] = useState<MenuItemSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<MenuItemVariantSchema | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [selectedAddons, setSelectedAddons] = useState<{ [key: string]: boolean }>({});

    const handleAddonToggle = (addonId: string) => {
        setSelectedAddons(prev => ({
            ...prev,
            [addonId]: !prev[addonId]
        }));
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
            // Проходим по всем группам добавок
            for (const group of menuItem.addons) {
                // Проходим по всем добавкам в группе
                for (const addon of group.items) {
                    // Если добавка выбрана, прибавляем ее стоимость
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
                            addonsList.push({
                                id: addon.id,
                                name: addon.name,
                                cost: addon.cost,
                            });
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
                categoryId: menuItem.category_id,
                selectedAddons: addonsList,
            };
            addItem(cartItemToAdd);
            setQuantity(1);
            setSelectedAddons({}); // Сбрасываем выбор добавок
            showSnackbar('Успешно добавлено в корзину!', { style: 'success', backgroundColor: 'var(--success-color)' });
        } else {
            showSnackbar('Не удалось добавить товар. Пожалуйста, выберите опцию.', { style: 'warning' });
        }
    }, [menuItem, selectedVariant, quantity, selectedAddons, addItem, showSnackbar, selectedCafe]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (menuItem && selectedVariant && quantity > 0) {
                // const currentTotalCost = parseInt(selectedVariant.cost, 10) * quantity;
                const displayText = `ДОБАВИТЬ В КОРЗИНУ • ${toDisplayCost(totalCost)}`;
                tg.MainButton.setText(displayText).show();
                tg.MainButton.onClick(handleAddToCart);
                tg.MainButton.enable();
            } else {
                tg.MainButton.hide();
            }
            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    tg.MainButton.offClick(handleAddToCart);
                }
            };
        }
    }, [menuItem, selectedVariant, quantity, handleAddToCart, totalCost]);

    if (loading) return <section>{/* Shimmer */}</section>;
    if (error) return <div>Ошибка: {error}</div>;
    if (!menuItem) return <div>Товар не найден.</div>;

    return (
        <section className="cafe-item-details-container">
            <div className="cafe-item-details-content">
                <img className="cover" src={menuItem.image || "/icons/icon-transparent.svg"} alt={menuItem.name || 'Товар'}/>
                
                <div className="cafe-item-details-title-container">
                    <h1 id="cafe-item-details-name">{menuItem.name}</h1>
                </div>
                {selectedVariant && (
                    <p id="cafe-item-details-selected-variant-weight" className="cafe-item-details-selected-variant-weight">
                        {selectedVariant.weight}
                    </p>
                )}
                
                <p className="cafe-item-details-description">{menuItem.description}</p>
                
                {/* ИСПРАВЛЕННЫЙ БЛОК С ОПЦИЯМИ И ЦЕНОЙ */}
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
                        {selectedVariant && <h2 className="cafe-item-details-selected-variant-price">{toDisplayCost(parseInt(selectedVariant.cost, 10))}</h2>}
                    </div>
                )}
                
                {/* Здесь будет секция с добавками */}
                {menuItem.addons && menuItem.addons.length > 0 && (
                    <>
                        <h3 className="cafe-item-details-section-title">Добавки</h3>
                        {menuItem.addons.map((addonGroup: AddonGroup) => ( // <--- ЯВНО УКАЗЫВАЕМ ТИП
                            <Accordion key={addonGroup.id} title={addonGroup.name}>
                                {addonGroup.items.map((addon: AddonItem) => ( // <--- ЯВНО УКАЗЫВАЕМ ТИП
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
        </section>
    );
};

export default DetailsPage;
