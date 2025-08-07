import psycopg2
import os
from urllib.parse import urlparse

# Используйте ту же строку подключения
DATABASE_URL = "postgresql://user:password@localhost:5432/laurel_cafe_db"

try:
    print(f"Attempting direct psycopg2 connection using DSN: {DATABASE_URL}")
    # Попробуем сначала с DSN строкой
    conn = psycopg2.connect(DATABASE_URL)
    print("Direct connection with DSN successful!")
    conn.close()
except Exception as e:
    print(f"Direct connection with DSN failed: {e}")
    import traceback
    traceback.print_exc()

print("-" * 20)

# Теперь попробуем передать параметры явно, как мы делали для SQLAlchemy
try:
    print("Attempting direct psycopg2 connection using keywords...")
    parsed_url = urlparse(DATABASE_URL)
    db_params = {
        "database": parsed_url.path.lstrip("/"),
        "user": parsed_url.username,
        "password": parsed_url.password,
        "host": parsed_url.hostname,
        "port": parsed_url.port,
        "client_encoding": "UTF8" # Явно указываем кодировку
    }
    conn = psycopg2.connect(**db_params) # Передаем словарь как keyword arguments
    print("Direct connection with keywords successful!")
    conn.close()
except Exception as e:
    print(f"Direct connection with keywords failed: {e}")
    import traceback
    traceback.print_exc()

print("-" * 20)
print("Connection tests finished.")