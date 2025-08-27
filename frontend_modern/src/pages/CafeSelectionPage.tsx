// frontend_modern/src/pages/CafeSelectionPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCafe } from '../store/cafe';
import { useOrder, type FulfillmentMethod, type DeliveryAddress } from '../store/order';
import ErrorState from '../components/ErrorState';

const CafeSelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { cafes, isLoading, error, retryLoad, setSelectedCafeId } = useCafe();
    const {
        fulfillmentMethod,
        setFulfillmentMethod,
        deliveryAddress,
        setDeliveryAddress
    } = useOrder();

    const [localAddress, setLocalAddress] = useState<DeliveryAddress>(
        deliveryAddress || { street: '', house: '', apartment: '', comment: '' }
    );
    
    // Флаг, показывающий, что адрес введен и можно показать список кафе для доставки
    const [isAddressConfirmed, setIsAddressConfirmed] = useState(!!deliveryAddress);

    const handleMethodSelect = (method: FulfillmentMethod) => {
        setFulfillmentMethod(method);
    };

    const handleCafeSelect = (cafeId: string) => {
        setSelectedCafeId(cafeId);
        navigate(`/cafe/${cafeId}`);
    };
    
    const confirmAddress = () => {
        if(localAddress.street && localAddress.house) {
            setDeliveryAddress(localAddress);
            setIsAddressConfirmed(true);
        } else {
            // Можно показать уведомление
            alert("Пожалуйста, укажите улицу и дом");
        }
    };

    const getButtonStyle = (method: FulfillmentMethod): React.CSSProperties => ({
        flex: 1, padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 500,
        color: fulfillmentMethod === method ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
        backgroundColor: fulfillmentMethod === method ? 'var(--tg-theme-button-color)' : 'transparent',
        border: `1px solid ${fulfillmentMethod === method ? 'var(--tg-theme-button-color)' : 'var(--divider-color)'}`,
        transition: 'all 0.2s ease-out',
    });

    if (isLoading) return <section>Загрузка...</section>;
    if (error) return <ErrorState message={error} onRetry={retryLoad} />;

    return (
        <section style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--popover-bg-color)', padding: '4px', borderRadius: '12px' }}>
                <button style={getButtonStyle('dine-in')} onClick={() => handleMethodSelect('dine-in')}>В зале</button>
                <button style={getButtonStyle('delivery')} onClick={() => handleMethodSelect('delivery')}>Доставка</button>
            </div>

            {fulfillmentMethod === 'delivery' && !isAddressConfirmed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3>Адрес доставки</h3>
                    <input style={styles.input} placeholder="Улица" value={localAddress.street} onChange={e => setLocalAddress(p => ({ ...p, street: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input style={styles.input} placeholder="Дом" value={localAddress.house} onChange={e => setLocalAddress(p => ({ ...p, house: e.target.value }))} />
                        <input style={styles.input} placeholder="Кв/Офис" value={localAddress.apartment} onChange={e => setLocalAddress(p => ({ ...p, apartment: e.target.value }))} />
                    </div>
                    <button style={styles.button} onClick={confirmAddress}>Продолжить</button>
                </div>
            )}

            {(fulfillmentMethod === 'dine-in' || (fulfillmentMethod === 'delivery' && isAddressConfirmed)) && (
                 <div>
                    <h2 style={{ marginBottom: '16px' }}>
                        {fulfillmentMethod === 'delivery' ? 'Выберите кофейню для доставки' : 'Выберите кофейню'}
                    </h2>
                     {fulfillmentMethod === 'delivery' && isAddressConfirmed && (
                         <div style={{marginBottom: '16px', fontSize: '14px', opacity: 0.8}}>
                            <span>Доставка на: {deliveryAddress?.street}, {deliveryAddress?.house}</span>
                            <button onClick={() => setIsAddressConfirmed(false)} style={{marginLeft: '8px', color: 'var(--tg-theme-link-color)', fontWeight: 500}}>Изменить</button>
                        </div>
                     )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {cafes.map(cafe => (
                            <button key={cafe.id} onClick={() => handleCafeSelect(cafe.id)} style={styles.cafeButton}>
                                {cafe.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

// Стили для простоты
const styles: { [key: string]: React.CSSProperties } = {
    input: { width: '100%', padding: '12px', border: '1px solid var(--divider-color)', borderRadius: '8px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '16px', boxSizing: 'border-box' },
    button: { padding: '14px', backgroundColor: 'var(--accent-color)', color: 'var(--on-accent-color)', borderRadius: '12px', fontSize: '16px', fontWeight: 500 },
    cafeButton: { width: '100%', textAlign: 'left', padding: '16px', backgroundColor: 'var(--popover-bg-color)', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '16px', fontWeight: 500, color: 'var(--text-color)', border: '1px solid var(--divider-color)', cursor: 'pointer' }
};

export default CafeSelectionPage;
