import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Читаем DATABASE_URL из переменных окружения.
# В Docker Compose env_file уже делает это, так что os.getenv() сработает.
DATABASE_URL = os.getenv("DATABASE_URL")

# Добавим проверку на всякий случай
if not DATABASE_URL:
    # Это сообщение также появится в логах контейнера, если DATABASE_URL не установлена
    print("Error: DATABASE_URL environment variable is not set in app.database!")
    # В реальном приложении можно поднять исключение или логировать критическую ошибку
    # Для простоты примера пока оставим так, но создание engine, вероятно, упадет.

# Создаем движок SQLAlchemy.
# disable_autoload_of_col=True - может быть полезно для некоторых версий SQLAlchemy/psycopg2
engine = create_engine(DATABASE_URL, pool_pre_ping=True) # pool_pre_ping помогает избежать ошибок "server has gone away"

# Создаем настроенный класс Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Импортируем Base из ваших моделей, чтобы она была зарегистрирована при создании движка
# from .models import Base # Убедитесь, что этот импорт присутствует, если Base определена в models.py

# Внимание: Вызов Base.metadata.create_all(bind=engine) лучше делать в startup event FastAPI
# в main.py или в скрипте миграции, а не здесь при импорте модуля.
# Это может привести к проблемам с многопоточностью/процессами.
# Base.metadata.create_all(bind=engine) # <-- Эту строку здесь НЕ НУЖНО!