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
import { useOrder, type PackingOption } from '../store/order'; // Импортируем типы и хук

const CartPage: React.FC = () => {
    const { items, increaseQuantity, decreaseQuantity, getItemCount, getTotalCost, clearCart } = useCart();
    const { showSnackbar } = useSnackbar();
    const { selectedCafe } = useCafe();
    const { fulfillmentMethod, deliveryAddress, packingOption, setPackingOption } = useOrder();

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
                    fulfillmentMethod: fulfillmentMethod,
                    deliveryAddress: deliveryAddress,
                    // Передаем опцию упаковки только для заказов "в зале"
                    packingOption: fulfillmentMethod === 'dine-in' ? packingOption : null,
                };
                const response = await createOrder(selectedCafe.id, orderData);
                TelegramSDK.openInvoice(response.invoiceUrl, (status) => {
                    if (status === 'paid') {
                        clearCart();
                        TelegramSDK.close();
                    } else {
                        TelegramSDK.showAlert(status === 'failed' ? "Оплата не удалась." : "Заказ отменен.");
                    }
                    TelegramSDK.setMainButtonLoading(false);
                    setIsSubmitting(false);
                });
            } catch (err: any) {
                logger.error("Failed to create order:", err);
                TelegramSDK.showAlert(err.message || "Не удалось создать заказ.");
                TelegramSDK.setMainButtonLoading(false);
                setIsSubmitting(false);
            }
        }
    }, [items, isSubmitting, selectedCafe, minOrderAmount, showSnackbar, getTotalCost, getItemCount, clearCart, fulfillmentMethod, deliveryAddress, packingOption]);

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
                    buttonText = `ДОБАВЬТЕ ${toDisplayCost(amountNeeded)}`;
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

    const getPackingButtonStyle = (method: PackingOption): React.CSSProperties => ({
        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '15px', fontWeight: 500,
        color: packingOption === method ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
        backgroundColor: packingOption === method ? 'var(--tg-theme-button-color)' : 'transparent',
        border: `1px solid ${packingOption === method ? 'var(--tg-theme-button-color)' : 'var(--divider-color)'}`,
        transition: 'all 0.2s ease-out',
    });

    return (
        <section className="cart-items-container">
            <h2>Ваша корзина {selectedCafe ? `в "${selectedCafe.name}"` : ''}</h2>
            
            {/* --- Блок выбора упаковки (появляется только для заказов "В зале") --- */}
            {items.length > 0 && fulfillmentMethod === 'dine-in' && (
                <div style={{ padding: '0 16px 16px' }}>
                     <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Как приготовить заказ?</h3>
                     <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--popover-bg-color)', padding: '4px', borderRadius: '12px' }}>
                        <button style={getPackingButtonStyle('dine-in')} onClick={() => setPackingOption('dine-in')}>Здесь</button>
                        <button style={getPackingButtonStyle('takeaway')} onClick={() => setPackingOption('takeaway')}>С собой</button>
                    </div>
                </div>
            )}
            {/* -------------------------------------------------------------------- */}

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
                            <img className="cart-item-image" src={item.cafeItem.image || "/icons/icon-transparent.svg"} alt={item.cafeItem.name}/>
                            <div className="cart-item-info-container">
                                <h6>{item.cafeItem.name}</h6>
                                <p className="small cart-item-description">{item.variant.name}</p>
                                {/* ... (отображение добавок, если они есть) ... */}
                                <div className="cart-item-cost">
                                    {toDisplayCost(parseInt(item.variant.cost, 10) * item.quantity)}
                                </div>
                            </div>
                            <div className="cart-item-quantity-container">
                                <button className="material-symbols-rounded icon-button small" onClick={() => decreaseQuantity(item.cafeItem.id, item.variant.id)}>remove</button>
                                <div className="cart-item-quantity">{item.quantity}</div>
                                <button className="material-symbols-rounded icon-button small" onClick={() => increaseQuantity(item.cafeItem.id, item.variant.id)}>add</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default CartPage;