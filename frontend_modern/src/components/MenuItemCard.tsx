// frontend_modern/src/components/MenuItemCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItemSchema } from '../api/types';

interface MenuItemCardProps {
    item: MenuItemSchema;
    cafeId: string; 
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, cafeId }) => {
    const navigate = useNavigate();

    const handleGoToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate('/cart');
    };

    return (
        <button
            className="cafe-item-container"
            onClick={() => {
                navigate(`/cafe/${cafeId}/details/${item.id}`);
            }}
        >
            <div className="cafe-item-image-wrapper">
                <img className="cafe-item-image" src={item.image || "/icons/icon-transparent.svg"} alt={item.name}/>
                <button className="go-to-cart-button" onClick={handleGoToCart}>
                    <span className="material-symbols-rounded">shopping_bag</span>
                </button>
            </div>
            <h6 className="cafe-item-name">{item.name}</h6>
            <p className="small cafe-item-description">{item.description}</p>
        </button>
    );
};

export default MenuItemCard;