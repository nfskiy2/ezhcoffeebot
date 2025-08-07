import { StrictMode } from 'react'; // Можно удалить, если не используете
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom'; // Добавьте импорт

import { CartProvider } from './store/cart.tsx';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

root.render(
    <BrowserRouter> {/* Оборачиваем App в BrowserRouter */}
        <CartProvider> {/* Оборачиваем App в CartProvider */}
            <App />
        </CartProvider>
    </BrowserRouter>
);