// frontend_modern/src/pages/CartPage.tsx
import React, { useEffect, useState, useCallback } from 'react'; // ОБЯЗАТЕЛЬНО ИМПОРТИРУЕМ React
import Lottie from 'lottie-react';
import type { OrderRequest, CartItemRequest } from '../api/types';

import { useCart } from '../store/cart';
import { toDisplayCost } from '../utils/currency';
import { createOrder, getCafeSettings } from '../api';
import emptyCartAnimation from '../assets/lottie/empty-cart.json';
import { TelegramSDK } from '../telegram/telegram';
import { useSnackbar } from '../components/Snackbar';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';

const CartPage: React.FC = () => { // ВОЗВРАЩАЕМ React.FC
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
                showSnackbar("Failed to load cafe settings. Please try again.", { style: 'error' });
            }
        };
        loadSettings();
    }, [selectedCafe, showSnackbar]);

    const handleCheckout = useCallback(async () => {
        const totalCost = getTotalCost(items);

        if (minOrderAmount > 0 && totalCost < minOrderAmount) {
            showSnackbar(
                `Order total is too low. Minimum order is ${toDisplayCost(minOrderAmount)}.`,
                { style: 'warning' }
            );
            TelegramSDK.notificationOccurred('warning');
            return;
        }

        if (isSubmitting || getItemCount(items) === 0) {
            logger.warn("Checkout already in progress or cart is empty.");
            return;
        }

        if (!selectedCafe) {
            showSnackbar("Please select a cafe before placing an order.", { style: 'error' });
            return;
        }

        if (window.Telegram && window.Telegram.WebApp) {
            const initData = TelegramSDK.getInitData();

            if (!initData) {
                TelegramSDK.showAlert("Error: Telegram user data is not available.");
                return;
            }

            TelegramSDK.setMainButtonLoading(true);
            setIsSubmitting(true);

            try {
                const cartItemsForRequest: CartItemRequest[] = items.map(item => ({
                    cafeItem: {
                        id: item.cafeItem.id,
                        name: item.cafeItem.name,
                    },
                    variant: {
                        id: item.variant.id,
                        name: item.variant.name,
                        cost: item.variant.cost,
                    },
                    quantity: item.quantity,
                    categoryId: item.categoryId,
                }));
                
                const orderData: OrderRequest = {
                    auth: initData,
                    cartItems: cartItemsForRequest,
                };

                const response = await createOrder(selectedCafe.id, orderData);
                logger.log("Order created successfully. Received invoice URL:", response.invoiceUrl);

                TelegramSDK.openInvoice(response.invoiceUrl, (status) => {
                    logger.log("Invoice status:", status);
                    if (status === 'paid') {
                        TelegramSDK.notificationOccurred('success');
                        clearCart();
                        TelegramSDK.close();
                    } else if (status === 'failed') {
                        TelegramSDK.notificationOccurred('error');
                        TelegramSDK.showAlert("Payment failed. Please try again.");
                    } else {
                        TelegramSDK.notificationOccurred('warning');
                        TelegramSDK.showAlert("Your order has been cancelled.");
                    }
                    TelegramSDK.setMainButtonLoading(false);
                    setIsSubmitting(false);
                });

            } catch (err: any) {
                logger.error("Failed to create order:", err);
                TelegramSDK.notificationOccurred('error');
                if (err.message && err.message.includes("Order total is too low")) {
                    showSnackbar(err.message, { style: 'error' });
                } else {
                    TelegramSDK.showAlert(err.message || "Failed to create order. Please try again later.");
                }
                TelegramSDK.setMainButtonLoading(false);
                setIsSubmitting(false);
            }
        } else {
            showSnackbar("Telegram Web App SDK is not available. Cannot proceed with checkout.", { style: 'error' });
        }
    }, [items, isSubmitting, selectedCafe, minOrderAmount, showSnackbar, getTotalCost, getItemCount, clearCart]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const totalCount = getItemCount(items);
            const totalCost = getTotalCost(items);

            if (totalCount > 0 && selectedCafe) {
                let buttonText = `CHECKOUT • ${toDisplayCost(totalCost)}`;
                let isButtonActive = true;

                if (minOrderAmount > 0 && totalCost < minOrderAmount) {
                    const amountNeeded = minOrderAmount - totalCost;
                    buttonText = `ADD ${toDisplayCost(amountNeeded)} TO CHECKOUT • MIN: ${toDisplayCost(minOrderAmount)}`;
                    isButtonActive = false;
                }

                tg.MainButton.setText(buttonText).show();
                tg.MainButton.onClick(handleCheckout);

                if (isButtonActive && !isSubmitting) {
                    tg.MainButton.enable();
                } else {
                    tg.MainButton.disable();
                }

            } else {
                tg.MainButton.hide();
            }

            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    const tg = window.Telegram.WebApp;
                    tg.MainButton.offClick(handleCheckout);
                }
            };
        }
    }, [getItemCount, getTotalCost, handleCheckout, isSubmitting, minOrderAmount, items, selectedCafe]);

    return (
        <section className="cart-items-container">
            <h2>Your Cart {selectedCafe ? `for ${selectedCafe.name}` : ''}</h2>

            {items.length === 0 ? (
                <div id="cart-empty-placeholder" className="cart-empty-placeholder">
                    <Lottie
                        animationData={emptyCartAnimation}
                        loop={true}
                        style={{ width: 150, height: 150 }}
                    />
                    <h3>Your cart is empty</h3>
                    <p>It's time to order something delicious!</p>
                </div>
            ) : (
                <div id="cart-items">
                    {items.map(item => (
                        <div key={`${item.cafeItem.id}-${item.variant.id}`} className="cart-item-container">
                            <img id="cart-item-image" className="cart-item-image" src={item.cafeItem.image || "/icons/icon-transparent.svg"} alt={item.cafeItem.name}/>
                            <div className="cart-item-info-container">
                                <h6 id="cart-item-name" className="cart-item-name">{item.cafeItem.name}</h6>
                                <p id="cart-item-description" className="small cart-item-description">{item.variant.name}</p>
                                <div id="cart-item-cost" className="cart-item-cost">
                                    {toDisplayCost(parseInt(item.variant.cost, 10) * item.quantity)}
                                </div>
                            </div>
                            <div className="cart-item-quantity-container">
                                <button id="cart-item-quantity-decrement" className="material-symbols-rounded icon-button small" onClick={() => decreaseQuantity(item.cafeItem.id, item.variant.id)}>remove</button>
                                <div id="cart-item-quantity" className="cart-item-quantity">{item.quantity}</div>
                                <button id="cart-item-quantity-increment" className="material-symbols-rounded icon-button small" onClick={() => increaseQuantity(item.cafeItem.id, item.variant.id)}>add</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default CartPage;