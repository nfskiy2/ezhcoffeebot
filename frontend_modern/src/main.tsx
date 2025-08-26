// frontend_modern/src/main.tsx
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';

import { CartProvider } from './store/cart.tsx';
import { SnackbarProvider } from './components/Snackbar.tsx';
import { CafeProvider } from './store/cafe.tsx';
import { OrderProvider } from './store/order.tsx'; 

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

root.render(
    <BrowserRouter>
        <CafeProvider>
            <OrderProvider> 
                <CartProvider>
                    <SnackbarProvider>
                        <App />
                    </SnackbarProvider>
                </CartProvider>
            </OrderProvider>
        </CafeProvider>
    </BrowserRouter>
);