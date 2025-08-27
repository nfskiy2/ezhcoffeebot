import React, { useState } from 'react';
import { useDelivery } from '../store/delivery';
import type { DeliveryAddress } from '../store/delivery';

interface DeliveryAddressFormProps {
    onSave: () => void;
}

const DeliveryAddressForm: React.FC<DeliveryAddressFormProps> = ({ onSave }) => {
    const { saveAddress, address: initialAddress, availableCities } = useDelivery();
    const [address, setAddress] = useState<DeliveryAddress>(
        initialAddress || { city: availableCities[0], street: '', house: '', apartment: '', comment: '' }
    );
    // Используем объект для хранения ошибок по каждому полю
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setAddress(prev => ({ ...prev, [name]: value }));
        // Сбрасываем ошибку для поля, которое пользователь начал редактировать
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};
        
        // Проверяем, что улица не пустая и не состоит только из пробелов
        if (!address.street.trim()) {
            newErrors.street = 'Пожалуйста, укажите улицу';
        }
        
        // Проверяем, что дом не пустой
        if (!address.house.trim()) {
            newErrors.house = 'Укажите номер дома';
        }

        setErrors(newErrors);
        // Форма валидна, если объект ошибок пуст
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validateForm()) {
            return; // Прерываем сохранение, если есть ошибки
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
            
            <input type="text" name="street" placeholder="Улица" value={address.street} onChange={handleChange} className={errors.street ? 'input-error' : ''} />
            {errors.street && <p className="form-error">{errors.street}</p>}

            <div className="form-row">
                <div>
                    <input type="text" name="house" placeholder="Дом" value={address.house} onChange={handleChange} className={errors.house ? 'input-error' : ''} />
                    {errors.house && <p className="form-error">{errors.house}</p>}
                </div>
                <input type="text" name="apartment" placeholder="Кв/Офис" value={address.apartment} onChange={handleChange} />
            </div>

            <input type="text" name="comment" placeholder="Комментарий для курьера" value={address.comment} onChange={handleChange} />
            
            <button className="save-button" onClick={handleSave}>Сохранить и выбрать</button>
        </div>
    );
};

export default DeliveryAddressForm;