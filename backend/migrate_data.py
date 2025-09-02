# backend/migrate_data.py
import json
import os
import traceback
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import (
    Base, Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order,
    GlobalAddonGroup, GlobalAddonItem, VenueAddonItem, product_addon_groups_association
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("FATAL: DATABASE_URL not set!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate():
    db = SessionLocal()
    try:
        print("\n--- STARTING MIGRATION ---")

        # 1. Очистка таблиц в правильном порядке
        print("-> Clearing old data...")
        # Сначала удаляем записи из таблиц, которые имеют внешние ключи
        db.query(Order).delete()
        db.query(VenueMenuItem).delete()
        db.query(VenueAddonItem).delete()
        db.execute(product_addon_groups_association.delete())

        # Затем из тех, на которые ссылаются
        # Ассоциативная таблица очистится каскадом при удалении продуктов/групп
        db.query(GlobalProductVariant).delete()
        db.query(GlobalProduct).delete()
        db.query(GlobalAddonItem).delete()
        db.query(GlobalAddonGroup).delete()
        db.query(Category).delete()
        db.query(Cafe).delete()
        db.commit()

        # 2. Загрузка глобального каталога
        print("-> Migrating Global Catalog...")
        with open('data/global_catalog.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        # 2.1 Сначала категории
        for cat_data in catalog.get('categories', []):
            if 'backgroundColor' in cat_data:
                cat_data['background_color'] = cat_data.pop('backgroundColor')
            db.add(Category(**cat_data))
        db.commit()
        print("-> Categories migrated.")

        # 2.2 Затем группы добавок и сами добавки
        addons_data = catalog.get('addons', {})
        for group_data in addons_data.get('groups', []):
            db.add(GlobalAddonGroup(**group_data))
        db.commit() # Коммитим группы, чтобы получить их ID для добавок
        print("-> Addon Groups migrated.")
        
        for item_data in addons_data.get('items', []):
            db.add(GlobalAddonItem(**item_data))
        db.commit()
        print("-> Addon Items migrated.")

        # 2.3 Теперь, когда группы добавок существуют в БД, загружаем продукты
        # и связываем их с группами
        all_addon_groups = db.query(GlobalAddonGroup).all()
        addon_groups_map = {group.id: group for group in all_addon_groups}

        for prod_data in catalog.get('products', []):
            # Извлекаем ID групп добавок, чтобы они не попали в конструктор
            addon_group_ids = prod_data.pop('addon_group_ids', [])
            variants_data = prod_data.pop('variants', [])
            
            # Создаем продукт с оставшимися данными
            product = GlobalProduct(**prod_data)

            # Находим объекты групп по ID и добавляем их к продукту
            if addon_group_ids:
                for group_id in addon_group_ids:
                    if group_id in addon_groups_map:
                        product.addon_groups.append(addon_groups_map[group_id])
                    else:
                        print(f"  [WARNING] Addon group with id '{group_id}' not found for product '{product.id}'.")

            db.add(product)
            db.flush() # Используем flush, чтобы получить product.id для вариантов

            # Создаем варианты для этого продукта
            for var_data in variants_data:
                db.add(GlobalProductVariant(global_product_id=product.id, **var_data))
        
        db.commit() # Коммитим все продукты и варианты вместе
        print("-> Products and Variants migrated successfully.")


        # 3. Загрузка ВСЕХ заведений (и реальных, и виртуальных)
        print("-> Migrating Venues (Cafes and Deliveries)...")

        with open('data/info.json', 'r', encoding='utf-8') as f:
            all_venues_info = json.load(f)

        for venue_data in all_venues_info:
            venue_data_for_db = {k: v for k, v in venue_data.items() if k in Cafe.__table__.columns.keys()}
            # Ручное переименование ключей, если они не совпадают
            if 'coverImage' in venue_data: venue_data_for_db['cover_image'] = venue_data['coverImage']
            if 'logoImage' in venue_data: venue_data_for_db['logo_image'] = venue_data['logoImage']
            if 'kitchenCategories' in venue_data: venue_data_for_db['kitchen_categories'] = venue_data['kitchenCategories']
            if 'cookingTime' in venue_data: venue_data_for_db['cooking_time'] = venue_data['cookingTime']
            if 'openingHours' in venue_data: venue_data_for_db['opening_hours'] = venue_data['openingHours']
            if 'minOrderAmount' in venue_data: venue_data_for_db['min_order_amount'] = venue_data['minOrderAmount']
            
            # Удаляем старые ключи, чтобы избежать ошибок
            for key in ['coverImage', 'logoImage', 'kitchenCategories', 'cookingTime', 'openingHours', 'minOrderAmount']:
                venue_data_for_db.pop(key, None)

            db.add(Cafe(**venue_data_for_db))
        db.commit()
        print(f"-> All Venues committed. Total in DB: {db.query(Cafe).count()}")

        # 4. Загрузка цен и наличия для каждого заведения
        print("-> Migrating Venue-specific menus (prices & availability)...")
        configs_path = "data/venue_configs"
        for filename in os.listdir(configs_path):
            if filename.endswith(".json"):
                venue_id = filename.split('.')[0]
                print(f"  -> Processing config for venue: {venue_id}")
                
                # Проверяем, существует ли такое заведение в БД
                venue_exists = db.query(Cafe).filter_by(id=venue_id).first()
                if not venue_exists:
                    print(f"  [WARNING] Venue with id '{venue_id}' from config file not found in DB. Skipping.")
                    continue

                with open(os.path.join(configs_path, filename), 'r', encoding='utf-8') as f:
                    venue_config = json.load(f)
                    # Обработка цен на варианты
                    for item_config in venue_config.get("variants", []):
                        db.add(VenueMenuItem(
                            venue_id=venue_id,
                            variant_id=item_config['variant_id'],
                            price=item_config['price'],
                            is_available=item_config.get('is_available', True)
                        ))
                    # Обработка цен на добавки
                    for addon_config in venue_config.get("addons", []):
                        db.add(VenueAddonItem(
                            venue_id=venue_id,
                            addon_id=addon_config['addon_id'],
                            price=addon_config['price'],
                            is_available=addon_config.get('is_available', True)
                        ))
        db.commit()
        print("-> Venue menus migrated successfully.")

    except Exception as e:
        print(f"\n !!! AN ERROR OCCURRED DURING MIGRATION: {e} !!! \n")
        traceback.print_exc()
        db.rollback()
    finally:
        print(f"\n--- MIGRATION FINISHED ---")
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    migrate()