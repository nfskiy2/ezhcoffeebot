FROM python:3.11

# Устанавливаем необходимые системные зависимости, включая netcat
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файл зависимостей и устанавливаем их
# Это делается первым, чтобы Docker мог кэшировать этот слой
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем скрипт entrypoint и делаем его исполняемым
# entrypoint.sh будет ждать готовности БД и запускать миграции
COPY entrypoint.sh .
RUN chmod +x /app/entrypoint.sh

RUN mkdir /app/uploads


COPY set_webhook.py .

# Копируем остальной код приложения (папки app и data)
COPY app /app/app
COPY data /app/data
# Также скопируем сам скрипт миграции
COPY migrate_data.py .

# Открываем порт, на котором будет работать FastAPI (по умолчанию uvicorn использует 8000)
EXPOSE 8000

# Определяем команду, которая будет выполняться при запуске контейнера
# Используем entrypoint скрипт
ENTRYPOINT ["/app/entrypoint.sh"]