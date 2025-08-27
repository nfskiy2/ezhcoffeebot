import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCafe } from '../store/cafe';
import { useDelivery } from '../store/delivery';
import type { OrderType } from '../store/delivery';
import DeliveryAddressForm from '../components/DeliveryAddressForm';

const SelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { cafes, setSelectedCafeId } = useCafe();
    const { orderType, setOrderType } = useDelivery();
    const [activeTab, setActiveTab] = useState<OrderType>(orderType);

    const handleCafeSelect = (cafeId: string) => {
        setSelectedCafeId(cafeId);
        setOrderType('in_store');
        navigate('/');
    };

    const handleAddressSave = () => {
        // Для доставки нам все равно нужно выбрать "базовую" кофейню для API
        // Выбираем первую из списка как кухню по умолчанию для доставок
        if (cafes.length > 0) {
            setSelectedCafeId(cafes[0].id);
        }
        setOrderType('delivery');
        navigate('/');
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
                            {cafes.map(cafe => (
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