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
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate():
    db = SessionLocal()
    try:
        print("\n--- STARTING MIGRATION ---")

        # Удаляем все старые данные перед миграцией для чистоты
        db.query(MenuItem).delete()
        db.query(Category).delete()
        db.query(Cafe).delete()
        db.query(Order).delete()
        db.commit()
        print("-> Old data cleared.")

        # 1. МИГРАЦИЯ КОФЕЕН И ДОСТАВКИ
        print("Migrating cafes...")
        cafes_data = [
            # ... (ваши кафе ezh-1, ezh-2, ezh-3) ...
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
            },
            {
                "id": "delivery-tomsk",
                "name": "Доставка по Томску",
                "cover_image": "https://images.unsplash.com/photo-1588001405580-86d354a8a8a4?auto=format&fit=crop&q=80&w=1974",
                "logo_image": "icons/icon-delivery.svg",
                "kitchen_categories": "Все меню на доставку",
                "rating": "",
                "cooking_time": "30-60 мин",
                "status": "Доступна",
                "opening_hours": "пн-вс: 10:00-21:00",
                "min_order_amount": 15000
            }
        ]
        
        for cafe_data in cafes_data:
            db.merge(Cafe(**cafe_data))
        db.commit()
        print(f"-> Cafes committed. Total in DB: {db.query(Cafe).count()}")

        # 2. МИГРАЦИЯ КАТЕГОРИЙ И МЕНЮ
        with open('data/categories.json', 'r', encoding='utf-8') as f:
            all_categories = json.load(f)
        
        all_cafes = db.query(Cafe).all()

        for cafe in all_cafes:
            print(f"\n--- Processing Cafe: {cafe.name} ({cafe.id}) ---")
            
            # --- НОВАЯ УМНАЯ ЛОГИКА ---
            is_delivery = cafe.id.startswith('delivery-')
            if is_delivery:
                # Извлекаем город из ID, например, "delivery-tomsk" -> "tomsk"
                city = cafe.id.split('-', 1)[1]
                base_menu_path = f"data/delivery_menu/{city}"
            else:
                base_menu_path = "data/menu"
            
            print(f"  -> Using menu path: {base_menu_path}")

            # Для простоты примера, все кафе (включая доставку) имеют все категории.
            # Эту логику можно усложнить, если нужно.
            for cat_data in all_categories:
                db.merge(Category(
                    id=cat_data.get('id'),
                    cafe_id=cafe.id,
                    icon=cat_data.get('icon'),
                    name=cat_data.get('name'),
                    background_color=cat_data.get('backgroundColor')
                ))

                menu_file_path = f"{base_menu_path}/{cat_data.get('id')}.json"
                if os.path.exists(menu_file_path):
                    with open(menu_file_path, 'r', encoding='utf-8') as f:
                        menu_items = json.load(f)
                        print(f"    -> Loading {len(menu_items)} items from {menu_file_path}")
                        for item_data in menu_items:
                            db.merge(MenuItem(
                                id=item_data.get('id'),
                                cafe_id=cafe.id,
                                category_id=cat_data.get('id'),
                                image=item_data.get('image'),
                                name=item_data.get('name'),
                                description=item_data.get('description'),
                                variants=item_data.get('variants'),
                                addons=item_data.get('addons'),
                                sub_category=item_data.get('subCategory')
                            ))
                else:
                    print(f"    -> WARNING: Menu file not found at {menu_file_path}. Skipping.")
        
        db.commit()
        print("\n-> All categories and menu items committed.")
    
    except Exception as e:
        print(f"\n !!! AN ERROR OCCURRED DURING MIGRATION: {e} !!! \n")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        print(f"\n--- MIGRATION FINISHED ---")
        print(f"Total Cafes: {db.query(Cafe).count()}")
        print(f"Total Categories: {db.query(Category).count()}")
        print(f"Total Menu Items: {db.query(MenuItem).count()}")
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    migrate()