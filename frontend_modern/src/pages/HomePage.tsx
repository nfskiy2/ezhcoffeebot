// frontend_modern/src/pages/HomePage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Импортируем функцию API
import { getCafeInfo, getCategories, getCategoryMenu } from '../api'; // Добавляем getCategoryMenu
// Импортируем типы
import type { CafeInfoSchema, CategorySchema, MenuItemSchema } from '../api/types'; // Добавляем MenuItemSchema
// Импортируем хук корзины
import { useCart } from '../store/cart';
// Импортируем компонент для карточки товара
import MenuItemCard from '../components/MenuItemCard'; // Добавляем импорт MenuItemCard

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { items, getItemCount } = useCart();

    const [cafeInfo, setCafeInfo] = useState<CafeInfoSchema | null>(null);
    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [popularItems, setPopularItems] = useState<MenuItemSchema[]>([]); // НОВОЕ СОСТОЯНИЕ для популярных товаров
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                console.log("Attempting to load home page data...");
                const [infoData, categoriesData, popularData] = await Promise.all([ // Добавляем popularData
                    getCafeInfo(),
                    getCategories(),
                    getCategoryMenu('popular') // НОВЫЙ ВЫЗОВ API для популярных товаров (эндпоинт /menu/popular)
                ]);

                console.log("Cafe Info data received:", infoData);
                console.log("Categories data received:", categoriesData);
                console.log("Popular items data received:", popularData); // Логирование

                if (Array.isArray(categoriesData) && Array.isArray(popularData)) { // Проверяем оба массива
                    setCafeInfo(infoData);
                    setCategories(categoriesData);
                    setPopularItems(popularData); // Сохраняем популярные товары
                    console.log("Data successfully loaded and set.");
                } else {
                    const errorMessage = "API did not return an array for categories or popular items.";
                    console.error(errorMessage, categoriesData, popularData);
                    setError(errorMessage);
                }

            } catch (err: any) {
                console.error("Failed to load home page data (catch block):", err);
                setError(err.message || "Failed to load data.");
            } finally {
                setLoading(false);
            }
        };

        loadData();

    }, []);

    const handleMainButtonClick = useCallback(() => {
        navigate('/cart');
    }, [navigate]);

    useEffect(() => {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
            const tg = window.Telegram.WebApp;
            const cartItemCount = getItemCount(items);

            if (cartItemCount > 0) {
                const buttonText = `MY CART • ${cartItemCount} POSITION${cartItemCount > 1 ? 'S' : ''}`;
                tg.MainButton.setText(buttonText).show();
                tg.MainButton.onClick(handleMainButtonClick);
                tg.MainButton.enable();
                console.log(`MainButton shown for home page with ${cartItemCount} items.`);
            } else {
                tg.MainButton.hide();
                console.log("MainButton hidden on home page (no items in cart).");
            }

            return () => {
                console.log("HomePage cleanup: removing MainButton handler.");
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
                    const tg = window.Telegram.WebApp;
                    tg.MainButton.offClick(handleMainButtonClick);
                }
            };
        }
    }, [handleMainButtonClick, getItemCount, items]);

    // ... (jsx для loading и error остается без изменений) ...

    return (
        <section>
            {/* Шиммер для лого и обложки */}
            <div className="cafe-logo-container">
                <img id="cafe-logo" className={`cafe-logo ${loading ? "shimmer" : ""}`} src={cafeInfo?.logoImage || "/icons/icon-transparent.svg"} alt="Cafe Logo"/>
            </div>
            <img id="cafe-cover" className={`cover ${loading ? "shimmer" : ""}`} src={cafeInfo?.coverImage || "/icons/icon-transparent.svg"} alt="Cafe Cover"/>

            <div id="cafe-info" className="cafe-info-container">
                {/* Шиммер для текстовых полей инфо о кафе */}
                <h1 id="cafe-name" className={loading ? "shimmer" : ""}>{cafeInfo?.name}</h1>
                <p id="cafe-kitchen-categories" className={`cafe-kitchen-categories small ${loading ? "shimmer" : ""}`}>{cafeInfo?.kitchenCategories}</p>
                <div className={`cafe-parameters-container ${loading ? "shimmer" : ""}`}>
                    {/* Если info загружается, или нет infoData, отображаем шиммер-плейсхолдеры */}
                    {loading ? (
                        <>
                            <div className="cafe-parameter-container">
                                <img src="/icons/icon-star.svg" className="cafe-parameter-icon" alt="Rating Icon"/>
                                <div id="cafe-rating" className="cafe-parameter-value shimmer" style={{ minWidth: '40px' }}></div>
                            </div>
                            <div className="cafe-parameter-container">
                                <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Time Icon"/>
                                <div id="cafe-cooking-time" className="cafe-parameter-value shimmer" style={{ minWidth: '60px' }}></div>
                            </div>
                            <div id="cafe-status" className="cafe-status shimmer" style={{ minWidth: '50px' }}></div>
                        </>
                    ) : (
                        cafeInfo && (
                            <>
                                <div className="cafe-parameter-container">
                                    <img src="/icons/icon-star.svg" className="cafe-parameter-icon" alt="Rating Icon"/>
                                    <div id="cafe-rating" className="cafe-parameter-value">{cafeInfo.rating}</div>
                                </div>
                                <div className="cafe-parameter-container">
                                    <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Time Icon"/>
                                    <div id="cafe-cooking-time" className="cafe-parameter-value">{cafeInfo.cookingTime}</div>
                                </div>
                                <div id="cafe-status" className="cafe-status">{cafeInfo.status}</div>
                            </>
                        )
                    )}
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 id="cafe-section-categories-title" className={`cafe-section-title ${loading ? "shimmer" : ""}`}>Categories</h3>
                <div id="cafe-categories" className="cafe-section-horizontal">
                    {loading ? (
                        // Шиммер-плейсхолдеры для категорий
                        <>
                            <div className="cafe-category-container shimmer" style={{ minWidth: '56px', height: '56px', borderRadius: '16px' }}></div>
                            <div className="cafe-category-container shimmer" style={{ minWidth: '56px', height: '56px', borderRadius: '16px' }}></div>
                            <div className="cafe-category-container shimmer" style={{ minWidth: '56px', height: '56px', borderRadius: '16px' }}></div>
                            <div className="cafe-category-container shimmer" style={{ minWidth: '56px', height: '56px', borderRadius: '16px' }}></div>
                            <div className="cafe-category-container shimmer" style={{ minWidth: '56px', height: '56px', borderRadius: '16px' }}></div>
                        </>
                    ) : (
                        Array.isArray(categories) && categories.map(category => (
                            <button
                                key={category.id}
                                className="cafe-category-container"
                                onClick={() => {
                                    console.log("Navigating to category:", category.id);
                                    navigate(`/category/${category.id}`);
                                }}
                                style={{ backgroundColor: category.backgroundColor || '#ccc' }}
                            >
                                <img id="cafe-category-icon" className="cafe-category-icon" src={category.icon} alt={category.name + " icon"}/>
                                <div id="cafe-category-name" className="cafe-category-name">{category.name}</div>
                            </button>
                        ))
                    )}
                    {!loading && Array.isArray(categories) && categories.length === 0 && <p>No categories available.</p>}
                </div>
            </div>

            <div className="cafe-section-container">
                <h3 id="cafe-section-popular-title" className={`cafe-section-title ${loading ? "shimmer" : ""}`}>Popular</h3>
                <div id="cafe-section-popular" className="cafe-section-horizontal">
                    {loading ? (
                        // Шиммер-плейсхолдеры для популярных товаров
                        <>
                            <div className="cafe-item-container">
                                <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                                <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                                <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                            </div>
                            <div className="cafe-item-container">
                                <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                                <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                                <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                            </div>
                            <div className="cafe-item-container">
                                <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                                <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                                <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                            </div>
                        </>
                    ) : (
                        // РЕАЛЬНОЕ ОТОБРАЖЕНИЕ ПОПУЛЯРНЫХ ТОВАРОВ
                        Array.isArray(popularItems) && popularItems.length > 0 ? (
                            popularItems.map(item => (
                                <MenuItemCard key={item.id} item={item} />
                            ))
                        ) : (
                            <p>No popular items available.</p>
                        )
                    )}
                </div>
            </div>
        </section>
    );
};

export default HomePage;