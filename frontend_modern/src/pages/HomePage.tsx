import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCafeInfo, getCategories } from '../api';
import type { CafeInfoSchema, CategorySchema } from '../api/types';
import { useCart } from '../store/cart';


const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { items, getItemCount } = useCart(); // Получаем items и getItemCount из контекста

    // --- Состояние компонента ---
    const [cafeInfo, setCafeInfo] = useState<CafeInfoSchema | null>(null);
    const [categories, setCategories] = useState<CategorySchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Хук useEffect для загрузки данных ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                console.log("Attempting to load home page data...");
                const [infoData, categoriesData] = await Promise.all([
                    getCafeInfo(),
                    getCategories()
                ]);

                console.log("Cafe Info data received:", infoData);
                console.log("Categories data received:", categoriesData);

                if (Array.isArray(categoriesData)) {
                    setCafeInfo(infoData);
                    setCategories(categoriesData);
                    console.log("Data successfully loaded and set.");
                } else {
                    const errorMessage = "API did not return an array for categories.";
                    console.error(errorMessage, categoriesData);
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

    }, []); // Пустой массив зависимостей

    // --- Функция-обработчик для клика на MainButton ---
    const handleMainButtonClick = useCallback(() => {
        navigate('/cart');
    }, [navigate]);

    // --- Хук useEffect для управления Telegram MainButton на главной странице ---
    useEffect(() => {
         if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
              const tg = window.Telegram.WebApp;
              const cartItemCount = getItemCount(items); // <-- Передаем items

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
    }, [handleMainButtonClick, getItemCount, items]); // <-- Добавлена зависимость items


    // --- JSX для отображения содержимого страницы ---
    if (loading) {
        return <div>Loading cafe info...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <section>
             {cafeInfo && (
                 <>
                     <div className="cafe-logo-container">
                         <img id="cafe-logo" className="cafe-logo" src={cafeInfo.logoImage} alt="Cafe Logo"/>
                     </div>
                     <img id="cafe-cover" className="cover" src={cafeInfo.coverImage} alt="Cafe Cover"/>
                     <div id="cafe-info" className="cafe-info-container">
                         <h1 id="cafe-name" className={loading ? "shimmer" : ""}>{cafeInfo.name}</h1>
                         <p id="cafe-kitchen-categories" className={`cafe-kitchen-categories small ${loading ? "shimmer" : ""}`}>{cafeInfo.kitchenCategories}</p>
                         <div className={`cafe-parameters-container ${loading ? "shimmer" : ""}`}>
                             <div className="cafe-parameter-container">
                                 <img src="/icons/icon-star.svg" className="cafe-parameter-icon" alt="Rating Icon"/>
                                 <div id="cafe-rating" className="cafe-parameter-value">{cafeInfo.rating}</div>
                             </div>
                             <div className="cafe-parameter-container">
                                 <img src="/icons/icon-time.svg" className="cafe-parameter-icon" alt="Time Icon"/>
                                 <div id="cafe-cooking-time" className="cafe-parameter-value">{cafeInfo.cookingTime}</div>
                             </div>
                             <div id="cafe-status" className="cafe-status">{cafeInfo.status}</div>
                         </div>
                     </div>
                 </>
             )}

             <div className="cafe-section-container">
                 <h3 id="cafe-section-categories-title" className={`cafe-section-title ${loading ? "shimmer" : ""}`}>Categories</h3>
                 <div id="cafe-categories" className="cafe-section-horizontal">
                     {loading ? (
                         <>
                             <div className="cafe-category-container shimmer"></div>
                             <div className="cafe-category-container shimmer"></div>
                             <div className="cafe-category-container shimmer"></div>
                             <div className="cafe-category-container shimmer"></div>
                             <div className="cafe-category-container shimmer"></div>
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
                            <>
                                <div className="cafe-item-container shimmer"></div>
                                <div className="cafe-item-container shimmer"></div>
                                <div className="cafe-item-container shimmer"></div>
                            </>
                        ) : (
                            <p>Popular items will appear here.</p>
                        )}
                   </div>
             </div>

         </section>
     );
 };

 export default HomePage;