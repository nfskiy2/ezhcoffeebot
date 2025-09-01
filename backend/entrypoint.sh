#!/bin/bash
# entrypoint.sh
set -e
# Ожидание готовности базы данных
DB_HOST=$(echo $DATABASE_URL | cut -d '@' -f 2 | cut -d ':' -f 1)
DB_PORT=$(echo $DATABASE_URL | sed -e 's#^.*:##' -e 's#/.*##')

echo "Waiting for database at $DB_HOST:$DB_PORT..."
count=0
while ! nc -z $DB_HOST $DB_PORT; do
  count=$((count+1))
  if [ $count -gt 30 ]; then
    echo "Database at $DB_HOST:$DB_PORT not available after 30 seconds. Exiting."
    exit 1
  fi
  echo "Database at $DB_HOST:$DB_PORT not ready yet. Waiting..."
  sleep 1
done
echo "Database at $DB_HOST:$DB_PORT is available."

# Запуск миграций (создание таблиц и наполнение данными)
echo "Running database migrations..."
python /app/migrate_data.py

# ЗАПУСК СКРИПТА УСТАНОВКИ ВЕБХУКА
echo "Running webhook setup script..."
python /app/set_webhook.py # <-- ИЗМЕНЕНИЕ ЗДЕСЬ!

# Запуск основного приложения FastAPI
echo "Starting FastAPI app..."
# Добавляем флаги для корректной работы за реверс-прокси (Nginx)
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'