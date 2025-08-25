# backend/migrate_data.py
import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Category, MenuItem, Cafe, Order
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("FATAL: DATABASE_URL not set!")
    exit(1)

parsed_url = urlparse(DATABASE_URL)
db_params = {
    "database": parsed_url.path.lstrip("/"),
    "user": parsed_url.username,
    "password": parsed_url.password,
    "host": parsed_url.hostname,
    "port": parsed_url.port,
    "client_encoding": "utf8"
}

engine = create_engine(f"postgresql://", connect_args=db_params)
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate():
    db = SessionLocal()
    try:
        print("\n--- STARTING MIGRATION ---")

        # 1. МИГРАЦИЯ КОФЕЕН
        print("Migrating cafes...")
        cafes_data = [
            {
                "id": "ezh-1",
                "name": "EZH-1",
                "cover_image": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
                "logo_image": "icons/logo-laurel.svg",
                "kitchen_categories": "American Barbeque, Dinner, Italian",
                "rating": "4.3 (212)",
                "cooking_time": "5-15 mins",
                "status": "Open",
                "opening_hours": "пн-пт: 09:00-20:30, сб-вс: 10:00-19:00",
                "min_order_amount": 10000
            },
            {
                "id": "ezh-2",
                "name": "EZH-2",
                "cover_image": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
                "logo_image": "icons/logo-laurel.svg",
                "kitchen_categories": "Coffee, Desserts",
                "rating": "4.8 (98)",
                "cooking_time": "2-5 mins",
                "status": "Open",
                "opening_hours": "пн-пт: 07:00-19:00, сб: 08:00-17:00",
                "min_order_amount": 5000
            },
            {
                "id": "ezh-3",
                "name": "EZH-3",
                "cover_image": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
                "logo_image": "icons/logo-laurel.svg",
                "kitchen_categories": "Pizza, Pasta",
                "rating": "4.5 (150)",
                "cooking_time": "10-20 mins",
                "status": "Open",
                "opening_hours": "пн-вс: 11:00-22:00",
                "min_order_amount": 12000
            }
        ]
        
        for cafe_data in cafes_data:
            cafe = Cafe(**cafe_data)
            db.add(cafe)
        db.commit()
        print(f"-> Cafes committed. Total in DB: {db.query(Cafe).count()}")

        # 2. МИГРАЦИЯ КАТЕГОРИЙ И МЕНЮ
        categories_data_path = 'data/categories.json'
        with open(categories_data_path, 'r', encoding='utf-8') as f:
            all_categories = json.load(f)
        all_category_ids = [cat['id'] for cat in all_categories]
        
        cafe_category_mapping = {
            "ezh-1": all_category_ids,
            "ezh-2": [cid for cid in all_category_ids if 'kofe' in cid or 'coffee' in cid],
            "ezh-3": [cid for cid in all_category_ids if 'picca' in cid or 'pasta' in cid]
        }

        for cafe_id, category_ids in cafe_category_mapping.items():
            print(f"\n--- Processing Cafe ID: {cafe_id} ---")
            for category_id in category_ids:
                cat_data = next((c for c in all_categories if c['id'] == category_id), None)
                if not cat_data:
                    print(f"  WARNING: Data for category '{category_id}' not found in categories.json. Skipping.")
                    continue
                
                print(f"  -> Adding Category: {cat_data['name']}")
                category = Category(
                    id=cat_data.get('id'),
                    cafe_id=cafe_id,
                    icon=cat_data.get('icon'),
                    name=cat_data.get('name'),
                    background_color=cat_data.get('backgroundColor')
                )
                db.add(category)

                menu_path = f"data/menu/{category_id}.json"
                if os.path.exists(menu_path):
                    with open(menu_path, 'r', encoding='utf-8') as f:
                        menu_items = json.load(f)
                        for item_data in menu_items:
                            print(f"    -> Adding MenuItem: {item_data.get('name')}")
                            menu_item = MenuItem(
                                id=item_data.get('id'),
                                cafe_id=cafe_id,
                                category_id=category_id,
                                image=item_data.get('image'),
                                name=item_data.get('name'),
                                description=item_data.get('description'),
                                variants=item_data.get('variants'),
                                addons=item_data.get('addons')
                            )
                            db.add(menu_item)
            db.commit()
            print(f"-> Committed data for cafe: {cafe_id}")
    
    except Exception as e:
        print(f"\n !!! AN ERROR OCCURRED DURING MIGRATION: {e} !!! \n")
        db.rollback()
    finally:
        print(f"\n--- MIGRATION FINISHED ---")
        print(f"Total Cafes: {db.query(Cafe).count()}")
        print(f"Total Categories: {db.query(Category).count()}")
        print(f"Total Menu Items: {db.query(MenuItem).count()}")
        db.close()

if __name__ == "__main__":
    migrate()