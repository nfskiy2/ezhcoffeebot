import json
import os
import asyncio
import logging
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from typing import Any, Optional
import contextlib
# from functools import lru_cache # <--- ЭТУ СТРОКУ УДАЛИТЬ ИЛИ ЗАКОММЕНТИРОВАТЬ!


# Импорты компонентов модернизированного бэкенда
from . import auth
# Импортируем функции из bot.py
# initialize_bot_app теперь НЕ async
# setup_webhook больше не импортируется сюда, так как он вызывается из отдельного скрипта set_webhook.py
from .bot import initialize_bot_app, create_invoice_link, WEBHOOK_PATH
from .database import engine, SessionLocal
from .models import Base, Category, MenuItem
from .schemas import CafeInfoSchema, CategorySchema, MenuItemSchema, OrderRequest
from telegram import Update, LabeledPrice, Bot # Импортируем Update, LabeledPrice, Bot
from telegram.ext import Application # Импортируем Application для типизации

load_dotenv()

# Получаем переменные окружения, необходимые для FastAPI и CORS
BOT_TOKEN = os.getenv('BOT_TOKEN')
APP_URL = os.getenv('APP_URL')
DEV_APP_URL = os.getenv('DEV_APP_URL')
DEV_MODE = os.getenv('DEV_MODE') is not None
DEV_TUNNEL_URL = os.getenv('DEV_TUNNEL_URL') # URL Dev Tunnel для CORS

# Настройка логирования для main.py
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)


# --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ХРАНЕНИЯ Application и Bot ---
# Они будут инициализированы в lifespan и доступны в эндпоинтах.
_application_instance: Optional[Application] = None
_bot_instance: Optional[Bot] = None


# --- LIFESPAN EVENT HANDLER (Инициализация Application и Bot здесь) ---
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Обработчик событий жизненного цикла приложения FastAPI.
    Выполняется при запуске и завершении работы приложения.
    """
    logger.info("FastAPI lifespan startup event triggered.")

    # Логика startup
    Base.metadata.create_all(bind=engine) # Создаем таблицы в БД
    logger.info("Database tables checked/created.")

    # --- ИНИЦИАЛИЗАЦИЯ TELEGRAM BOT В LIFESPAN И СОХРАНЕНИЕ В app.state ---
    global _application_instance, _bot_instance # Объявляем, что будем работать с глобальными переменными
    _application_instance = initialize_bot_app() # <-- initialize_bot_app теперь НЕ async
    _bot_instance = _application_instance.bot

    logger.info("Telegram Bot application initialized.")
    await _application_instance.initialize() # Явная АСИНХРОННАЯ инициализация Application
    logger.info("Telegram Bot Application fully initialized.")

    # Установка вебхука происходит в set_webhook.py, здесь он не нужен.
    # await setup_webhook(_application_instance) # Если set_webhook.py удален, можно использовать здесь
    # logger.info("Webhook setup function called from lifespan.")

    logger.info("FastAPI startup complete. Yielding control to application.")

    yield # <-- Здесь приложение начинает обрабатывать запросы

    # --- SHUTDOWN LOGIC: Очистка асинхронных клиентов httpx ---
    logger.info("FastAPI lifespan shutdown event triggered.")
    if _application_instance is not None:
        try:
            logger.info("Closing Telegram Bot Application...")
            await _application_instance.shutdown() # <-- ОЧЕНЬ ВАЖНО: Вызов shutdown()
            logger.info("Telegram Bot Application closed.")
        except Exception as e:
            logger.error(f"Error during Telegram Bot Application shutdown: {e}")

    logger.info("FastAPI lifespan shutdown complete.")


# Инициализация FastAPI приложения
# LIFESPAN передается в конструктор
app = FastAPI(lifespan=lifespan)


# Настройка CORS middleware (должна идти ПОСЛЕ инициализации app)
allowed_origins = [APP_URL]
if DEV_MODE and DEV_APP_URL:
    allowed_origins.append(DEV_APP_URL)
if DEV_TUNNEL_URL:
    allowed_origins.append(DEV_TUNNEL_URL)

allowed_origins = [url for url in allowed_origins if url is not None]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все методы (GET, POST и т.д.)
    allow_headers=["*"], # Разрешаем все заголовки
)


# Dependency для получения сессии базы данных
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Dependency для получения объекта Bot ---
# Используем ее для внедрения объекта Bot в эндпоинты
# ЭТОТ СПОСОБ РАБОТЫ СО СТАТУСОМ ГЛОБАЛЬНОГО БОТА
def get_bot_instance(request: Request) -> Bot:
    """Возвращает экземпляр Bot из глобальной переменной _bot_instance."""
    # Используем глобальную переменную _bot_instance, которая инициализируется в lifespan
    if _bot_instance is None:
        logger.error("Bot instance is not initialized! Lifespan startup likely failed or not complete.")
        raise HTTPException(status_code=500, detail="Bot service is not ready.")
    return _bot_instance


# --- Dependency для получения объекта Application ---
# Используем ее для внедрения объекта Application (например, для process_update)
def get_application_instance(request: Request) -> Application:
    """Возвращает экземпляр Application из глобальной переменной _application_instance."""
    # Используем глобальную переменную _application_instance, которая инициализируется в lifespan
    if _application_instance is None:
        logger.error("Application instance is not initialized! Lifespan startup likely failed or not complete.")
        raise HTTPException(status_code=500, detail="Bot application not initialized.")
    return _application_instance


# --- API эндпоинты ---
# Все эндпоинты должны быть определены ЗДЕСЬ

@app.get("/")
async def read_root():
    return {"message": "Welcome to Laurel Cafe API!"}

@app.post(WEBHOOK_PATH)
async def bot_webhook(
    request: Request,
    bot_instance: Bot = Depends(get_bot_instance), # Внедряем Bot
    application_instance: Application = Depends(get_application_instance) # Внедряем Application
):
    """Принимает обновления от Telegram API через вебхук."""
    try:
        update_json = await request.json()
        update = Update.de_json(update_json, bot_instance)
        # Process update directly on application instance
        await application_instance.process_update(update)
        return {"message": "OK"}
    except Exception as e:
        logger.error(f"Error processing webhook update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing update.")


@app.get("/info", response_model=CafeInfoSchema)
def get_cafe_info():
    """API endpoint for providing info about the cafe."""
    try:
        with open('data/info.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("Info data file not found.")
        raise HTTPException(status_code=404, detail="Could not find info data.")
    except json.JSONDecodeError:
         logger.error("Error decoding info data file.")
         raise HTTPException(status_code=500, detail="Error reading info data.")


@app.get("/categories", response_model=list[CategorySchema])
def get_categories(db: Session = Depends(get_db_session)):
    """API endpoint for providing available cafe categories."""
    try:
        categories = db.query(Category).all()
        return categories
    except Exception as e:
        logger.error(f"Error fetching categories from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching categories.")


@app.get("/menu/{category_id}", response_model=list[MenuItemSchema])
def get_category_menu(category_id: str, db: Session = Depends(get_db_session)):
    """API endpoint for providing menu list of specified category."""
    try:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            logger.warning(f"Category '{category_id}' not found.")
            raise HTTPException(status_code=404, detail=f"Could not find '{category_id}' category data.")
        return category.menu_items
    except Exception as e:
        logger.error(f"Error fetching menu for category {category_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu data.")


@app.get("/menu/details/{menu_item_id}", response_model=MenuItemSchema)
def get_menu_item_details(menu_item_id: str, db: Session = Depends(get_db_session)):
    """API endpoint for providing menu item details."""
    try:
        menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
        if not menu_item:
            logger.warning(f"Menu item with ID '{menu_item_id}' not found.")
            raise HTTPException(status_code=404, detail=f"Could not find menu item data with '{menu_item_id}' ID.")
        return menu_item
    except Exception as e:
        logger.error(f"Error fetching menu item {menu_item_id} details from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu item details.")


@app.post("/order")
async def create_order( # Асинхронный эндпоинт
    order_data: OrderRequest,
    request: Request,
    db: Session = Depends(get_db_session),
    bot_instance: Bot = Depends(get_bot_instance)
):
    logger.info("Received order request.")

    if not auth.validate_auth_data(BOT_TOKEN, order_data.auth_data):
        logger.warning("Invalid auth data received in order request.")
        raise HTTPException(status_code=401, detail="Invalid auth data.")
    logger.info("Auth data validated.")

    if not order_data.cart_items:
        logger.warning("Cart Items are not provided.")
        raise HTTPException(status_code=400, detail="Cart Items are not provided.")
    logger.info(f"Received {len(order_data.cart_items)} items in cart.")

    labeled_prices = []
    for item in order_data.cart_items:
        try:
            cost_in_minimal_unit = int(item.variant.cost)
            quantity = item.quantity
            price = cost_in_minimal_unit * quantity

            labeled_price = LabeledPrice( # LabeledPrice from telegram
                label=f'{item.cafe_item.name} ({item.variant.name}) x{quantity}',
                amount=price
            )
            labeled_prices.append(labeled_price)
        except ValueError:
             logger.error(f"Invalid cost or quantity value for item {item.cafe_item.id}.")
             raise HTTPException(status_code=400, detail="Invalid item data.")
        except Exception as e:
            logger.error(f"Error processing item {item.cafe_item.id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error processing order items.")

    invoice_url = await create_invoice_link(prices=labeled_prices, bot_instance=bot_instance)

    if invoice_url is None:
        logger.error("Failed to get invoice URL from bot.")
        raise HTTPException(status_code=500, detail="Could not create invoice.")

    logger.info(f"Invoice URL created for order: {invoice_url}")

    return { 'invoiceUrl': invoice_url }