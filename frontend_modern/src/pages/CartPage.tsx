// frontend_modern/src/pages/CartPage.tsx
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

const CartPage: React.FC = () => {
    const { items, increaseQuantity, decreaseQuantity, getItemCount, getTotalCost, clearCart } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [minOrderAmount, setMinOrderAmount] = useState<number>(0);

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
                        cafeItem: item.cafeItem,
                        variant: item.variant,
                        quantity: item.quantity,
                        categoryId: item.categoryId,
                    })),
                };
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
                logger.error("Failed to create order:", err);
                TelegramSDK.showAlert(err.message || "Не удалось создать заказ. Попробуйте позже.");
                TelegramSDK.setMainButtonLoading(false);
                setIsSubmitting(false);
            }
        }
    }, [items, isSubmitting, selectedCafe, minOrderAmount, showSnackbar, getTotalCost, getItemCount, clearCart]);

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

    return (
        <section className="cart-items-container">
            <h2>Ваша корзина {selectedCafe ? `в "${selectedCafe.name}"` : ''}</h2>
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
                                <div className="cart-item-cost">
                                    {toDisplayCost(parseInt(item.variant.cost, 10) * item.quantity)}
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