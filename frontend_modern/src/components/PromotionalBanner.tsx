// frontend_modern/src/components/PromotionalBanner.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PromotionSchema } from '../api/types';

interface PromotionalBannerProps {
    promotions: PromotionSchema[];
    cafeId: string;
}

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ promotions, cafeId }) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (promotions.length <= 1) return;

        // Автоматическая смена слайдов каждые 5 секунд
        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % promotions.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [promotions.length]);
    
    if (promotions.length === 0) {
        return null;
    }

    const currentPromotion = promotions[currentIndex];

    const handleBannerClick = () => {
        if (currentPromotion) {
            navigate(`/cafe/${cafeId}/category/${currentPromotion.linkedCategoryId}`);
        }
    };

    return (
        <div className="promotional-banner-container" onClick={handleBannerClick}>
            <img src={currentPromotion.imageUrl} alt={currentPromotion.title} className="banner-image" />
            <div className="banner-overlay"></div>
            <div className="banner-text">
                <h4>{currentPromotion.title}</h4>
                <p>{currentPromotion.subtitle}</p>
            </div>
            {promotions.length > 1 && (
                <div className="banner-dots">
                    {promotions.map((_, index) => (
                        <span key={index} className={`dot ${index === currentIndex ? 'active' : ''}`}></span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PromotionalBanner;