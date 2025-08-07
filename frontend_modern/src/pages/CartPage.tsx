// frontend_modern/src/pages/CartPage.tsx
import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react'; // Импортируем Lottie для анимации

// Импортируем хук для использования контекста корзины
import { useCart } from '../store/cart';
// Импортируем вспомогательную утилиту
import { toDisplayCost } from '../utils/currency';

// Импортируем функцию API для создания заказа
import { createOrder } from '../api';

// Импортируем JSON анимации
import emptyCartAnimation from '../assets/lottie/empty-cart.json'; 


const CartPage: React.FC = () => {
    // const navigate = useNavigate();
    const { items, increaseQuantity, decreaseQuantity, getItemCount, getTotalCost, clearCart } = useCart(); // Получаем функции и состояние из контекста

    const [isSubmitting, setIsSubmitting] = useState(false); // Состояние для блокировки кнопки при отправке


    // --- Логика оформления заказа (вызывается по клику на MainButton) ---
    const handleCheckout = async () => {
        if (isSubmitting || getItemCount(items) === 0) {
             console.warn("Checkout already in progress or cart is empty.");
             return; // Предотвращаем повторное нажатие
        }

         // Получаем initData из Telegram Web App SDK
         if (window.Telegram && window.Telegram.WebApp) {
             const tg = window.Telegram.WebApp;
             const initData = tg.initData;

             if (!initData) {
                 console.error("Telegram initData is missing. Cannot create order.");
                 // В реальном приложении, возможно, показать ошибку пользователю
                  // tg.showAlert("Error: Telegram user data is not available.");
                 return;
             }

             console.log("Creating order with initData:", initData);
             tg.MainButton.showProgress(true); // Показать индикатор загрузки на кнопке
             setIsSubmitting(true);

             try {
                 // Формируем данные для запроса к бэкенду
                 const orderData = {
                     _auth: initData, // Отправляем initData для валидации на бэкенде
                     cartItems: items, // Отправляем массив товаров из корзины
                 };

                 // Вызываем функцию API для создания заказа
                 const response = await createOrder(orderData);
                 console.log("Order created successfully. Received invoice URL:", response.invoiceUrl);

                 // Открываем инвойс для оплаты
                 tg.openInvoice(response.invoiceUrl, (status) => {
                     console.log("Invoice status:", status);
                     // Обрабатываем статус после закрытия окна инвойса
                     if (status === 'paid') {
                         // Если оплата прошла успешно
                          tg.HapticFeedback.notificationOccurred('success'); // Тактильный отклик
                         // Очищаем корзину
                         clearCart();
                         // Закрываем Mini App
                         tg.close();
                     } else if (status === 'failed') {
                         // Если оплата не удалась
                          tg.HapticFeedback.notificationOccurred('error');
                           tg.showAlert("Payment failed. Please try again.");
                     } else { // 'cancelled' или 'pending'
                         // Если пользователь отменил оплату
                          tg.HapticFeedback.notificationOccurred('warning');
                           tg.showAlert("Your order has been cancelled.");
                     }
                     // Скрываем индикатор загрузки на кнопке и разблокируем ее
                     tg.MainButton.hideProgress();
                     setIsSubmitting(false);
                 });

             } catch (err: any) {
                 console.error("Failed to create order:", err);
                  tg.HapticFeedback.notificationOccurred('error');
                  tg.showAlert(err.message || "Failed to create order. Please try again later.");
                 // Скрываем индикатор загрузки на кнопке и разблокируем ее
                  tg.MainButton.hideProgress();
                  setIsSubmitting(false);
             }

         } else {
              console.warn("Telegram Web App SDK is not available. Cannot proceed with checkout.");
               // Показать ошибку, что приложение должно быть запущено в Telegram
         }
    };


    // --- Хук useEffect для управления Telegram MainButton ("CHECKOUT") ---
    useEffect(() => {
         if (window.Telegram && window.Telegram.WebApp) {
              const tg = window.Telegram.WebApp;
              const totalCount = getItemCount(items);
              const totalCost = getTotalCost(items);

             if (totalCount > 0) {
                 // Если в корзине есть товары, показываем кнопку "Оформить заказ"
                 const buttonText = `CHECKOUT • ${toDisplayCost(totalCost)}`;
                 tg.MainButton.setText(buttonText).show();
                 tg.MainButton.onClick(handleCheckout);
                 // Если заказ не отправляется, кнопка активна
                 if (!isSubmitting) {
                     tg.MainButton.enable();
                 } else {
                      tg.MainButton.disable(); // Блокируем кнопку во время отправки
                 }
                  console.log(`MainButton shown for cart page with ${totalCount} items.`);
             } else {
                 // Если корзина пуста, скрываем кнопку
                 tg.MainButton.hide();
                  console.log("MainButton hidden on cart page (cart is empty).");
             }

             // Очистка при уходе со страницы
             return () => {
                 console.log("CartPage cleanup: removing MainButton handler.");
                 if (window.Telegram && window.Telegram.WebApp) {
                      const tg = window.Telegram.WebApp;
                      // Удаляем обработчик клика
                     tg.MainButton.offClick(handleCheckout);
                 }
             };
         }
         // Зависит от getItemCount, getTotalCost (которые зависят от items) и isSubmitting
    }, [getItemCount, getTotalCost, handleCheckout, isSubmitting]);


    // --- JSX для отображения содержимого страницы ---
    return (
         <section className="cart-items-container"> {/* Используем класс контейнера */}
             <h2>Your Cart</h2>

             {/* Проверяем, пуста ли корзина */}
             {items.length === 0 ? (
                 // Если корзина пуста, показываем анимацию и сообщение
                 <div id="cart-empty-placeholder" className="cart-empty-placeholder">
                     {/* Используем Lottie компонент */}
                     <Lottie
                         animationData={emptyCartAnimation} // JSON анимации
                         loop={true}
                         style={{ width: 150, height: 150 }} // Пример размера
                     />
                     <h3>Your cart is empty</h3>
                     <p>It's time to order something delicious!</p>
                 </div>
             ) : (
                 // Если в корзине есть товары, отображаем их список
                 <div id="cart-items">
                     {items.map(item => (
                         // Отображаем каждый товар в корзине
                         <div key={`${item.cafeItem.id}-${item.variant.id}`} className="cart-item-container">
                             {/* Изображение товара */}
                             <img id="cart-item-image" className="cart-item-image" src={item.cafeItem.image} alt={item.cafeItem.name}/>
                             {/* Информация о товаре */}
                             <div className="cart-item-info-container">
                                  {/* Название */}
                                 <h6 id="cart-item-name" className="cart-item-name">{item.cafeItem.name}</h6>
                                 {/* Выбранный вариант */}
                                 <p id="cart-item-description" className="small cart-item-description">{item.variant.name}</p>
                                  {/* Стоимость этого товара (цена за шт * количество) */}
                                 <div id="cart-item-cost" className="cart-item-cost">
                                     {toDisplayCost(parseInt(item.variant.cost, 10) * item.quantity)}
                                 </div>
                             </div>
                             {/* Элементы управления количеством */}
                             <div className="cart-item-quantity-container">
                                 {/* Кнопка уменьшения количества */}
                                 <button id="cart-item-quantity-decrement" className="material-symbols-rounded icon-button small" onClick={() => decreaseQuantity(item.cafeItem.id, item.variant.id)}>remove</button>
                                 {/* Текущее количество */}
                                 <div id="cart-item-quantity" className="cart-item-quantity">{item.quantity}</div>
                                 {/* Кнопка увеличения количества */}
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