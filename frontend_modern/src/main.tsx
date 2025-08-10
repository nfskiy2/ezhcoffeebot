import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';

import { CartProvider } from './store/cart.tsx';
import { SnackbarProvider } from './components/Snackbar.tsx'; // НОВЫЙ ИМПОРТ

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

root.render(
    <BrowserRouter>
        <CartProvider>
            <SnackbarProvider> {/* Оборачиваем App в SnackbarProvider */}
                <App />
            </SnackbarProvider>
        </CartProvider>
    </BrowserRouter>
);
