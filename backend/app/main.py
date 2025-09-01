# backend/app/main.py
import json
import os
import logging
import contextlib
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload, selectinload
from telegram import Update, LabeledPrice, Bot
from telegram.ext import Application
from urllib.parse import parse_qs
from sqladmin import Admin
from .admin import authentication_backend, register_all_views
from starlette.middleware.sessions import SessionMiddleware

from . import auth
from .bot import initialize_bot_app, create_invoice_link, WEBHOOK_PATH, send_new_order_notifications
from .database import engine, SessionLocal
from .models import (
    Base, Cafe, Category, GlobalProduct, GlobalProductVariant,
    VenueMenuItem, Order, GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
from .schemas import (
    CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema, CafeSchema,
    AddressSuggestionRequest, DadataSuggestionResponse, PromotionSchema 
)

load_dotenv()
BOT_TOKEN, APP_URL, STAFF_GROUP_ID = os.getenv('BOT_TOKEN'), os.getenv('APP_URL'), os.getenv('STAFF_GROUP_ID')
WEBHOOK_URL, DADATA_API_KEY = os.getenv('DADATA_API_KEY'), os.getenv('DADATA_API_KEY')
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = "/app/uploads"

def _truncate_label(base: str, suffix: str) -> str:
    max_base_len = 32 - len(suffix)
    if len(base) > max_base_len:
        return base[:max_base_len - 3] + "..." + suffix
    return base + suffix

_application_instance: Optional[Application] = None
_bot_instance: Optional[Bot] = None

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI startup.")
    Base.metadata.create_all(bind=engine)
    global _application_instance, _bot_instance
    _application_instance = await initialize_bot_app()
    _bot_instance = _application_instance.bot
    await _application_instance.initialize()
    yield
    if _application_instance: await _application_instance.shutdown()

app = FastAPI(lifespan=lifespan)

app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")

app.add_middleware(
    SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "a_very_secret_key")
)

admin = Admin(app, engine, authentication_backend=authentication_backend)
register_all_views(admin)
origins = [APP_URL] if APP_URL else []
if os.getenv('DEV_MODE') and os.getenv('DEV_APP_URL'): origins.append(os.getenv('DEV_APP_URL'))
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def get_db_session(): db = SessionLocal(); yield db; db.close()
def get_bot_instance() -> Bot:
    if _bot_instance is None: raise HTTPException(500, "Bot not ready.")
    return _bot_instance
def get_application_instance() -> Application:
    if _application_instance is None: raise HTTPException(500, "Bot app not initialized.")
    return _application_instance

# ... (остальные функции до create_order остаются без изменений)
def assemble_menu_items(venue_menu_items: List[VenueMenuItem], db: Session, cafe_id: str) -> List[dict]:
    products_dict = {}
    for item in venue_menu_items:
        if not item.variant or not item.variant.product: continue
        product = item.variant.product
        if product.id not in products_dict: products_dict[product.id] = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "category_id": product.category_id, "sub_category": product.sub_category, "variants": [], "addons": []}
        products_dict[product.id]["variants"].append({"id": item.variant.id, "name": item.variant.name, "cost": str(item.price), "weight": item.variant.weight})
    if not products_dict: return []
    product_ids = list(products_dict.keys())
    addon_groups = db.query(GlobalAddonGroup).join(GlobalAddonGroup.products).filter(GlobalProduct.id.in_(product_ids)).options(selectinload(GlobalAddonGroup.items)).all()
    venue_addons = db.query(VenueAddonItem).filter(VenueAddonItem.venue_id == cafe_id).all()
    venue_addons_map = {va.addon_id: va for va in venue_addons}
    for product_id, product_data in products_dict.items():
        product_addons = []
        for group in addon_groups:
            if any(p.id == product_id for p in group.products):
                addon_group_for_response = {"id": group.id, "name": group.name, "items": []}
                for addon_item in group.items:
                    venue_addon = venue_addons_map.get(addon_item.id)
                    if venue_addon and venue_addon.is_available: addon_group_for_response["items"].append({"id": addon_item.id, "name": addon_item.name, "cost": str(venue_addon.price)})
                if addon_group_for_response["items"]: product_addons.append(addon_group_for_response)
        product_data["addons"] = product_addons
    return list(products_dict.values())

@app.get("/")
async def read_root(): return {"message": "Welcome to EZH Cafe API!"}

@app.post(WEBHOOK_PATH)
async def bot_webhook(request: Request, application_instance: Application = Depends(get_application_instance)):
    try: await application_instance.process_update(Update.de_json(await request.json(), application_instance.bot))
    except Exception as e: logger.error(f"Error in webhook: {e}", exc_info=True); raise HTTPException(500, "Error processing update.")
    return {"message": "OK"}

@app.get("/cafes", response_model=List[CafeSchema])
def get_all_cafes(db: Session = Depends(get_db_session)): return db.query(Cafe).all()

@app.get("/cafes/{cafe_id}/promotions", response_model=List[PromotionSchema])
def get_promotions_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)):
    """
    Возвращает список акций, доступных для конкретного кафе.
    Акция считается доступной, если категория, к которой она привязана,
    присутствует в меню данного кафе.
    """
    # 1. Получаем все ID категорий, которые есть в меню данного кафе
    available_category_ids_query = (
        db.query(Category.id)
        .join(GlobalProduct)
        .join(GlobalProductVariant)
        .join(VenueMenuItem)
        .filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True)
        .distinct()
    )
    available_category_ids = {c.id for c in available_category_ids_query.all()}

    if not available_category_ids:
        return []

    # 2. Загружаем все акции из файла promotions.json
    try:
        with open('data/promotions.json', 'r', encoding='utf-8') as f:
            all_promotions = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.error("Не удалось загрузить или обработать файл promotions.json")
        return []

    # 3. Фильтруем акции: оставляем только те, у которых linkedCategoryId
    #    присутствует в списке доступных категорий для данного кафе.
    valid_promotions = [
        promo for promo in all_promotions
        if promo.get("linkedCategoryId") in available_category_ids
    ]
    
    # 4. Формируем ответ, приводя ключи в соответствие со схемой Pydantic
    response_data = [
        {
            "id": promo.get("id"),
            "title": promo.get("title"),
            "subtitle": promo.get("subtitle"),
            "image_url": promo.get("imageUrl"),
            "linked_category_id": promo.get("linkedCategoryId")
        } 
        for promo in valid_promotions
    ]

    return response_data

@app.get("/cafes/{cafe_id}/categories", response_model=List[CategorySchema])
def get_categories_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)): return db.query(Category).join(GlobalProduct).join(GlobalProductVariant).join(VenueMenuItem).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True).distinct().all()

@app.get("/cafes/{cafe_id}/popular", response_model=List[MenuItemSchema])
def get_popular_menu_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)):
    # --- ИЗМЕНЕНИЕ ЛОГИКИ ---
    # Раньше: .limit(5).all()
    # Теперь: фильтруем по флагу is_popular
    venue_menu_items = (
        db.query(VenueMenuItem)
        .join(GlobalProductVariant)
        .join(GlobalProduct)
        .filter(
            VenueMenuItem.venue_id == cafe_id,
            VenueMenuItem.is_available == True,
            GlobalProduct.is_popular == True  # <-- НОВОЕ УСЛОВИЕ
        )
        .options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product))
        .all()
    )
    return assemble_menu_items(venue_menu_items, db, cafe_id)

@app.get("/cafes/{cafe_id}/menu/{category_id}", response_model=List[MenuItemSchema])
def get_category_menu_by_cafe(cafe_id: str, category_id: str, db: Session = Depends(get_db_session)):
    venue_menu_items = db.query(VenueMenuItem).join(GlobalProductVariant).join(GlobalProduct).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProduct.category_id == category_id).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).all()
    return assemble_menu_items(venue_menu_items, db, cafe_id)

@app.get("/cafes/{cafe_id}/menu/details/{menu_item_id}", response_model=MenuItemSchema)
def get_menu_item_details_by_cafe(cafe_id: str, menu_item_id: str, db: Session = Depends(get_db_session)):
    venue_menu_items = db.query(VenueMenuItem).join(VenueMenuItem.variant).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProductVariant.global_product_id == menu_item_id).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).all()
    if not venue_menu_items: raise HTTPException(404, f"Menu item '{menu_item_id}' not found.")
    return assemble_menu_items(venue_menu_items, db, cafe_id)[0]

@app.get("/cafes/{cafe_id}/settings", response_model=CafeSettingsSchema)
def get_cafe_settings_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe: raise HTTPException(404, f"Cafe '{cafe_id}' not found.")
    return CafeSettingsSchema(min_order_amount=cafe.min_order_amount)

@app.post("/suggest-address", response_model=DadataSuggestionResponse)
async def get_address_suggestions(request_data: AddressSuggestionRequest):
    if not DADATA_API_KEY:
        raise HTTPException(status_code=500, detail="Dadata API key is not configured.")
    
    url = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Token {DADATA_API_KEY}"
    }
    # Ограничиваем поиск по городу и запрашиваем только улицы и дома
    payload = {
        "query": request_data.query,
        "locations": [{"city": request_data.city}],
        "from_bound": {"value": "street"},
        "to_bound": {"value": "house"}
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status() # Вызовет ошибку, если статус ответа не 2xx
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Dadata API request failed: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Address suggestion service is unavailable.")
        except Exception as e:
            logger.error(f"An unexpected error occurred while calling Dadata API: {e}")
            raise HTTPException(status_code=500, detail="Internal server error.")


@app.post("/cafes/{cafe_id}/order")
async def create_order(cafe_id: str, order_data: OrderRequest, db: Session = Depends(get_db_session), bot_instance: Bot = Depends(get_bot_instance)):
    if not auth.validate_auth_data(BOT_TOKEN, order_data.auth):
        raise HTTPException(401, "Invalid auth data.")

    # ... (логика расчета цен остается такой же, как в прошлый раз) ...
    labeled_prices, total_amount = [], 0
    for item in order_data.cart_items:
        venue_item = db.query(VenueMenuItem).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.variant_id == item.variant.id, VenueMenuItem.is_available == True).first()
        if not venue_item: raise HTTPException(400, f"Item variant '{item.variant.id}' unavailable.")
        single_item_price = venue_item.price
        if item.selected_addons:
            for addon_data in item.selected_addons:
                venue_addon = db.query(VenueAddonItem).filter(VenueAddonItem.venue_id == cafe_id, VenueAddonItem.addon_id == addon_data.id, VenueAddonItem.is_available == True).first()
                if not venue_addon: raise HTTPException(400, f"Addon '{addon_data.id}' unavailable.")
                single_item_price += venue_addon.price
        item_total_price = single_item_price * item.quantity
        total_amount += item_total_price
        base_label = f"{venue_item.variant.product.name} ({item.variant.name})"
        if item.selected_addons:
            addon_names = ", ".join([a.name for a in item.selected_addons])
            base_label += f" + {addon_names}"
        final_label = _truncate_label(base_label, f" x{item.quantity}")
        if item_total_price > 0:
            labeled_prices.append(LabeledPrice(label=final_label, amount=item_total_price))
    
    if order_data.payment_method == 'online' and not labeled_prices:
        raise HTTPException(status_code=400, detail="Cannot process online payment for a free order.")

    user_info_dict, user_id = {}, None
    try:
        parsed_auth = parse_qs(order_data.auth)
        if 'user' in parsed_auth: user_data = json.loads(parsed_auth['user'][0]); user_info_dict, user_id = user_data, user_data.get('id')
    except Exception as e: logger.error(f"Could not parse user info: {e}")

    order_type = "delivery" if order_data.address else "pickup"
    if order_data.address: user_info_dict['shipping_address'] = order_data.address.model_dump()
        
    new_order = Order(
        cafe_id=cafe_id, user_info=user_info_dict,
        cart_items=[item.model_dump() for item in order_data.cart_items],
        total_amount=total_amount, currency="RUB",
        order_type=order_type,
        payment_method=order_data.payment_method,
        status='pending' if order_data.payment_method != 'online' else 'awaiting_payment'
    )
    
    # --- ИСПРАВЛЕНИЕ: Изменяем порядок работы с БД ---
    db.add(new_order)
    db.flush() # 1. Фиксируем объект в сессии, чтобы сгенерировался new_order.id

    try:
        if order_data.payment_method == 'online':
            logger.info(f"Creating invoice for order {new_order.id} with prices: {labeled_prices}")
            invoice_url = await create_invoice_link(prices=labeled_prices, payload=str(new_order.id), bot_instance=bot_instance)
            if not invoice_url:
                raise HTTPException(500, "Could not create invoice.")
            
            db.commit() # 2. Если счет создан, коммитим транзакцию
            return {'invoiceUrl': invoice_url}
        else:
            await send_new_order_notifications(order=new_order, bot_instance=bot_instance, user_id_to_notify=user_id, staff_group_to_notify=STAFF_GROUP_ID)
            db.commit() # 2. Если оплата не онлайн, просто коммитим
            return {"message": "Order accepted"}
    except Exception as e:
        db.rollback() # 3. Если на любом этапе произошла ошибка, откатываем транзакцию
        logger.error(f"Failed to process order {new_order.id}: {e}", exc_info=True)
        # Перевыбрасываем ошибку, чтобы FastAPI вернул корректный ответ клиенту
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="An internal error occurred while processing the order.")
