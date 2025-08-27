// frontend_modern/src/pages/HomePage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getCafeById, getCafeCategories, getCafePopularMenu } from '../api';
import type { CafeSchema, CategorySchema, MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { getContrastingTextColor } from '../utils/colorUtils';
import { logger } from '../utils/logger';
import ErrorState from '../components/ErrorState';
import { getCafeStatus, formatOpeningHours } from '../utils/timeUtils';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { cafeId } = useParams<{ cafeId: string }>();
    const { items, getItemCount } = useCart();

    const [cafe, setCafe] = useState<CafeSchema | null>(null);
    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = useState<MenuItemSchema[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cafeStatus = useMemo(() => getCafeStatus(cafe?.openingHours), [cafe]);

    useEffect(() => {
        const loadAllData = async () => {
            if (!cafeId) {
                setError("ID кофейни не найден в URL.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // Загружаем всю информацию параллельно для ускорения
                const [cafeData, categoriesData, popularData] = await Promise.all([
                    getCafeById(cafeId),
                    getCafeCategories(cafeId),
                    getCafePopularMenu(cafeId),
                ]);
                setCafe(cafeData);
                setCategories(categoriesData || []);
                setPopularItems(popularData || []);
            } catch (err: any) {
                logger.error("Failed to load cafe page data:", err);
                setError(err.message || "Не удалось загрузить данные кофейни.");
            } finally {
                setIsLoading(false);
            }
        };
        loadAllData();
    }, [cafeId]);

    const handleMainButtonClick = useCallback(() => {
        if (getItemCount(items) > 0) {
            navigate('/cart');
        }
    }, [navigate, getItemCount, items]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            const positions = getItemCount(items);
            if (positions > 0) {
                let plural = 'ПОЗИЦИЙ';
                if (positions === 1) plural = 'ПОЗИЦИЯ';
                else if (positions > 1 && positions < 5) plural = 'ПОЗИЦИИ';
                const buttonText = `МОЯ КОРЗИНА • ${positions} ${plural}`;
                
                tg.MainButton.setText(buttonText).show();
                tg.MainButton.onClick(handleMainButtonClick);
                tg.MainButton.enable();
            } else {
                tg.MainButton.hide();
            }
            return () => {
                if (window.Telegram && window.Telegram.WebApp) {
                    tg.MainButton.offClick(handleMainButtonClick);
                }
            };
        }
    }, [handleMainButtonClick, getItemCount, items]);

    if (isLoading) {
        // Можно добавить более детальный шиммер/скелет
        return <section>Загрузка кофейни...</section>;
    }

    if (error) {
        // Кнопка "Попробовать снова" перезагрузит страницу для повторной попытки загрузки
        return <ErrorState message={error} onRetry={() => navigate(0)} />;
    }

    if (!cafe) {
        return <section>Кофейня не найдена.</section>;
    }

    return (
        <section>
            {/* Кнопка с логотипом теперь возвращает на стартовый экран выбора */}
            <div className="cafe-logo-container" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <img id="cafe-logo" className="cafe-logo" src={cafe.logoImage || "/icons/icon-transparent.svg"} alt="Логотип"/>
            </div>
            <img id="cafe-cover" className="cover" src={cafe.coverImage || "/icons/icon-transparent.svg"} alt="Обложка"/>

            <div id="cafe-info" className="cafe-info-container">
                 {/* Кнопка с названием также возвращает на экран выбора */}
                <button onClick={() => navigate('/')} style={{ padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <h1 style={{ marginRight: '4px' }}>{cafe.name}</h1>
                    <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--text-color)' }}>arrow_drop_down</span>
                </button>
                <p id="cafe-kitchen-categories" className="cafe-kitchen-categories">{cafe.kitchenCategories}</p>
                <div className="cafe-parameters-container">
                    <div className="cafe-parameter-container">
                        <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Время работы"/>
                        <div>
                            {formatOpeningHours(cafe.openingHours).split(',').map((line, index) => (
                                <div key={index} className="cafe-parameter-value" style={{ opacity: 0.72 }}>
                                    {line.trim()}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div id="cafe-status" className="cafe-status" style={{ backgroundColor: cafeStatus.color }}>
                        {cafeStatus.status}
                    </div>
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Категории</h3>
                <div className="cafe-section-horizontal">
                    {categories.map(category => (
                        <button key={category.id} className="cafe-category-container" onClick={() => navigate(`/cafe/${cafe.id}/category/${category.id}`)} style={{ backgroundColor: category.backgroundColor || '#ccc' }}>
                            <img className="cafe-category-icon" src={category.icon || "/icons/icon-transparent.svg"} alt={category.name + " иконка"}/>
                            <div className="cafe-category-name" style={{ color: getContrastingTextColor(category.backgroundColor || '#ccc') }}>{category.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 className="cafe-section-title">Популярное</h3>
                <div className="cafe-section-horizontal">
                    {popularItems.map(item => <MenuItemCard key={item.id} item={item} cafeId={cafe.id} />)}
                </div>
            </div>
        </section>
    );
};

export default HomePage;