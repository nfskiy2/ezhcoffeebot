// frontend_modern/src/pages/CategoryPage.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCafeCategoryMenu } from '../api';
import type { MenuItemSchema } from '../api/types';
import { useCart } from '../store/cart';
import MenuItemCard from '../components/MenuItemCard';
import { logger } from '../utils/logger';

// Этот интерфейс теперь будет использоваться
interface GroupedMenuItems {
    subCategoryName: string;
    items: MenuItemSchema[];
}

const CategoryPage: React.FC = () => {
    const { cafeId, categoryId } = useParams<{ cafeId: string; categoryId: string }>();
    const navigate = useNavigate();
    const { getItemCount } = useCart();
    
    const [menuItems, setMenuItems] = useState<MenuItemSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        const loadMenu = async () => {
            if (!cafeId || !categoryId) {
                setError("ID кофейни или категории отсутствует в URL.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const items = await getCafeCategoryMenu(cafeId, categoryId);
                setMenuItems(items || []);
            } catch (err: any) {
                logger.error("Failed to load menu:", err);
                setError(err.message || "Не удалось загрузить меню.");
            } finally {
                setLoading(false);
            }
        };
        loadMenu();
    }, [cafeId, categoryId]);

    const { groupedItems, subCategories } = useMemo(() => {
        const groups: Record<string, MenuItemSchema[]> = {};
        const subCategoryOrder: string[] = [];

        menuItems.forEach(item => {
            const subCat = item.subCategory || 'Прочее';
            if (!groups[subCat]) {
                groups[subCat] = [];
                subCategoryOrder.push(subCat);
            }
            groups[subCat].push(item);
        });
        
        // <-- ИСПРАВЛЕНИЕ 2: Явно указываем тип для переменной `grouped`
        const grouped: GroupedMenuItems[] = subCategoryOrder.map(name => ({
            subCategoryName: name,
            items: groups[name],
        }));

        if (grouped.length > 0 && !activeSubCategory) {
            setActiveSubCategory(grouped[0].subCategoryName);
        }

        return { groupedItems: grouped, subCategories: subCategoryOrder };
    }, [menuItems, activeSubCategory]); // Добавил activeSubCategory в зависимости

    const handleSelectorClick = (subCategoryName: string) => {
        setActiveSubCategory(subCategoryName);
        sectionRefs.current[subCategoryName]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Используем requestAnimationFrame чтобы избежать частых обновлений состояния
                        // во время быстрой прокрутки
                        window.requestAnimationFrame(() => {
                            setActiveSubCategory(entry.target.id);
                        });
                    }
                });
            },
            // Скорректированный rootMargin: верхняя граница = высота sticky-хедера + небольшой запас
            { rootMargin: '-70px 0px -80% 0px', threshold: 0 }
        );

        const currentRefs = Object.values(sectionRefs.current);
        currentRefs.forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => {
            currentRefs.forEach(ref => {
                if (ref) observer.unobserve(ref);
            });
        };
    }, [groupedItems]);

    const handleMainButtonClick = useCallback(() => {
        navigate('/cart');
    }, [navigate]);

useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        const positions = getItemCount();
        if (positions > 0) {
            let plural = 'ПОЗИЦИЙ';
            if (positions === 1) plural = 'ПОЗИЦИЯ';
            else if (positions > 1 && positions < 5) plural = 'ПОЗИЦИИ';
            const buttonText = `МОЯ КОРЗИНА • ${positions} ${plural}`;
            tg.MainButton.setText(buttonText).show();
            tg.MainButton.onClick(handleMainButtonClick);
            tg.MainButton.enable();
        } else {
            tg.MainButton.hide();
        }
        return () => {
            if (window.Telegram && window.Telegram.WebApp) {
                tg.MainButton.offClick(handleMainButtonClick);
            }
        };
    }
}, [handleMainButtonClick, getItemCount]);

    if (loading) {
        return (
            <section className="cafe-section-vertical">
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
                <div className="cafe-item-container">
                    <div className="cafe-item-image shimmer" style={{ width: '100%', height: 'calc((100vw - 16px * 3) / 2 * 3 / 4)' }}></div>
                    <h6 className="cafe-item-name shimmer" style={{ minWidth: '80%', marginTop: '8px' }}></h6>
                    <p className="small cafe-item-description shimmer" style={{ minWidth: '95%' }}></p>
                </div>
            </section>
        );
    }

    if (error) {
        return <div>Ошибка загрузки меню: {error}</div>;
    }

    return (
        <section style={{ paddingTop: subCategories.length > 1 ? '60px' : '0' }}>
            {subCategories.length > 1 && (
                <div className="sticky-selector">
                    <div className="cafe-section-horizontal">
                        {subCategories.map(name => (
                            <button
                                key={name}
                                className={`sub-category-button ${activeSubCategory === name ? 'active' : ''}`}
                                onClick={() => handleSelectorClick(name)}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {groupedItems.map(({ subCategoryName, items: menuGroupItems }) => (
                <div 
                    key={subCategoryName} 
                    id={subCategoryName}
                    // <-- ИСПРАВЛЕНИЕ 1: Используем фигурные скобки, чтобы функция ничего не возвращала
                    ref={el => {
                        sectionRefs.current[subCategoryName] = el;
                    }}
                >
                    <h3 className="sub-category-header">{subCategoryName}</h3>
                    <div className="cafe-section-vertical">
                        {menuGroupItems.map(item => (
                            <MenuItemCard key={item.id} item={item} cafeId={cafeId!} />
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
};

export default CategoryPage;