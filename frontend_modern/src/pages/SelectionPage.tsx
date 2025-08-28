import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCafe } from '../store/cafe';
import { useDelivery } from '../store/delivery';
import type { OrderType } from '../store/delivery';
import DeliveryAddressForm from '../components/DeliveryAddressForm';

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
    const { cafes, setSelectedCafeId } = useCafe();
    const { orderType, setOrderType } = useDelivery();
    const [activeTab, setActiveTab] = useState<OrderType>(orderType);

    const inStoreCafes = cafes.filter(c => !c.id.startsWith('delivery-'));
    const deliveryCafes = cafes.filter(c => c.id.startsWith('delivery-'));

    const handleCafeSelect = (cafeId: string) => {
        setSelectedCafeId(cafeId);
        setOrderType('in_store');
        navigate('/', { state: { selectedCafeId: cafeId } });
    };

    const handleAddressSave = (city: string) => {
        const cityId = transliterateCity(city); // <-- ИСПОЛЬЗУЕМ ТРАНСЛИТЕРАЦИЮ
        const deliveryCafe = deliveryCafes.find(c => c.id === `delivery-${cityId}`);
        
        if (deliveryCafe) {
            setSelectedCafeId(deliveryCafe.id);
            setOrderType('delivery');
            navigate('/', { state: { selectedCafeId: deliveryCafe.id } });
        } else {
            // Обработка случая, если доставка в город не найдена
            alert(`Доставка в ${city} временно недоступна.`);
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