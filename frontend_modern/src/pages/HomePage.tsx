// frontend_modern/src/pages/HomePage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCafeCategories, getCafePopularMenu } from '../api';
import type { CategorySchema, MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { getContrastingTextColor } from '../utils/colorUtils';
import { useCafe } from '../store/cafe';
import { logger } from '../utils/logger';
import ErrorState from '../components/ErrorState';
import { getCafeStatus, formatOpeningHours } from '../utils/timeUtils';
import { useOrder, type FulfillmentMethod } from '../store/order'; // ИСПРАВЛЕНО
import AddressModal from '../components/AddressModal';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();
    const {
        selectedCafe,
        cafes,
        setSelectedCafeId,
        isLoading: isCafeLoading,
        error: cafeError,
        retryLoad: retryLoadCafes
    } = useCafe();

    const { fulfillmentMethod, setFulfillmentMethod, deliveryAddress } = useOrder();
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = useState<MenuItemSchema[]>([]);
    const [isLoadingCafeData, setIsLoadingCafeData] = useState(true);
    const cafeStatus = useMemo(() => getCafeStatus(selectedCafe?.openingHours), [selectedCafe]);

    useEffect(() => {
        const loadCafeSpecificData = async () => {
            if (!selectedCafe) {
                setCategories([]);
                setPopularItems([]);
                setIsLoadingCafeData(false);
                return;
            }
            setIsLoadingCafeData(true);
            try {
                const [categoriesData, popularData] = await Promise.all([
                    getCafeCategories(selectedCafe.id),
                    getCafePopularMenu(selectedCafe.id)
                ]);
                setCategories(categoriesData || []);
                setPopularItems(popularData || []);
            } catch (err: any) {
                logger.error("Failed to load cafe specific data:", err);
            } finally {
                setIsLoadingCafeData(false);
            }
        };
        loadCafeSpecificData();
    }, [selectedCafe]);

    const handleMainButtonClick = useCallback(() => {
        if (getItemCount(items) > 0) {
            navigate('/cart');
        }
    }, [navigate, getItemCount, items]);

    useEffect(() => {
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            const positions = getItemCount(items);
            if (positions > 0) {
                let plural = positions === 1 ? 'ПОЗИЦИЯ' : (positions > 1 && positions < 5 ? 'ПОЗИЦИИ' : 'ПОЗИЦИЙ');
                const buttonText = `МОЯ КОРЗИНА • ${positions} ${plural}`;
                tg.MainButton.setText(buttonText).show().onClick(handleMainButtonClick).enable();
            } else {
                tg.MainButton.hide();
            }
            return () => {
                tg.MainButton.offClick(handleMainButtonClick);
            };
        }
    }, [handleMainButtonClick, getItemCount, items]);

    const handleMethodSelect = (method: FulfillmentMethod) => {
        setFulfillmentMethod(method);
        if (method === 'delivery') {
            setIsAddressModalOpen(true);
        }
    };

    const getButtonStyle = (method: FulfillmentMethod): React.CSSProperties => ({
        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '15px', fontWeight: 500, transition: 'all 0.2s ease-out',
        color: fulfillmentMethod === method ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
        backgroundColor: fulfillmentMethod === method ? 'var(--tg-theme-button-color)' : 'transparent',
    });

    if (isCafeLoading) {
        return <section>{/* Shimmer/Loading UI */}</section>;
    }

    if (cafeError) {
        return <ErrorState message={cafeError} onRetry={retryLoadCafes} />;
    }

    if (!selectedCafe) {
        return (
            <section style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                    <h2 style={{ marginBottom: '16px' }}>Выберите кофейню</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {cafes.map(cafe => (
                            <button key={cafe.id} onClick={() => setSelectedCafeId(cafe.id)} style={{ width: '100%', textAlign: 'left', padding: '16px', backgroundColor: 'var(--popover-bg-color)', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '16px', fontWeight: 500, color: 'var(--text-color)', border: '1px solid var(--divider-color)', cursor: 'pointer' }}>
                                {cafe.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 style={{ marginBottom: '12px' }}>Способ получения</h3>
                    <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--popover-bg-color)', padding: '4px', borderRadius: '12px' }}>
                        <button style={getButtonStyle('takeaway')} onClick={() => handleMethodSelect('takeaway')}>Навынос</button>
                        <button style={getButtonStyle('dine-in')} onClick={() => handleMethodSelect('dine-in')}>В зале</button>
                        <button style={getButtonStyle('delivery')} onClick={() => handleMethodSelect('delivery')}>Доставка</button>
                    </div>
                     {fulfillmentMethod === 'delivery' && deliveryAddress && (
                        <div style={{marginTop: '12px', fontSize: '14px', opacity: 0.8, backgroundColor: 'var(--popover-bg-color)', padding: '10px', borderRadius: '8px'}}>
                            <span>Доставка на: {deliveryAddress.street}, {deliveryAddress.house}</span>
                            <button onClick={() => setIsAddressModalOpen(true)} style={{marginLeft: '8px', color: 'var(--tg-theme-link-color)', fontWeight: 500}}>Изменить</button>
                        </div>
                    )}
                </div>
                <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
            </section>
        );
    }

    return (
        <section>
            <div className="cafe-logo-container" onClick={() => setSelectedCafeId(null)} style={{ cursor: 'pointer' }}>
                <img id="cafe-logo" className="cafe-logo" src={selectedCafe.logoImage || "/icons/icon-transparent.svg"} alt="Логотип кафе"/>
            </div>
            <img id="cafe-cover" className="cover" src={selectedCafe.coverImage || "/icons/icon-transparent.svg"} alt="Обложка кафе"/>
            <div id="cafe-info" className="cafe-info-container">
                <button onClick={() => setSelectedCafeId(null)} style={{ padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <h1 style={{ marginRight: '4px' }}>{selectedCafe.name}</h1>
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--text-color)' }}>arrow_drop_down</span>
                </button>
                <p id="cafe-kitchen-categories" className="cafe-kitchen-categories">{selectedCafe.kitchenCategories}</p>
                <div className="cafe-parameters-container">
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Время работы"/>
                        <div>{formatOpeningHours(selectedCafe.openingHours).split(',').map((line, index) => (<div key={index} className="cafe-parameter-value">{line.trim()}</div>))}</div>
                    </div>
                    <div id="cafe-status" className="cafe-status" style={{ backgroundColor: cafeStatus.color }}>{cafeStatus.status}</div>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-color)', padding: '4px', borderRadius: '12px', border: '1px solid var(--divider-color)' }}>
                        <button style={getButtonStyle('takeaway')} onClick={() => handleMethodSelect('takeaway')}>Навынос</button>
                        <button style={getButtonStyle('dine-in')} onClick={() => handleMethodSelect('dine-in')}>В зале</button>
                        <button style={getButtonStyle('delivery')} onClick={() => handleMethodSelect('delivery')}>Доставка</button>
                    </div>
                     {fulfillmentMethod === 'delivery' && deliveryAddress && (
                        <div style={{marginTop: '12px', fontSize: '14px', opacity: 0.8}}>
                            <span>Доставка на: {deliveryAddress.street}, {deliveryAddress.house}</span>
                            <button onClick={() => setIsAddressModalOpen(true)} style={{marginLeft: '8px', color: 'var(--tg-theme-link-color)', fontWeight: 500}}>Изменить</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Категории</h3>
                <div className="cafe-section-horizontal">{isLoadingCafeData ? (<>...</>) : (categories.map(category => (
                    <button key={category.id} className="cafe-category-container" onClick={() => navigate(`/cafe/${selectedCafe.id}/category/${category.id}`)} style={{ backgroundColor: category.backgroundColor || '#ccc' }}>
                        <img className="cafe-category-icon" src={category.icon || "/icons/icon-transparent.svg"} alt={category.name + " иконка"}/>
                        <div className="cafe-category-name" style={{ color: getContrastingTextColor(category.backgroundColor || '#ccc') }}>{category.name}</div>
                    </button>)))}
                </div>
            </div>
            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Популярное</h3>
                <div className="cafe-section-horizontal">{isLoadingCafeData ? (<>...</>) : (popularItems.map(item => (
                    <MenuItemCard key={item.id} item={item} cafeId={selectedCafe.id} />)))}
                </div>
            </div>
            <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
        </section>
    );
};

export default HomePage;