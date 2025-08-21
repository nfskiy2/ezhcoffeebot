# backend/app/main.py
import json
import os
import asyncio
import logging
from fastapi import FastAPI, Request, Depends, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from typing import Any, Optional, List
import contextlib

# Импорты компонентов
from . import auth
from .bot import initialize_bot_app, create_invoice_link, WEBHOOK_PATH
from .database import engine, SessionLocal
from .models import Base, Category, MenuItem, Cafe, Order
from .schemas import CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema, CafeSchema
from telegram import Update, LabeledPrice, Bot
from telegram.ext import Application
from urllib.parse import parse_qs

load_dotenv()

# --- Получение переменных окружения ---
BOT_TOKEN = os.getenv('BOT_TOKEN')
APP_URL = os.getenv('APP_URL')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')

# Настройка логирования
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Глобальные переменные для Telegram Bot ---
_application_instance: Optional[Application] = None
_bot_instance: Optional[Bot] = None


# --- Lifespan Event Handler ---
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI lifespan startup event triggered.")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables checked/created.")

    global _application_instance, _bot_instance
    _application_instance = await initialize_bot_app()
    _bot_instance = _application_instance.bot
    logger.info("Telegram Bot application initialized.")
    await _application_instance.initialize()
    logger.info("Telegram Bot Application fully initialized.")

    logger.info("FastAPI startup complete. Yielding control to application.")
    yield
    logger.info("FastAPI lifespan shutdown event triggered.")
    if _application_instance is not None:
        await _application_instance.shutdown()
        logger.info("Telegram Bot Application closed.")
    logger.info("FastAPI lifespan shutdown complete.")


# --- Инициализация FastAPI ---
app = FastAPI(lifespan=lifespan)

# --- Настройка CORS ---
allowed_origins = []
if APP_URL:
    allowed_origins.append(APP_URL)

DEV_MODE = os.getenv('DEV_MODE') is not None
if DEV_MODE:
    DEV_APP_URL = os.getenv('DEV_APP_URL')
    if DEV_APP_URL:
        allowed_origins.append(DEV_APP_URL)

DEV_TUNNELS_REGEX = r"https://\w+-[0-9]+\.[\w\d]+\.devtunnels\.ms"

logger.info(f"Allowed CORS origins: {allowed_origins}")
logger.info(f"Allowed CORS regex: {DEV_TUNNELS_REGEX}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=DEV_TUNNELS_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- Зависимости (Dependencies) ---
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_bot_instance() -> Bot:
    if _bot_instance is None:
        raise HTTPException(status_code=500, detail="Bot service is not ready.")
    return _bot_instance

def get_application_instance() -> Application:
    if _application_instance is None:
        raise HTTPException(status_code=500, detail="Bot application not initialized.")
    return _application_instance

# --- API Эндпоинты ---
@app.get("/")
async def read_root():
    return {"message": "Welcome to Laurel Cafe API!"}

@app.post(WEBHOOK_PATH)
async def bot_webhook(request: Request, application_instance: Application = Depends(get_application_instance)):
    try:
        update_json = await request.json()
        update = Update.de_json(update_json, application_instance.bot)
        await application_instance.process_update(update)
        return {"message": "OK"}
    except Exception as e:
        logger.error(f"Error processing webhook update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing update.")

@app.get("/cafes", response_model=List[CafeSchema])
def get_all_cafes(db: Session = Depends(get_db_session)):
    try:
        cafes = db.query(Cafe).all()
        return cafes
    except Exception as e:
        logger.error(f"Error fetching all cafes from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching cafes.")

@app.get("/cafes/{cafe_id}", response_model=CafeSchema)
def get_cafe_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    try:
        cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
        if not cafe:
            raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
        return cafe
    except Exception as e:
        logger.error(f"Error fetching cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching cafe info.")

@app.get("/cafes/{cafe_id}/categories", response_model=List[CategorySchema])
def get_categories_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)):
    try:
        cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
        if not cafe:
            raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
        return cafe.categories
    except Exception as e:
        logger.error(f"Error fetching categories for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching categories.")

@app.get("/cafes/{cafe_id}/popular", response_model=List[MenuItemSchema])
def get_popular_menu_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)):
    try:
        cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
        if not cafe:
            raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
        if cafe.categories:
            first_category = cafe.categories[0]
            popular_items = db.query(MenuItem).filter(
                MenuItem.category_id == first_category.id,
                MenuItem.cafe_id == cafe_id
            ).limit(3).all()
            return popular_items
        else:
            return []
    except Exception as e:
        logger.error(f"Error fetching popular menu for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching popular menu data.")

@app.get("/cafes/{cafe_id}/menu/{category_id}", response_model=List[MenuItemSchema])
def get_category_menu_by_cafe(cafe_id: str, category_id: str, db: Session = Depends(get_db_session)):
    try:
        category = db.query(Category).filter(Category.id == category_id, Category.cafe_id == cafe_id).first()
        if not category:
            raise HTTPException(status_code=404, detail=f"Could not find '{category_id}' category data for cafe '{cafe_id}'.")
        return category.menu_items
    except Exception as e:
        logger.error(f"Error fetching menu for category {category_id} of cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu data.")

@app.get("/cafes/{cafe_id}/menu/details/{menu_item_id}", response_model=MenuItemSchema)
def get_menu_item_details_by_cafe(cafe_id: str, menu_item_id: str, db: Session = Depends(get_db_session)):
    try:
        menu_item = db.query(MenuItem).filter(
            MenuItem.id == menu_item_id,
            MenuItem.cafe_id == cafe_id
        ).first()
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Could not find menu item data with '{menu_item_id}' ID for cafe '{cafe_id}'.")
        return menu_item
    except Exception as e:
        logger.error(f"Error fetching menu item {menu_item_id} details for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu item details.")

@app.get("/cafes/{cafe_id}/settings", response_model=CafeSettingsSchema)
def get_cafe_settings_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    try:
        cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
        if not cafe:
            raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
        return CafeSettingsSchema(min_order_amount=cafe.min_order_amount)
    except Exception as e:
        logger.error(f"Error fetching settings for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching cafe settings.")


@app.post("/cafes/{cafe_id}/order")
async def create_order(
    cafe_id: str,
    order_data: OrderRequest,
    db: Session = Depends(get_db_session),
    bot_instance: Bot = Depends(get_bot_instance)
):
    logger.info(f"Received order request for cafe: {cafe_id}.")
    
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found for order.")
    min_order_amount = cafe.min_order_amount

    if not auth.validate_auth_data(BOT_TOKEN, order_data.auth):
        logger.warning("Invalid auth data received in order request.")
        raise HTTPException(status_code=401, detail="Invalid auth data.")
    logger.info("Auth data validated.")

    if not order_data.cartItems:
        logger.warning("Cart Items are not provided.")
        raise HTTPException(status_code=400, detail="Cart Items are not provided.")
    logger.info(f"Received {len(order_data.cartItems)} items in cart.")

    labeled_prices = []
    total_amount_in_minimal_units = 0
    for item in order_data.cartItems:
        try:
            db_menu_item = db.query(MenuItem).filter(
                MenuItem.id == item.cafeItem.id,
                MenuItem.cafe_id == cafe_id,
                MenuItem.category_id == item.categoryId
            ).first()
            if not db_menu_item:
                logger.warning(f"Item {item.cafeItem.id} not found or does not belong to cafe {cafe_id}.")
                raise HTTPException(status_code=400, detail=f"Item {item.cafeItem.id} not found or invalid for this cafe.")

            db_variant = next((v for v in db_menu_item.variants if v['id'] == item.variant.id), None)
            if not db_variant:
                logger.warning(f"Variant {item.variant.id} not found for item {item.cafeItem.id} or invalid.")
                raise HTTPException(status_code=400, detail="Invalid item variant selected.")

            cost_in_minimal_unit = int(db_variant['cost'])
            quantity = item.quantity
            price_for_item = cost_in_minimal_unit * quantity
            total_amount_in_minimal_units += price_for_item

            labeled_price = LabeledPrice(
                label=f'{item.cafeItem.name} ({item.variant.name}) x{quantity}',
                amount=price_for_item
            )
            labeled_prices.append(labeled_price)
        except ValueError:
             logger.error(f"Invalid cost or quantity value for item {item.cafeItem.id}.")
             raise HTTPException(status_code=400, detail="Invalid item data.")
        except Exception as e:
            logger.error(f"Error processing item {item.cafeItem.id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error processing order items.")

    logger.info(f"Total order amount in minimal units: {total_amount_in_minimal_units}")

    if min_order_amount > 0 and total_amount_in_minimal_units < min_order_amount:
        logger.warning(f"Order total {total_amount_in_minimal_units} is less than min_order_amount {min_order_amount}")
        raise HTTPException(
            status_code=400,
            detail=f"Order total is too low. Minimum order amount is {min_order_amount} in minimal units."
        )
    
    user_info_dict = {}
    try:
        # initData - это URL-encoded строка, парсим ее
        parsed_auth_data = parse_qs(order_data.auth)
        if 'user' in parsed_auth_data:
            user_data_json = parsed_auth_data['user'][0]
            user_info_dict = json.loads(user_data_json)
    except Exception as e:
        logger.error(f"Could not parse user info from initData: {e}")
        # Не блокируем заказ, если не удалось распарсить, но логируем

    # 3. Создаем и сохраняем заказ в базе данных
    new_order = Order(
        cafe_id=cafe_id,
        user_info=user_info_dict,
        cart_items=[item.dict() for item in order_data.cartItems], # Сохраняем Pydantic модели как dict
        total_amount=total_amount_in_minimal_units,
        currency="RUB" # Или любая ваша валюта
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order) # Получаем сгенерированный ID
    logger.info(f"Order {new_order.id} created and saved to DB.")

    # 4. Создаем инвойс, используя ID нашего заказа как payload
    invoice_url = await create_invoice_link(
        prices=labeled_prices,
        payload=str(new_order.id), # <--- ПЕРЕДАЕМ НАШ ID ЗАКАЗА
        bot_instance=bot_instance
    )


    # invoice_url = await create_invoice_link(prices=labeled_prices, bot_instance=bot_instance)
    # if invoice_url is None:
    #     logger.error("Failed to get invoice URL from bot.")
    #     raise HTTPException(status_code=500, detail="Could not create invoice.")
    # logger.info(f"Invoice URL created for order: {invoice_url}")
    # return { 'invoiceUrl': invoice_url }