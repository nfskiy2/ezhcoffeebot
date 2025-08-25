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
            # ... (данные кофеен без изменений) ...
        ]
        
        # ... (код миграции кофеен без изменений) ...

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
                                addons=item_data.get('addons'),
                                sub_category=item_data.get('subCategory') # <-- ДОБАВЛЕНО
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