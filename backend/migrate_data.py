import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Category, MenuItem # Убедитесь, что путь правильный
from urllib.parse import urlparse

# Настройки подключения к БД (используйте .env или хардкод для скрипта миграции)
# from dotenv import load_dotenv
# load_dotenv()
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/laurel_cafe_db")
DATABASE_URL = os.getenv("DATABASE_URL")

# Добавим проверку, что переменная установлена
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set!")
    exit(1) # Выходим с ошибкой, если переменная не установлена

# Парсим URL для извлечения параметров
parsed_url = urlparse(DATABASE_URL)

# Формируем словарь параметров для psycopg2
db_params = {
    "database": parsed_url.path.lstrip("/"),
    "user": parsed_url.username,
    "password": parsed_url.password,
    "host": parsed_url.hostname,
    "port": parsed_url.port,
    "client_encoding": "utf8" # <-- Добавляем эту строку
}

# --- Диагностический вывод ---
print("-" * 20)
print(f"Attempting to connect with URL: {DATABASE_URL}")
print(f"Parsed parameters:")
print(f"  Scheme: {parsed_url.scheme}")
print(f"  Path: {parsed_url.path}")
print(f"  Username: {parsed_url.username}")
print(f"  Password: {parsed_url.password}") # Осторожно с выводом пароля!
print(f"  Hostname: {parsed_url.hostname}")
print(f"  Port: {parsed_url.port}")
print(f"Parameters passed to connect_args: {db_params}")
print("-" * 20)
# --- Конец диагностического вывода ---


# Создаем движок, передавая параметры явно через connect_args
engine = create_engine(
    f"postgresql://", # Minimal DSN string just specifying the dialect
    connect_args=db_params # Pass the extracted parameters here
)

print("SQLAlchemy engine created. Attempting to create tables...")

# Создаем таблицы, если они не существуют. Ошибка происходит здесь.
Base.metadata.create_all(engine)

print("Tables created successfully.") # Эта строка не будет достигнута, если create_all падает

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def migrate():
    db = next(get_db()) # Получаем сессию БД

    # Миграция категорий
    with open('data/categories.json', 'r', encoding='utf-8') as f:
        categories_data = json.load(f)
        for cat_data in categories_data:
            existing_cat = db.query(Category).filter(Category.id == cat_data['id']).first()
            if not existing_cat:
                category = Category(
                    id=cat_data['id'],
                    icon=cat_data['icon'],
                    name=cat_data['name'],
                    background_color=cat_data['backgroundColor']
                )
                db.add(category)
    db.commit()
    print("Categories migrated.")

    # Миграция пунктов меню
    menu_data_path = 'data/menu'
    for filename in os.listdir(menu_data_path):
        if filename.endswith('.json'):
            category_id = filename.replace('.json', '')
            category = db.query(Category).filter(Category.id == category_id).first()
            if not category:
                 print(f"Warning: Category {category_id} not found for file {filename}. Skipping menu items.")
                 continue

            with open(os.path.join(menu_data_path, filename), 'r', encoding='utf-8') as f:
                menu_items_data = json.load(f)
                for item_data in menu_items_data:
                    existing_item = db.query(MenuItem).filter(MenuItem.id == item_data['id']).first()
                    if not existing_item:
                        menu_item = MenuItem(
                            id=item_data['id'],
                            category_id=category_id,
                            image=item_data['image'],
                            name=item_data['name'],
                            description=item_data['description'],
                            variants=item_data['variants']
                        )
                        db.add(menu_item)
        db.commit()
        print(f"Menu items for category '{category_id}' migrated.")


    db.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()