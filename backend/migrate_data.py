# backend/migrate_data.py
import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Category, MenuItem, Cafe, Order # Ensure Order is imported if you use it
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set!")
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

engine = create_engine(
    f"postgresql://",
    connect_args=db_params
)

Base.metadata.create_all(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def migrate():
    db = next(get_db())

    # --- 1. МИГРАЦИЯ ДАННЫХ КОФЕЕН (CAFE) ---
    print("Migrating cafes...")
    cafes_data = [
        {
            "id": "ezh-1", # ИЗМЕНЕНО
            "name": "EZH-1", # ИЗМЕНЕНО
            "coverImage": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
            "logoImage": "icons/logo-laurel.svg",
            "kitchenCategories": "American Barbeque, Dinner, Italian",
            "rating": "4.3 (212)",
            "cookingTime": "5-15 mins",
            "status": "Open",
            "openingHours": "пн-пт: 09:00-20:30, сб-вс: 10:00-19:00",
            "minOrderAmount": 10000
        },
        {
            "id": "ezh-2", # ИЗМЕНЕНО
            "name": "EZH-2", # ИЗМЕНЕНО
            "coverImage": "https://images.unsplash.com/photo-1495474472106-ccddc55a2977?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
            "logoImage": "icons/logo-laurel.svg",
            "kitchenCategories": "Coffee, Desserts",
            "rating": "4.8 (98)",
            "cookingTime": "2-5 mins",
            "status": "Open",
            "openingHours": "пн-пт: 07:00-19:00, сб: 08:00-17:00",
            "minOrderAmount": 5000
        },
        { # НОВАЯ КОФЕЙНЯ
            "id": "ezh-3",
            "name": "EZH-3",
            "coverImage": "https://images.unsplash.com/photo-1511920183276-5941b6593b4a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
            "logoImage": "icons/logo-laurel.svg",
            "kitchenCategories": "Pizza, Pasta",
            "rating": "4.5 (150)",
            "cookingTime": "10-20 mins",
            "status": "Open",
            "openingHours": "пн-вс: 11:00-22:00",
            "minOrderAmount": 12000
        }
    ]

    for cafe_data in cafes_data:
        existing_cafe = db.query(Cafe).filter(Cafe.id == cafe_data['id']).first()
        if not existing_cafe:
            cafe = Cafe(
                id=cafe_data.get('id'),
                name=cafe_data.get('name'),
                cover_image=cafe_data.get('coverImage'),
                logo_image=cafe_data.get('logoImage'),
                kitchen_categories=cafe_data.get('kitchenCategories'),
                rating=cafe_data.get('rating'),
                cooking_time=cafe_data.get('cookingTime'),
                status=cafe_data.get('status', 'Closed'),
                opening_hours=cafe_data.get('openingHours'),
                min_order_amount=cafe_data.get('minOrderAmount')
            )
            db.add(cafe)
    db.commit()
    print("Cafes migrated.")

    # --- 2. МИГРАЦИЯ КАТЕГОРИЙ И ПУНКТОВ МЕНЮ ---
    menu_data_path = 'data/menu'
    categories_data_path = 'data/categories.json'

    with open(categories_data_path, 'r', encoding='utf-8') as f:
        all_categories = json.load(f)

    all_category_ids = [cat['id'] for cat in all_categories]
    
    # ИЗМЕНЕНО: Обновляем маппинг для новых ID
    cafe_category_mapping = {
        "ezh-1": all_category_ids, # EZH-1 имеет все категории
        "ezh-2": [cid for cid in all_category_ids if 'kofe' in cid or 'coffee' in cid], # EZH-2 только кофе
        "ezh-3": [cid for cid in all_category_ids if 'picca' in cid or 'pasta' in cid] # EZH-3 только пицца и паста
    }

    for cafe_id, category_ids_for_cafe in cafe_category_mapping.items():
        print(f"Migrating categories and menu items for cafe: {cafe_id}")
        for category_id in category_ids_for_cafe:
            cat_data = next((c for c in all_categories if c['id'] == category_id), None)
            if not cat_data:
                print(f"Warning: Category data for '{category_id}' not found in categories.json. Skipping.")
                continue
            
            existing_cat = db.query(Category).filter(
                Category.id == category_id,
                Category.cafe_id == cafe_id
            ).first()
            if not existing_cat:
                category = Category(
                    id=cat_data['id'],
                    cafe_id=cafe_id,
                    icon=cat_data.get('icon'),
                    name=cat_data.get('name'),
                    background_color=cat_data.get('backgroundColor')
                )
                db.add(category)
            
            menu_filename = f"{category_id}.json"
            menu_file_path = os.path.join(menu_data_path, menu_filename)

            if not os.path.exists(menu_file_path):
                continue
            
            with open(menu_file_path, 'r', encoding='utf-8') as f:
                menu_items_data = json.load(f)
                for item_data in menu_items_data:
                    existing_item = db.query(MenuItem).filter(
                        MenuItem.id == item_data['id'],
                        MenuItem.cafe_id == cafe_id
                    ).first()
                    if not existing_item:
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
        print(f"Finished migrating categories and menu items for cafe: {cafe_id}")

    db.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()