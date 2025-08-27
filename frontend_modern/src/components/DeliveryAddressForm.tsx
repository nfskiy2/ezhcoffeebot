import React, { useState, useEffect } from 'react';
import { useDelivery } from '../store/delivery';
import type { DeliveryAddress } from '../store/delivery';
import { getAddressSuggestions } from '../api';
import type { AddressSuggestion } from '../api';

// Хук для "отложенного" выполнения функции (чтобы не слать запрос на каждое нажатие клавиши)
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

interface DeliveryAddressFormProps {
    onSave: () => void;
}

const DeliveryAddressForm: React.FC<DeliveryAddressFormProps> = ({ onSave }) => {
    const { saveAddress, address: initialAddress, availableCities } = useDelivery();
    const [address, setAddress] = useState<DeliveryAddress>(
        initialAddress || { city: availableCities[0], street: '', house: '', apartment: '', comment: '' }
    );
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Состояния для подсказок
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
    const debouncedStreetQuery = useDebounce(address.street, 500); // Задержка в 500 мс

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (debouncedStreetQuery.length < 3) { // Начинаем искать после 3-х символов
                setSuggestions([]);
                return;
            }
            setIsSuggestionsLoading(true);
            const result = await getAddressSuggestions(debouncedStreetQuery, address.city);
            setSuggestions(result);
            setIsSuggestionsLoading(false);
        };
        fetchSuggestions();
    }, [debouncedStreetQuery, address.city]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'house' || name === 'apartment') {
            if (/^\d*$/.test(value)) {
                setAddress(prev => ({ ...prev, [name]: value }));
            }
        } else {
            setAddress(prev => ({ ...prev, [name]: value }));
        }

        if (errors[name]) {
            setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        }
    };

    const handleSuggestionClick = (suggestion: AddressSuggestion) => {
        setAddress(prev => ({
            ...prev,
            street: suggestion.data.street_with_type || '',
            house: suggestion.data.house || ''
        }));
        setSuggestions([]); // Скрываем подсказки после выбора
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};
        if (!address.street.trim()) newErrors.street = 'Пожалуйста, укажите улицу';
        if (!address.house.trim()) newErrors.house = 'Укажите номер дома';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validateForm()) return;
        saveAddress(address);
        onSave();
    };

    return (
        <div className="delivery-address-form">
            <h3>Адрес доставки</h3>
            <select name="city" value={address.city} onChange={handleChange}>
                {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
            
            <div className="street-input-container">
                <input type="text" name="street" placeholder="Улица" value={address.street} onChange={handleChange} className={errors.street ? 'input-error' : ''} autoComplete="off" />
                {isSuggestionsLoading && <div className="spinner"></div>}
                {suggestions.length > 0 && (
                    <ul className="suggestions-list">
                        {suggestions.map((s, index) => (
                            <li key={index} onClick={() => handleSuggestionClick(s)}>
                                {s.value}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {errors.street && <p className="form-error">{errors.street}</p>}

            <div className="form-row">
                <div>
                    <input type="text" inputMode="numeric" name="house" placeholder="Дом" value={address.house} onChange={handleChange} className={errors.house ? 'input-error' : ''} />
                    {errors.house && <p className="form-error">{errors.house}</p>}
                </div>
                <input type="text" inputMode="numeric" name="apartment" placeholder="Кв/Офис" value={address.apartment} onChange={handleChange} />
            </div>

            <input type="text" name="comment" placeholder="Комментарий для курьера" value={address.comment} onChange={handleChange} />
            
            <button className="save-button" onClick={handleSave}>Сохранить и выбрать</button>
        </div>
    );
};

export default DeliveryAddressForm;