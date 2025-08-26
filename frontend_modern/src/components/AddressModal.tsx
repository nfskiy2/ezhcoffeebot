// frontend_modern/src/components/AddressModal.tsx
import React, { useState, useEffect } from 'react';
import { useOrder, type DeliveryAddress } from '../store/order';

interface AddressModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose }) => {
    const { deliveryAddress, setDeliveryAddress } = useOrder();
    const [address, setAddress] = useState<DeliveryAddress>(
        deliveryAddress || { street: '', house: '', apartment: '', comment: '' }
    );

    useEffect(() => {
        // Обновляем состояние формы, если глобальный адрес изменился
        setAddress(deliveryAddress || { street: '', house: '', apartment: '', comment: '' });
    }, [deliveryAddress]);


    const handleSave = () => {
        setDeliveryAddress(address);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h3>Адрес доставки</h3>
                <input style={styles.input} placeholder="Улица" value={address.street} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input style={styles.input} placeholder="Дом" value={address.house} onChange={e => setAddress(p => ({ ...p, house: e.target.value }))} />
                    <input style={styles.input} placeholder="Кв/Офис" value={address.apartment} onChange={e => setAddress(p => ({ ...p, apartment: e.target.value }))} />
                </div>
                <input style={styles.input} placeholder="Комментарий для курьера" value={address.comment} onChange={e => setAddress(p => ({ ...p, comment: e.target.value }))} />
                <button style={styles.button} onClick={handleSave}>Сохранить</button>
            </div>
        </div>
    );
};

// Стили для простоты добавлены инлайн
const styles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { background: 'var(--popover-bg-color)', padding: '20px', borderRadius: '16px', width: 'calc(100% - 40px)', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' },
    input: { width: '100%', padding: '12px', border: '1px solid var(--divider-color)', borderRadius: '8px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '16px', boxSizing: 'border-box' },
    button: { padding: '14px', backgroundColor: 'var(--accent-color)', color: 'var(--on-accent-color)', borderRadius: '12px', fontSize: '16px', fontWeight: 500 }
};

export default AddressModal;