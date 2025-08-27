import React, { useState } from 'react';
import { useDelivery, type DeliveryAddress } from '../store/delivery';

interface DeliveryAddressFormProps {
    onSave: () => void;
}

const DeliveryAddressForm: React.FC<DeliveryAddressFormProps> = ({ onSave }) => {
    const { saveAddress, address: initialAddress, availableCities } = useDelivery();
    const [address, setAddress] = useState<DeliveryAddress>(
        initialAddress || { city: availableCities[0], street: '', house: '', apartment: '', comment: '' }
    );
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setAddress(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSave = () => {
        if (!address.street || !address.house) {
            setError('Пожалуйста, укажите улицу и дом');
            return;
        }
        saveAddress(address);
        onSave();
    };

    return (
        <div className="delivery-address-form">
            <h3>Адрес доставки</h3>
            <select name="city" value={address.city} onChange={handleChange}>
                {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                ))}
            </select>
            <input type="text" name="street" placeholder="Улица" value={address.street} onChange={handleChange} />
            <div className="form-row">
                <input type="text" name="house" placeholder="Дом" value={address.house} onChange={handleChange} />
                <input type="text" name="apartment" placeholder="Кв/Офис" value={address.apartment} onChange={handleChange} />
            </div>
            <input type="text" name="comment" placeholder="Комментарий для курьера" value={address.comment} onChange={handleChange} />
            {error && <p className="form-error">{error}</p>}
            <button className="save-button" onClick={handleSave}>Сохранить и выбрать</button>
        </div>
    );
};

export default DeliveryAddressForm;
