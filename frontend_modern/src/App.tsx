import React, { useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import HomePage from './pages/HomePage'; // Импортируем HomePage
import CategoryPage from './pages/CategoryPage'; // Импортируем CategoryPage
import DetailsPage from './pages/DetailsPage'; // Импортируем DetailsPage
import CartPage from './pages/CartPage'; // Импортируем CartPage


// // Заглушки для страниц
// const HomePage: React.FC = () => {
//     const navigate = useNavigate();
//     useEffect(() => {
//          if (window.Telegram && window.Telegram.WebApp) {
//              // window.Telegram.WebApp.MainButton.hide(); // Пример: скрыть MainButton на главной
//          }
//          return () => {
//              if (window.Telegram && window.Telegram.WebApp) {
//                  // window.Telegram.WebApp.MainButton.hide(); // Убедитесь, что кнопка скрыта при уходе
//              }
//          };
//     }, [navigate]);

//     return <div>Home Page Content</div>;
// };
// const CategoryPage: React.FC = () => { return <div>Category Page Content</div>; };
// const DetailsPage: React.FC = () => { return <div>Details Page Content</div>; };
// const CartPage: React.FC = () => { return <div>Cart Page Content</div>; };


function App() {
    const navigate = useNavigate();
    const location = useLocation();

    // --- ОПРЕДЕЛЯЕМ ФУНКЦИИ ОБРАБОТЧИКОВ ВНУТРИ КОМПОНЕНТА ---
    // Используем useCallback для создания стабильных ссылок на функции

    const handleBackButtonClick = useCallback(() => {
         console.log("Telegram BackButton clicked!");
         navigate(-1); // Вернуться на предыдущую страницу React Router
    }, [navigate]);

    const handleThemeChange = useCallback(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            document.documentElement.className = window.Telegram.WebApp.colorScheme;
            console.log(`Theme changed to: ${window.Telegram.WebApp.colorScheme}`);
        }
    }, []);


    // --- Логика интеграции с Telegram Web App SDK (Первый useEffect) ---
    // Выполняется при монтировании компонента и при изменении зависимостей

    useEffect(() => {
        // Проверяем, что Telegram Web App SDK загружен и доступен
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp; // Для удобства

            console.log("Telegram Web App SDK detected.");
            console.log("InitData:", tg.initData);
            console.log("ThemeParams:", tg.themeParams);

            tg.ready(); // Уведомляем Telegram, что приложение готово
            tg.expand(); // Разворачиваем приложение на весь экран

            // Подписываемся на событие 'themeChanged'
            tg.onEvent('themeChanged', handleThemeChange); // Используем handleThemeChange

            // Применяем тему сразу при загрузке
            document.documentElement.className = tg.colorScheme;
            console.log(`Initial theme: ${tg.colorScheme}`);

            // Проверяем наличие BackButton перед подпиской
            if (tg.BackButton) {
                tg.BackButton.onClick(handleBackButtonClick); // Используем handleBackButtonClick
                console.log("Telegram BackButton onClick handler added.");
            } else {
                console.warn("Telegram BackButton is not available in this environment/version.");
            }

            // Пример обработки инициализации из Telegram (парсинг хэша URL)
            const hash = window.location.hash;
            if (hash) {
                 console.log("Detected hash in URL:", hash);
                 const hashParams = new URLSearchParams(hash.substring(1));
                 const initialDest = hashParams.get('dest');
                 const encodedInitialParams = hashParams.get('params');

                 if (initialDest) {
                     console.log(`Initial destination from hash: ${initialDest}`);
                     try {
                         const initialParams = encodedInitialParams ? JSON.parse(decodeURIComponent(encodedInitialParams)) : null;
                         console.log("Parsed initial params:", initialParams);

                         // Сопоставляем 'dest' из хэша с вашими маршрутами React Router
                         // И переходим на соответствующую страницу
                         if (initialDest === 'category' && initialParams && initialParams.id) {
                             navigate(`/category/${initialParams.id}`, { replace: true });
                         } else if (initialDest === 'details' && initialParams && initialParams.id) {
                             navigate(`/details/${initialParams.id}`, { replace: true });
                         } else if (initialDest === 'cart') {
                              navigate('/cart', { replace: true });
                         } else if (initialDest === 'root') {
                             navigate('/', { replace: true });
                         }
                         // Если маршрут из хэша не соответствует известным, можно остаться на главной или показать ошибку

                     } catch (e) {
                          console.error("Error parsing initial params from hash:", e);
                          // Оставить на главной или показать ошибку, если параметры некорректны
                     }
                 } else {
                     // Если хэш есть, но в нем нет 'dest' (например, только tgWebAppStartParam),
                     // и текущий путь не главная, можно перенаправить на главную
                     if (location.pathname !== '/') {
                        // navigate('/', { replace: true }); // Или оставьте на текущей странице
                     }
                 }
            } else {
                 // Если хэша нет, и текущий путь не главная, перенаправляем на главную по умолчанию
                 if (location.pathname !== '/') {
                    // navigate('/', { replace: true }); // Или оставьте на текущей странице
                 }
            }

        } else {
             console.warn("Telegram Web App script not loaded or not ready. Running in standalone mode.");
             // Здесь можно показать пользователю сообщение, что приложение предназначено для Telegram
             // или показать ограниченную версию приложения.
        }

        // Очистка при размонтировании компонента (удаление обработчиков событий Telegram)
        return () => {
             console.log("App component cleanup.");
             if (window.Telegram && window.Telegram.WebApp) {
                 const tg = window.Telegram.WebApp;
                 // Удаляем обработчики, проверяя их наличие
                 if (tg.BackButton) {
                     tg.BackButton.offClick(handleBackButtonClick); // Удаляем handleBackButtonClick
                      console.log("Telegram BackButton onClick handler removed.");
                 }
                 tg.offEvent('themeChanged', handleThemeChange); // Удаляем handleThemeChange
                  console.log("Telegram themeChanged handler removed.");
             }
        };
    }, [navigate, handleBackButtonClick, handleThemeChange]); // Зависимости хука

    // --- Эффект для показа/скрытия кнопки Назад в зависимости от маршрута (Второй useEffect) ---
    // Этот хук будет запускаться при каждом изменении location

    useEffect(() => {
       if (window.Telegram && window.Telegram.WebApp) {
          const tg = window.Telegram.WebApp;
          if (tg.BackButton) { // Проверяем наличие BackButton
              if (location.pathname !== '/') {
                  tg.BackButton.show();
              } else {
                  tg.BackButton.hide();
              }
          }
       }
    }, [location]); // Зависимость от location


    // --- Основной рендеринг компонента App ---
     return (
        <div className="app-container">
            <Routes>
                <Route path="/" element={<HomePage />} />
                {/* Используем импортированный CategoryPage */}
                <Route path="/category/:categoryId" element={<CategoryPage />} />
                <Route path="/details/:itemId" element={<DetailsPage />} />
                <Route path="/cart" element={<CartPage />} />
            </Routes>
        </div>
    );
}

export default App;