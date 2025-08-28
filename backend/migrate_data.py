# backend/migrate_data.py
import json
import os
import traceback
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("FATAL: DATABASE_URL not set!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main_migration():
    db = SessionLocal()
    try:
        print("\n--- INITIALIZING DATABASE ---")
        # Удаляем все старые таблицы
        Base.metadata.drop_all(bind=engine)
        # Создаем все таблицы заново по последней схеме
        Base.metadata.create_all(bind=engine)
        print("-> Database tables created.")
        
        print("\n--- STARTING MIGRATION ---")
        
        # ШАГ 1: Загрузка каталога в сессию
        print("-> Staging Global Catalog...")
        with open('data/global_catalog.json', 'r', encoding='utf-8') as f:
            catalog = json.load(f)
        for cat_data in catalog['categories']:
            if 'backgroundColor' in cat_data:
                cat_data['background_color'] = cat_data.pop('backgroundColor')
            db.add(Category(**cat_data))
        for prod_data in catalog['products']:
            variants_data = prod_data.pop('variants', [])
            product = GlobalProduct(**prod_data)
            db.add(product)
            for var_data in variants_data:
                db.add(GlobalProductVariant(global_product_id=product.id, **var_data))
        
        # ШАГ 2: Загрузка заведений в сессию
        print("-> Staging Venues...")
        with open('data/info.json', 'r', encoding='utf-8') as f:
            venues_from_info = json.load(f)
        all_venues_to_create = venues_from_info
        
        DELIVERY_CITIES = ["Томск", "Северск", "Новосибирск"]
        for city in DELIVERY_CITIES:
            city_id = city.lower()
            all_venues_to_create.append({
                "id": f"delivery-{city_id}", "name": f"Доставка по г. {city}",
                "coverImage": "https://...url...", "logoImage": "icons/icon-delivery.svg", 
                "kitchenCategories": "Все меню", "rating": "", "cookingTime": "45-75 мин", 
                "status": "Доступна", "openingHours": "пн-вс: 10:00-21:00", "minOrderAmount": 15000
            })
            
        for venue_data in all_venues_to_create:
            db.add(Cafe(**{'id': venue_data.get('id'), 'name': venue_data.get('name'),
                'cover_image': venue_data.get('coverImage'), 'logo_image': venue_data.get('logoImage'),
                'kitchen_categories': venue_data.get('kitchenCategories'), 'rating': venue_data.get('rating'),
                'cooking_time': venue_data.get('cookingTime'), 'status': venue_data.get('status'),
                'opening_hours': venue_data.get('openingHours'), 'min_order_amount': venue_data.get('minOrderAmount')
            }))
        
        # ШАГ 3: Загрузка цен в сессию
        print("-> Staging Venue Menus...")
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
        
        # ФИНАЛЬНЫЙ COMMIT
        print("-> Committing all staged data to database...")
        db.commit()
        print("-> All data committed successfully.")

    except Exception as e:
        print(f"\n !!! AN ERROR OCCURRED DURING MIGRATION: {e} !!! \n")
        traceback.print_exc()
        db.rollback()
        raise e # <--- ВАЖНО: Пробрасываем ошибку дальше, чтобы entrypoint.sh остановился
    finally:
        print(f"\n--- MIGRATION FINISHED ---")
        db.close()

if __name__ == "__main__":
    main_migration()