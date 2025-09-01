// frontend_modern/src/components/PromotionalBanner.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PromotionSchema } from '../api/types';

interface PromotionalBannerProps {
    promotions: PromotionSchema[];
    cafeId: string;
}

const SWIPE_THRESHOLD = 50; // Минимальная дистанция свайпа для переключения слайда

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ promotions, cafeId }) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);

    // Ref'ы для логики свайпа
    const sliderRef = useRef<HTMLDivElement>(null);
    // --- ИСПРАВЛЕНИЕ 1: Заменяем NodeJS.Timeout на number ---
    const autoplayIntervalRef = useRef<number | null>(null);
    const startXRef = useRef(0);
    const currentTranslateRef = useRef(0);
    const isDraggingRef = useRef(false);
    // --- УЛУЧШЕНИЕ: Ref для отслеживания последней позиции ---
    const lastMoveXRef = useRef(0);


    // Функция для перехода к определённому слайду
    const goToSlide = useCallback((index: number) => {
        if (sliderRef.current) {
            sliderRef.current.style.transition = 'transform 0.4s ease-in-out';
            sliderRef.current.style.transform = `translateX(-${index * 100}%)`;
        }
        setCurrentIndex(index);
    }, []);

    // Функция для запуска автопрокрутки
    const startAutoplay = useCallback(() => {
        if (autoplayIntervalRef.current) {
            // --- ИСПРАВЛЕНИЕ 2: Используем window.clearInterval ---
            window.clearInterval(autoplayIntervalRef.current);
        }
        // --- ИСПРАВЛЕНИЕ 3: Используем window.setInterval ---
        autoplayIntervalRef.current = window.setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % promotions.length);
        }, 5000);
    }, [promotions.length]);

    // Эффект для автопрокрутки
    useEffect(() => {
        if (promotions.length > 1) {
            startAutoplay();
        }
        return () => {
            if (autoplayIntervalRef.current) {
                window.clearInterval(autoplayIntervalRef.current);
            }
        };
    }, [promotions.length, startAutoplay]);

    // Эффект для обновления слайда при изменении currentIndex
    useEffect(() => {
        goToSlide(currentIndex);
    }, [currentIndex, goToSlide]);

    const handleDragStart = (clientX: number) => {
        if (promotions.length <= 1 || !sliderRef.current) return;
        
        if (autoplayIntervalRef.current) window.clearInterval(autoplayIntervalRef.current);
        
        isDraggingRef.current = true;
        startXRef.current = clientX;
        sliderRef.current.style.transition = 'none';
        currentTranslateRef.current = -currentIndex * sliderRef.current.offsetWidth;
        lastMoveXRef.current = 0; // Сбрасываем смещение
    };

    const handleDragMove = (clientX: number) => {
        if (!isDraggingRef.current || !sliderRef.current) return;
        
        const moveX = clientX - startXRef.current;
        lastMoveXRef.current = moveX; // --- УЛУЧШЕНИЕ: Сохраняем смещение ---
        const newTranslate = currentTranslateRef.current + moveX;
        sliderRef.current.style.transform = `translateX(${newTranslate}px)`;
    };
    
    const handleDragEnd = () => {
        if (!isDraggingRef.current || !sliderRef.current) return;

        isDraggingRef.current = false;
        // --- УЛУЧШЕНИЕ: Используем сохраненное значение вместо парсинга CSS ---
        const moveX = lastMoveXRef.current;

        let newIndex = currentIndex;
        if (moveX > SWIPE_THRESHOLD) { // Свайп вправо
            newIndex = currentIndex > 0 ? currentIndex - 1 : promotions.length - 1;
        } else if (moveX < -SWIPE_THRESHOLD) { // Свайп влево
            newIndex = currentIndex < promotions.length - 1 ? currentIndex + 1 : 0;
        }

        // Если свайп был коротким (считаем это кликом) и индекс не изменился
        if (Math.abs(moveX) < 10 && newIndex === currentIndex) {
            const currentPromotion = promotions[currentIndex];
            if (currentPromotion) {
                navigate(`/cafe/${cafeId}/category/${currentPromotion.linkedCategoryId}`);
            }
        }
        
        setCurrentIndex(newIndex);
        goToSlide(newIndex); // Обновляем позицию слайдера
        if (promotions.length > 1) startAutoplay();
    };

    // Обработчики событий
    const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX);
    const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX);
    const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handleDragStart(e.clientX); };
    const onMouseMove = (e: React.MouseEvent) => { e.preventDefault(); handleDragMove(e.clientX); };
    const onMouseUp = (e: React.MouseEvent) => { e.preventDefault(); handleDragEnd(); };
    const onMouseLeave = (e: React.MouseEvent) => { if (isDraggingRef.current) { e.preventDefault(); handleDragEnd(); }};


    if (promotions.length === 0) {
        return null;
    }

    return (
        <div 
            className="promotional-banner-container"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
        >
            <div ref={sliderRef} className="banner-slider-wrapper">
                {promotions.map((promo) => (
                    <div key={promo.id} className="banner-slide">
                        <img src={promo.imageUrl} alt={promo.title} className="banner-image" draggable="false" />
                        <div className="banner-overlay"></div>
                        <div className="banner-text">
                            <h4>{promo.title}</h4>
                            <p>{promo.subtitle}</p>
                        </div>
                    </div>
                ))}
            </div>

            {promotions.length > 1 && (
                <div className="banner-dots">
                    {promotions.map((_, index) => (
                        <span 
                            key={index} 
                            className={`dot ${index === currentIndex ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation(); 
                                goToSlide(index);
                                startAutoplay(); // Перезапускаем таймер при клике на точку
                            }}
                        ></span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PromotionalBanner;