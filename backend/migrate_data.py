# backend/migrate_data.py
import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Category, MenuItem, Cafe
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

print("-" * 20)
print(f"Attempting to connect with URL: {DATABASE_URL}")
print(f"Parsed parameters: {db_params}")
print("-" * 20)

engine = create_engine(
    f"postgresql://",
    connect_args=db_params
)

print("SQLAlchemy engine created. Attempting to create tables...")

# Создаем таблицы, если они не существуют
Base.metadata.create_all(engine)

print("Tables created successfully.")

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
    print("Migrating cafes...")
    cafes_data = [
        {
            "id": "laurel_main",
            "name": "Laurel Cafe (Main Branch)",
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
            "id": "laurel_coffee_only",
            "name": "Laurel Coffee Express",
            "coverImage": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=center&w=1920&q=80",
            "logoImage": "icons/logo-laurel.svg",
            "kitchenCategories": "Coffee, Desserts",
            "rating": "4.8 (98)",
            "cookingTime": "2-5 mins",
            "status": "Open",
            "openingHours": "пн-пт: 07:00-19:00, сб: 08:00-17:00", 
            "minOrderAmount": 5000
        }
    ]

    for cafe_data in cafes_data:
        existing_cafe = db.query(Cafe).filter(Cafe.id == cafe_data['id']).first()
        if not existing_cafe:
            cafe = Cafe(
                id=cafe_data['id'],
                name=cafe_data['name'],
                cover_image=cafe_data['coverImage'],
                logo_image=cafe_data['logoImage'],
                kitchen_categories=cafe_data['kitchenCategories'],
                rating=cafe_data['rating'],
                cooking_time=cafe_data['cookingTime'],
                status=cafe_data['status'],
                opening_hours=cafe_data['openingHours'],
                min_order_amount=cafe_data['minOrderAmount']
            )
            db.add(cafe)
    db.commit()
    print("Cafes migrated.")

    # --- 2. МИГРАЦИЯ КАТЕГОРИЙ И ПУНКТОВ МЕНЮ (Category & MenuItem) ---
    menu_data_path = 'data/menu'
    categories_data_path = 'data/categories.json'

    with open(categories_data_path, 'r', encoding='utf-8') as f:
        all_categories = json.load(f)

    cafe_category_mapping = {
        "laurel_main": ["burgers", "pizza", "pasta", "ice-cream", "coffee"],
        "laurel_coffee_only": ["coffee"]
    }

    # Перебираем каждую кофейню и добавляем её категории и пункты меню
    for cafe_id, category_ids_for_cafe in cafe_category_mapping.items():
        print(f"Migrating categories and menu items for cafe: {cafe_id}")
        for category_id in category_ids_for_cafe:
            cat_data = next((c for c in all_categories if c['id'] == category_id), None)
            if not cat_data:
                print(f"Warning: Category data for '{category_id}' not found in categories.json. Skipping.")
                continue

            # Добавляем категорию для этой кофейни
            # Проверяем по составному ключу (id, cafe_id)
            existing_cat = db.query(Category).filter(
                Category.id == category_id,
                Category.cafe_id == cafe_id
            ).first()
            if not existing_cat:
                category = Category(
                    id=cat_data['id'],
                    cafe_id=cafe_id,
                    icon=cat_data['icon'],
                    name=cat_data['name'],
                    background_color=cat_data['backgroundColor']
                )
                db.add(category)
                # db.flush() # Удаляем flush, коммит будет позже

            # Миграция пунктов меню для этой категории и кофейни
            menu_filename = f"{category_id}.json"
            menu_file_path = os.path.join(menu_data_path, menu_filename)

            if not os.path.exists(menu_file_path):
                print(f"Warning: Menu file {menu_file_path} not found. Skipping menu items for this category.")
                continue

            if category_id == 'popular': # Пропускаем popular.json
                print(f"Skipping {menu_filename} as it's not a menu category.")
                continue

            with open(menu_file_path, 'r', encoding='utf-8') as f:
                menu_items_data = json.load(f)
                for item_data in menu_items_data:
                    # Проверяем по составному ключу (id, cafe_id)
                    existing_item = db.query(MenuItem).filter(
                        MenuItem.id == item_data['id'],
                        MenuItem.cafe_id == cafe_id # <--- Проверка по cafe_id
                    ).first()
                    if not existing_item:
                        menu_item = MenuItem(
                            id=item_data['id'],
                            cafe_id=cafe_id, # <--- Привязываем MenuItem к кофейне
                            category_id=category_id,
                            image=item_data['image'],
                            name=item_data['name'],
                            description=item_data['description'],
                            variants=item_data['variants']
                        )
                        db.add(menu_item)
        db.commit() # Коммит после каждой кофейни
        print(f"Finished migrating categories and menu items for cafe: {cafe_id}")

    db.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()