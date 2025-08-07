// frontend_modern/src/components/MenuItemCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItemSchema } from '../api/types';

interface MenuItemCardProps {
    item: MenuItemSchema;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
    const navigate = useNavigate();

    return (
        <button
            className="cafe-item-container"
            onClick={() => {
                console.log("Navigating to item details:", item.id);
                navigate(`/details/${item.id}`);
            }}
        >
            <img className="cafe-item-image" src={item.image} alt={item.name}/>
            <h6 className="cafe-item-name">{item.name}</h6>
            <p className="small cafe-item-description">{item.description}</p>
        </button>
    );
};

export default MenuItemCard;