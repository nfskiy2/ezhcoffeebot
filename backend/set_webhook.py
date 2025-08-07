import asyncio
import os
import logging
from dotenv import load_dotenv

# Настройка логирования для скрипта
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Загружаем переменные окружения
load_dotenv()

# Импортируем только необходимые функции и классы из bot.py
from app.bot import initialize_bot_app, setup_webhook

async def main():
    logger.info("Starting set_webhook script...")

    application = await initialize_bot_app() 

    # Устанавливаем вебхук
    await setup_webhook(application)
    logger.info("Webhook setup completed by script.")

if __name__ == "__main__":
    asyncio.run(main())
