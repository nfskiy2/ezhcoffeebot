# backend/migrate_data.py
import json
import os
import traceback
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order

# --- Настройка подключения к БД ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("FATAL: DATABASE_URL not set!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main_migration():
    """Основная функция, запускающая все шаги миграции."""
    db = SessionLocal()
    try:
        print("\n--- INITIALIZING DATABASE ---")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("-> Database tables recreated.")
        
        print("\n--- STARTING MIGRATION ---")
        
        # --- ШАГ 1: ГЛОБАЛЬНЫЙ КАТАЛОГ ---
        print("-> Migrating Global Catalog...")
        with open('data/global_catalog.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)

        for cat_data in catalog['categories']:
            if 'backgroundColor' in cat_data:
                cat_data['background_color'] = cat_data.pop('backgroundColor')
            db.add(Category(**cat_data))
        db.commit()

        for prod_data in catalog['products']:
            variants_data = prod_data.pop('variants', [])
            product = GlobalProduct(**prod_data)
            db.add(product)
            for var_data in variants_data:
                db.add(GlobalProductVariant(global_product_id=product.id, **var_data))
        db.commit()
        print("-> Global Catalog migrated.")

        # --- ШАГ 2: ЗАВЕДЕНИЯ ---
        print("-> Migrating Venues (Cafes and Deliveries)...")
        with open('data/info.json', 'r', encoding='utf-8') as f:
            venues_to_create = json.load(f)
        
        DELIVERY_CITIES = ["Томск", "Северск", "Новосибирск"]
        for city in DELIVERY_CITIES:
            city_id = city.lower()
            venues_to_create.append({
                "id": f"delivery-{city_id}", "name": f"Доставка по г. {city}",
                "coverImage": "https://...url...", "logoImage": "icons/icon-delivery.svg", 
                "kitchenCategories": "Все меню", "rating": "", "cookingTime": "45-75 мин", 
                "status": "Доступна", "openingHours": "пн-вс: 10:00-21:00", "minOrderAmount": 15000
            })
            
        for venue_data in venues_to_create:
            db.add(Cafe(**{
                'id': venue_data.get('id'), 'name': venue_data.get('name'),
                'cover_image': venue_data.get('coverImage'), 'logo_image': venue_data.get('logoImage'),
                'kitchen_categories': venue_data.get('kitchenCategories'), 'rating': venue_data.get('rating'),
                'cooking_time': venue_data.get('cookingTime'), 'status': venue_data.get('status'),
                'opening_hours': venue_data.get('openingHours'), 'min_order_amount': venue_data.get('minOrderAmount')
            }))
        db.commit()
        print(f"-> All Venues committed. Total in DB: {db.query(Cafe).count()}")

        # --- ШАГ 3: ЦЕНЫ И НАЛИЧИЕ ---
        print("-> Migrating Venue Menus...")
        configs_path = "data/venue_configs"
        for filename in os.listdir(configs_path):
            if filename.endswith(".json"):
                venue_id = filename.split('.')[0]
                with open(os.path.join(configs_path, filename), 'r', encoding='utf-8') as f:
                    venue_config = json.load(f)
                    for item_config in venue_config:
                        db.add(VenueMenuItem(
                            venue_id=venue_id,
                            variant_id=item_config['variant_id'],
                            price=item_config['price'],
                            is_available=item_config.get('is_available', True)
                        ))
        db.commit()
        print("-> Venue Menus committed.")

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