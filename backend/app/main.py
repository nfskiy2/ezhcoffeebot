# backend/app/main.py
import json
import os
import asyncio
import logging
import httpx
from fastapi import FastAPI, Request, Depends, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from dotenv import load_dotenv
from typing import Any, Optional, List
import contextlib

# Импорты компонентов
from . import auth
from .bot import initialize_bot_app, create_invoice_link, WEBHOOK_PATH
from .database import engine, SessionLocal
# Импортируем новые модели
from .models import (
    Base, Category, Cafe, Order, GlobalProduct, 
    GlobalProductVariant, VenueMenuItem, VenueAddonItem, GlobalAddonGroup, GlobalAddonItem
)
from .schemas import (
    CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema, CafeSchema,
    AddressSuggestionRequest, DadataSuggestionResponse
)
from telegram import Update, LabeledPrice, Bot
from telegram.ext import Application
from urllib.parse import parse_qs
from sqlalchemy.orm import joinedload, selectinload


load_dotenv()

# --- (Весь код до API Эндпоинтов остается без изменений) ---

# --- Глобальные переменные, Lifespan, FastAPI app, обработчик ошибок, CORS, зависимости ---
# (Этот блок кода остается прежним)
# --- Получение переменных окружения ---
BOT_TOKEN = os.getenv('BOT_TOKEN')
APP_URL = os.getenv('APP_URL')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
DADATA_API_KEY = os.getenv('DADATA_API_KEY')

# Настройка логирования
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

_application_instance: Optional[Application] = None
_bot_instance: Optional[Bot] = None

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

app = FastAPI(lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    readable_errors = []
    for error in exc.errors():
        readable_errors.append({"location": ".".join(map(str, error["loc"])), "message": error["msg"], "type": error["type"]})
    logger.error(f"Validation error for request {request.method} {request.url}:")
    logger.error(json.dumps(readable_errors, indent=2, ensure_ascii=False))
    return JSONResponse(status_code=422, content={"detail": readable_errors})

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
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_origin_regex=DEV_TUNNELS_REGEX, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["*"])

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

@app.post("/suggest-address", response_model=DadataSuggestionResponse)
async def suggest_address(request_data: AddressSuggestionRequest):
    # ... (код эндпоинта suggest_address без изменений)
    if not DADATA_API_KEY:
        raise HTTPException(status_code=500, detail="Address suggestion service is not configured.")
    api_url = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"
    headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": f"Token {DADATA_API_KEY}"}
    payload = {"query": request_data.query, "count": 5, "locations": [{"city": request_data.city}], "from_bound": {"value": "street"}, "to_bound": {"value": "house"}}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Error requesting Dadata: {e}")
        raise HTTPException(status_code=503, detail="Address suggestion service is unavailable.")
    except Exception as e:
        logger.error(f"An unexpected error occurred with Dadata: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.get("/cafes", response_model=List[CafeSchema])
def get_all_cafes(db: Session = Depends(get_db_session)):
    # ... (код эндпоинта get_all_cafes без изменений)
    try:
        cafes = db.query(Cafe).all()
        return cafes
    except Exception as e:
        logger.error(f"Error fetching all cafes from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching cafes.")


@app.get("/cafes/{cafe_id}", response_model=CafeSchema)
def get_cafe_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    # ... (код эндпоинта get_cafe_by_id без изменений)
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
    # ... (код эндпоинта get_categories_by_cafe без изменений)
    try:
        categories = (db.query(Category).join(GlobalProduct).join(GlobalProductVariant).join(VenueMenuItem).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True).distinct().all())
        return categories
    except Exception as e:
        logger.error(f"Error fetching categories for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching categories.")


def assemble_menu_items(venue_menu_items: List[VenueMenuItem], db: Session, cafe_id: str) -> List[MenuItemSchema]:
    """Вспомогательная функция для сборки ответа по меню."""
    products_dict = {}
    
    # Собираем все продукты и их варианты
    for item in venue_menu_items:
        product = item.variant.product
        if product.id not in products_dict:
            products_dict[product.id] = {
                "id": product.id, "name": product.name, "description": product.description,
                "image": product.image, "variants": [], "addons": []
            }
        products_dict[product.id]["variants"].append({
            "id": item.variant.id, "name": item.variant.name,
            "cost": item.price, "weight": item.variant.weight
        })
        
    if not products_dict:
        return []

    # Находим все добавки для найденных продуктов
    product_ids = list(products_dict.keys())
    addon_groups = (
        db.query(GlobalAddonGroup)
        .join(GlobalAddonGroup.products)
        .filter(GlobalProduct.id.in_(product_ids))
        .options(selectinload(GlobalAddonGroup.items).selectinload(GlobalAddonItem.venue_specific_items))
        .all()
    )

    # Собираем структуру добавок
    for product_id in product_ids:
        product_addons = []
        for group in addon_groups:
            # Проверяем, привязана ли группа к этому продукту
            if any(p.id == product_id for p in group.products):
                addon_group_for_response = {"id": group.id, "name": group.name, "items": []}
                # Находим цены на добавки в этом заведении
                venue_addons = (
                    db.query(VenueAddonItem)
                    .filter(VenueAddonItem.venue_id == cafe_id, VenueAddonItem.addon_id.in_([i.id for i in group.items]))
                    .all()
                )
                venue_addons_map = {va.addon_id: va for va in venue_addons}
                
                for item in group.items:
                    if item.id in venue_addons_map and venue_addons_map[item.id].is_available:
                        addon_group_for_response["items"].append({
                            "id": item.id,
                            "name": item.name,
                            "cost": venue_addons_map[item.id].price
                        })
                
                if addon_group_for_response["items"]:
                    product_addons.append(addon_group_for_response)
        
        products_dict[product_id]["addons"] = product_addons

    return list(products_dict.values())

@app.get("/cafes/{cafe_id}/menu/{category_id}", response_model=List[MenuItemSchema])
def get_category_menu_by_cafe(cafe_id: str, category_id: str, db: Session = Depends(get_db_session)):
    try:
        venue_menu_items = (
            db.query(VenueMenuItem)
            .join(VenueMenuItem.variant)
            .join(GlobalProductVariant.product)
            .filter(
                VenueMenuItem.venue_id == cafe_id,
                VenueMenuItem.is_available == True,
                GlobalProduct.category_id == category_id
            )
            .options(
                joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product).selectinload(GlobalProduct.addon_groups)
            )
            .all()
        )
        return assemble_menu_items(venue_menu_items, db, cafe_id)
    except Exception as e:

        # 3. Группируем варианты по продуктам (как в эндпоинте /menu)
        products_dict = {}
        for item in venue_menu_items:
            product = item.variant.product
            if product.id not in products_dict:
                products_dict[product.id] = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "variants": []}
            products_dict[product.id]["variants"].append({"id": item.variant.id, "name": item.variant.name, "cost": item.price, "weight": item.variant.weight})
            
        return list(products_dict.values())
    except Exception as e:
        logger.error(f"Error fetching popular menu for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching popular menu data.")

@app.get("/cafes/{cafe_id}/menu/{category_id}", response_model=List[MenuItemSchema])
def get_category_menu_by_cafe(cafe_id: str, category_id: str, db: Session = Depends(get_db_session)):
    # ... (код эндпоинта get_category_menu_by_cafe без изменений)
    try:
        venue_menu_items = (db.query(VenueMenuItem).join(GlobalProductVariant).join(GlobalProduct).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProduct.category_id == category_id).all())
        products_dict = {}
        for item in venue_menu_items:
            product = item.variant.product
            if product.id not in products_dict:
                products_dict[product.id] = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "variants": []}
            products_dict[product.id]["variants"].append({"id": item.variant.id, "name": item.variant.name, "cost": item.price, "weight": item.variant.weight})
        return list(products_dict.values())
    except Exception as e:
        logger.error(f"Error fetching menu for category {category_id} of cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu data.")


@app.get("/cafes/{cafe_id}/menu/details/{menu_item_id}", response_model=MenuItemSchema)
def get_menu_item_details_by_cafe(cafe_id: str, menu_item_id: str, db: Session = Depends(get_db_session)):
    # ... (код эндпоинта get_menu_item_details_by_cafe без изменений)
    try:
        venue_menu_items = (db.query(VenueMenuItem).join(GlobalProductVariant).join(GlobalProduct).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProduct.id == menu_item_id).all())
        if not venue_menu_items:
            raise HTTPException(status_code=404, detail=f"Could not find menu item data with '{menu_item_id}' ID for cafe '{cafe_id}'.")
        product = venue_menu_items[0].variant.product
        response = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "variants": []}
        for item in venue_menu_items:
            response["variants"].append({"id": item.variant.id, "name": item.variant.name, "cost": item.price, "weight": item.variant.weight})
        return response
    except Exception as e:
        logger.error(f"Error fetching menu item {menu_item_id} details for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching menu item details.")


@app.get("/cafes/{cafe_id}/settings", response_model=CafeSettingsSchema)
def get_cafe_settings_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    # ... (код эндпоинта get_cafe_settings_by_id без изменений)
    try:
        cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
        if not cafe:
            raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
        return CafeSettingsSchema(min_order_amount=cafe.min_order_amount)
    except Exception as e:
        logger.error(f"Error fetching settings for cafe {cafe_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching cafe settings.")


# --- ИСПРАВЛЕННЫЙ ЭНДПОИНТ ---
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
        raise HTTPException(status_code=401, detail="Invalid auth data.")
    logger.info("Auth data validated.")

    if not order_data.cartItems:
        raise HTTPException(status_code=400, detail="Cart Items are not provided.")
    logger.info(f"Received {len(order_data.cartItems)} items in cart.")

    labeled_prices = []
    total_amount_in_minimal_units = 0
    for item in order_data.cartItems:
        try:
            # Проверяем цену и наличие варианта в конкретном заведении
            venue_menu_item = (
                db.query(VenueMenuItem)
                .filter(
                    VenueMenuItem.venue_id == cafe_id,
                    VenueMenuItem.variant_id == item.variant.id,
                    VenueMenuItem.is_available == True
                )
                .options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)) # Подгружаем связанные данные
                .first()
            )

            if not venue_menu_item:
                raise HTTPException(status_code=400, detail=f"Item variant '{item.variant.id}' is not available for this venue.")

            # Берем актуальную цену из базы, а не из запроса клиента
            cost_in_minimal_unit = venue_menu_item.price
            quantity = item.quantity
            price_for_item = cost_in_minimal_unit * quantity
            total_amount_in_minimal_units += price_for_item

            labeled_price = LabeledPrice(
                label=f'{venue_menu_item.variant.product.name} ({venue_menu_item.variant.name}) x{quantity}',
                amount=price_for_item
            )
            labeled_prices.append(labeled_price)
        except Exception as e:
            logger.error(f"Error processing item {item.cafeItem.id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error processing order items.")

    logger.info(f"Total order amount in minimal units: {total_amount_in_minimal_units}")

    if min_order_amount > 0 and total_amount_in_minimal_units < min_order_amount:
        raise HTTPException(status_code=400, detail=f"Order total is too low. Minimum order amount is {min_order_amount}.")
    
    user_info_dict = {}
    try:
        parsed_auth_data = parse_qs(order_data.auth)
        if 'user' in parsed_auth_data:
            user_data_json = parsed_auth_data['user'][0]
            user_info_dict = json.loads(user_data_json)
    except Exception as e:
        logger.error(f"Could not parse user info from initData: {e}")

    # 3. Создаем и сохраняем заказ в базе данных
    new_order = Order(
        cafe_id=cafe_id,
        user_info=user_info_dict,
        cart_items=[item.dict() for item in order_data.cartItems],
        total_amount=total_amount_in_minimal_units,
        currency="RUB"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    logger.info(f"Order {new_order.id} created and saved to DB.")

    # 4. Создаем инвойс
    invoice_url = await create_invoice_link(
        prices=labeled_prices,
        payload=str(new_order.id),
        bot_instance=bot_instance
    )
    if invoice_url is None:
        raise HTTPException(status_code=500, detail="Could not create invoice.")
    logger.info(f"Invoice URL created for order: {invoice_url}")
    return { 'invoiceUrl': invoice_url }