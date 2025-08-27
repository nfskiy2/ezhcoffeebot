import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';

import { CartProvider } from './store/cart.tsx';
import { SnackbarProvider } from './components/Snackbar.tsx';
import { CafeProvider } from './store/cafe.tsx'; // НОВЫЙ ИМПОРТ

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

root.render(
    <BrowserRouter>
        <CafeProvider> {/* Оборачиваем App в CafeProvider */}
            <CartProvider>
                <SnackbarProvider>
                    <App />
                </SnackbarProvider>
            </CartProvider>
        </CafeProvider>
    </BrowserRouter>
);