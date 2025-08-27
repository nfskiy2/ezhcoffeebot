import React, { useEffect, useState, useCallback } from 'react';
import Lottie from 'lottie-react';
import type { OrderRequest } from '../api/types';
import { useCart } from '../store/cart';
import { toDisplayCost } from '../utils/currency';
import { createOrder, getCafeSettings } from '../api';
import emptyCartAnimation from '../assets/lottie/empty-cart.json';
import { TelegramSDK } from '../telegram/telegram';
import { useSnackbar } from '../components/Snackbar';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import { useDelivery } from '../store/delivery';

type PackagingType = 'dine-in' | 'take-away';

const CartPage: React.FC = () => {
    const { items, increaseQuantity, decreaseQuantity, getItemCount, getTotalCost, clearCart } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();
    const { orderType, getFormattedAddress } = useDelivery();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
    const [packaging, setPackaging] = useState<PackagingType>('take-away');

    useEffect(() => {
        const loadSettings = async () => {
            if (!selectedCafe) return;
            try {
                const settings = await getCafeSettings(selectedCafe.id);
                setMinOrderAmount(settings.minOrderAmount);
            } catch (err) {
                logger.error("Failed to load cafe settings:", err);
                showSnackbar("Не удалось загрузить настройки. Попробуйте позже.", { style: 'error' });
            }
        };
        loadSettings();
    }, [selectedCafe, showSnackbar]);

    const handleCheckout = useCallback(async () => {
        const totalCost = getTotalCost(items);
        if (minOrderAmount > 0 && totalCost < minOrderAmount) {
            showSnackbar(`Минимальная сумма заказа: ${toDisplayCost(minOrderAmount)}.`, { style: 'warning' });
            return;
        }
        if (isSubmitting || getItemCount(items) === 0 || !selectedCafe) return;

        if (window.Telegram && window.Telegram.WebApp) {
            const initData = TelegramSDK.getInitData();
            if (!initData) {
                TelegramSDK.showAlert("Ошибка: данные пользователя Telegram недоступны.");
                return;
            }

            TelegramSDK.setMainButtonLoading(true);
            setIsSubmitting(true);
            try {
                const orderData: OrderRequest = {
                    auth: initData,
                    cartItems: items.map(item => ({
                        cafeItem: { id: item.cafeItem.id, name: item.cafeItem.name },
                        variant: { id: item.variant.id, name: item.variant.name, cost: item.variant.cost },
                        quantity: item.quantity,
                        categoryId: item.categoryId, // <-- УБЕДИТЕСЬ, ЧТО ЭТА СТРОКА ЕСТЬ
                    })),
                };
                
                console.log('Отправляемые данные заказа:', JSON.stringify(orderData, null, 2));

                const response = await createOrder(selectedCafe.id, orderData);
                TelegramSDK.openInvoice(response.invoiceUrl, (status) => {
                    if (status === 'paid') {
                        clearCart();
                        TelegramSDK.close();
                    } else if (status === 'failed') {
                        TelegramSDK.showAlert("Оплата не удалась. Пожалуйста, попробуйте снова.");
                    } else {
                        TelegramSDK.showAlert("Ваш заказ был отменен.");
                    }
                    TelegramSDK.setMainButtonLoading(false);
                    setIsSubmitting(false);
                });
            } catch (err: any) {
                logger.error("Error creating order:", err);
                // Улучшенное отображение ошибки для пользователя
                const errorMessage = err.response?.data?.detail?.[0]?.message || err.message || "Не удалось создать заказ. Попробуйте позже.";
                TelegramSDK.showAlert(errorMessage);
                TelegramSDK.setMainButtonLoading(false);
                setIsSubmitting(false);
            }
        }
    }, [items, isSubmitting, selectedCafe, minOrderAmount, showSnackbar, getTotalCost, getItemCount, clearCart, packaging]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const totalCount = getItemCount(items);
            const totalCost = getTotalCost(items);

            if (totalCount > 0 && selectedCafe) {
                let buttonText = `ОФОРМИТЬ • ${toDisplayCost(totalCost)}`;
                let isButtonActive = true;
                if (minOrderAmount > 0 && totalCost < minOrderAmount) {
                    const amountNeeded = minOrderAmount - totalCost;
                    buttonText = `ДОБАВЬТЕ ${toDisplayCost(amountNeeded)} • МИН: ${toDisplayCost(minOrderAmount)}`;
                    isButtonActive = false;
                }
                tg.MainButton.setText(buttonText).show();
                tg.MainButton.onClick(handleCheckout);
                if (isButtonActive && !isSubmitting) tg.MainButton.enable();
                else tg.MainButton.disable();
            } else {
                tg.MainButton.hide();
            }
            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    tg.MainButton.offClick(handleCheckout);
                }
            };
        }
    }, [items, isSubmitting, selectedCafe, minOrderAmount, handleCheckout, getItemCount, getTotalCost]);

    const formattedAddress = getFormattedAddress();

    return (
        <section className="cart-page-container">
            <h2>Ваша корзина</h2>

            <div className="order-info-summary">
                {orderType === 'delivery' && formattedAddress ? (
                    <div className="info-row">
                        <span className="material-symbols-rounded">delivery_dining</span>
                        <span>Доставка на: <strong>{formattedAddress}</strong></span>
                    </div>
                ) : (
                    <div className="info-row">
                        <span className="material-symbols-rounded">storefront</span>
                        <span>Самовывоз из: <strong>{selectedCafe?.name}</strong></span>
                    </div>
                )}
                <div className="info-row packaging-selector">
                    <span className="material-symbols-rounded">lunch_dining</span>
                    <div className="tab-selector small">
                        <button className={packaging === 'dine-in' ? 'active' : ''} onClick={() => setPackaging('dine-in')}>В зале</button>
                        <button className={packaging === 'take-away' ? 'active' : ''} onClick={() => setPackaging('take-away')}>С собой</button>
                    </div>
                </div>
            </div>

            {items.length === 0 ? (
                <div id="cart-empty-placeholder" className="cart-empty-placeholder">
                    <Lottie animationData={emptyCartAnimation} loop={true} style={{ width: 150, height: 150 }}/>
                    <h3>Ваша корзина пуста</h3>
                    <p>Самое время заказать что-нибудь вкусное!</p>
                </div>
            ) : (
                <div id="cart-items">
                    {items.map(item => (
                        <div key={`${item.cafeItem.id}-${item.variant.id}`} className="cart-item-container">
                            <img 
                                className="cart-item-image" 
                                src={item.cafeItem.image || "/icons/icon-transparent.svg"} 
                                alt={item.cafeItem.name}
                            />
                            <div className="cart-item-info-container">
                                <h6>{item.cafeItem.name}</h6>
                                <p className="small cart-item-description">{item.variant.name}</p>
                                {item.selectedAddons && item.selectedAddons.length > 0 && (
                                    <div className="cart-item-addons">
                                        {item.selectedAddons.map(addon => (
                                            <span key={addon.id}>+ {addon.name}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="cart-item-cost">
                                    {toDisplayCost(
                                        (parseInt(item.variant.cost, 10) + 
                                        (item.selectedAddons?.reduce((sum, addon) => sum + parseInt(addon.cost, 10), 0) || 0)) * item.quantity
                                    )}
                                </div>
                            </div>
                            <div className="cart-item-quantity-container">
                                <button 
                                    className="material-symbols-rounded icon-button small" 
                                    onClick={() => decreaseQuantity(item.cafeItem.id, item.variant.id)}
                                >
                                    remove
                                </button>
                                <div className="cart-item-quantity">{item.quantity}</div>
                                <button 
                                    className="material-symbols-rounded icon-button small" 
                                    onClick={() => increaseQuantity(item.cafeItem.id, item.variant.id)}
                                >
                                    add
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default CartPage;