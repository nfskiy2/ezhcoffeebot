# backend/migrate_data.py
import json
import os
import traceback
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base, Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, GlobalAddonGroup, GlobalAddonItem, VenueAddonItem, product_addon_groups_association

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("FATAL: DATABASE_URL not set!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main_migration():
    db = SessionLocal()
    try:
        print("\n--- INITIALIZING DATABASE ---")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("-> Database tables recreated.")
        
        print("\n--- STARTING MIGRATION ---")
        
        # ШАГ 1: Глобальный каталог
        print("-> Migrating Global Catalog...")
        with open('data/global_catalog.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        # Категории
        for cat_data in catalog['categories']:
            if 'backgroundColor' in cat_data:
                cat_data['background_color'] = cat_data.pop('backgroundColor')
            db.add(Category(**cat_data))
        db.commit()

        # Группы добавок и добавки
        for group_data in catalog['addons']['groups']:
            db.add(GlobalAddonGroup(**group_data))
        for item_data in catalog['addons']['items']:
            db.add(GlobalAddonItem(**item_data))
        db.commit()

        # Продукты и их варианты
        product_addon_links = []
        for prod_data in catalog['products']:
            variants_data = prod_data.pop('variants', [])
            addon_group_ids = prod_data.pop('addon_group_ids', [])
            product_obj = GlobalProduct(**prod_data)
            db.add(product_obj)
            db.flush()
            for var_data in variants_data:
                db.add(GlobalProductVariant(global_product_id=product_obj.id, **var_data))
            for group_id in addon_group_ids:
                product_addon_links.append({'product_id': product_obj.id, 'addon_group_id': group_id})
        
        db.commit()
        
        # Связываем продукты и группы добавок
        if product_addon_links:
            db.execute(product_addon_groups_association.insert(), product_addon_links)
        db.commit()
        print("-> Global Catalog migrated.")

        # ШАГ 2: Заведения
        print("-> Migrating Venues...")
        # ... (код для создания заведений остается таким же)
        with open('data/info.json', 'r', encoding='utf-8') as f:
            venues_to_create = json.load(f)
        DELIVERY_CITIES = {"Томск": "tomsk", "Северск": "seversk", "Новосибирск": "novosibirsk"}
        for city_ru, city_en in DELIVERY_CITIES.items():
            venues_to_create.append({"id": f"delivery-{city_en}", "name": f"Доставка по г. {city_ru}", "coverImage": "...", "logoImage": "..."})
        for venue_data in venues_to_create:
            db.add(Cafe(**{'id': venue_data.get('id'), 'name': venue_data.get('name'), 'cover_image': venue_data.get('coverImage'), 'logo_image': venue_data.get('logoImage'), 'kitchen_categories': venue_data.get('kitchenCategories'), 'rating': venue_data.get('rating'), 'cooking_time': venue_data.get('cookingTime'), 'status': venue_data.get('status'), 'opening_hours': venue_data.get('openingHours'), 'min_order_amount': venue_data.get('minOrderAmount')}))
        db.commit()
        print(f"-> All Venues committed. Total in DB: {db.query(Cafe).count()}")
        
        # ШАГ 3: Цены и наличие
        print("-> Migrating Venue Menus and Addons...")
        configs_path = "data/venue_configs"
        for filename in os.listdir(configs_path):
            if filename.endswith(".json"):
                venue_id = filename.split('.')[0]
                with open(os.path.join(configs_path, filename), 'r', encoding='utf-8') as f:
                    venue_config = json.load(f)
                    # Цены на варианты
                    for item_config in venue_config.get('variants', []):
                        db.add(VenueMenuItem(venue_id=venue_id, **item_config))
                    # Цены на добавки
                    for addon_config in venue_config.get('addons', []):
                        db.add(VenueAddonItem(venue_id=venue_id, **addon_config))
        db.commit()
        print("-> Venue-specific data committed.")

    except Exception as e:
        print(f"\n !!! AN ERROR OCCURRED DURING MIGRATION: {e} !!! \n")
        traceback.print_exc()
        db.rollback()
        raise e
    finally:
        print(f"\n--- MIGRATION FINISHED ---")
        db.close()

if __name__ == "__main__":
    main_migration()