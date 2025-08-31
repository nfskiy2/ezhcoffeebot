import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCafe } from '../store/cafe';
import { useDelivery } from '../store/delivery';
import type { OrderType } from '../store/delivery';
import DeliveryAddressForm from '../components/DeliveryAddressForm';
import { useCart } from '../store/cart'; 
import { TelegramSDK } from '../telegram/telegram'; 

const transliterateCity = (city: string): string => {
    const map: { [key: string]: string } = {
        'Томск': 'tomsk',
        'Северск': 'seversk',
        'Новосибирск': 'novosibirsk'
    };
    return map[city] || city.toLowerCase();
};

const SelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { cafes, selectedCafe, setSelectedCafeId } = useCafe();
    const { orderType, setOrderType } = useDelivery();
    const { getItemCount, clearCart } = useCart(); // Получаем функции из корзины
    const [activeTab, setActiveTab] = useState<OrderType>(orderType);

    const inStoreCafes = cafes.filter(c => !c.id.startsWith('delivery-'));
    const deliveryCafes = cafes.filter(c => c.id.startsWith('delivery-'));

    // Создаем универсальный обработчик смены кофейни
    const handleChangeCafe = useCallback((newCafeId: string, newOrderType: OrderType) => {
        // Проверяем, есть ли что-то в корзине и выбрана ли другая кофейня
        if (getItemCount() > 0 && selectedCafe && selectedCafe.id !== newCafeId) {
            TelegramSDK.showConfirm(
                "Смена кофейни приведёт к очистке корзины. Продолжить?",
                (confirmed) => {
                    if (confirmed) {
                        // Если пользователь согласен, чистим корзину и меняем кофейню
                        clearCart();
                        setOrderType(newOrderType);
                        setSelectedCafeId(newCafeId);
                        navigate('/');
                    }
                    // Если не согласен, ничего не делаем
                }
            );
        } else {
            // Если корзина пуста, просто меняем кофейню
            setOrderType(newOrderType);
            setSelectedCafeId(newCafeId);
            navigate('/');
        }
    }, [getItemCount, selectedCafe, clearCart, setOrderType, setSelectedCafeId, navigate]);

    const handleCafeSelect = (cafeId: string) => {
        handleChangeCafe(cafeId, 'in_store');
    };

    const handleAddressSave = (city: string) => {
        const cityId = transliterateCity(city);
        const deliveryCafe = deliveryCafes.find(c => c.id === `delivery-${cityId}`);
        
        if (deliveryCafe) {
            handleChangeCafe(deliveryCafe.id, 'delivery');
        } else {
            TelegramSDK.showAlert(`Доставка в г. ${city} временно недоступна.`);
        }
    };

    return (
        <section className="selection-page">
            <div className="tab-selector">
                <button
                    className={activeTab === 'in_store' ? 'active' : ''}
                    onClick={() => setActiveTab('in_store')}
                >
                    В зале
                </button>
                <button
                    className={activeTab === 'delivery' ? 'active' : ''}
                    onClick={() => setActiveTab('delivery')}
                >
                    Доставка
                </button>
            </div>

            <div className="selection-content">
                {activeTab === 'in_store' && (
                    <>
                        <h3 className="selection-title">Выберите кофейню</h3>
                        <div className="cafe-list">
                            {inStoreCafes.map(cafe => (
                                <button
                                    key={cafe.id}
                                    className="cafe-list-item"
                                    onClick={() => handleCafeSelect(cafe.id)}
                                >
                                    {cafe.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'delivery' && (
                    <DeliveryAddressForm onSave={handleAddressSave} />
                )}
            </div>
        </section>
    );
};

export default SelectionPage;