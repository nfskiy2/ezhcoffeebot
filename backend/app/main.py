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
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from telegram import Update, LabeledPrice, Bot
from telegram.ext import Application
from urllib.parse import parse_qs

from . import auth
from .bot import initialize_bot_app, create_invoice_link, WEBHOOK_PATH, send_new_order_notifications
from .database import engine, SessionLocal
from .models import (
    Base, Cafe, Category, GlobalProduct, GlobalProductVariant,
    VenueMenuItem, Order, GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
from .schemas import (
    CategorySchema, MenuItemSchema, OrderRequest, CafeSettingsSchema, CafeSchema,
    AddressSuggestionRequest, DadataSuggestionResponse
)

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN')
APP_URL = os.getenv('APP_URL')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
DADATA_API_KEY = os.getenv('DADATA_API_KEY')

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
    yield
    logger.info("FastAPI lifespan shutdown event triggered.")
    if _application_instance is not None:
        await _application_instance.shutdown()
        logger.info("Telegram Bot Application closed.")

app = FastAPI(lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    readable_errors = [{"location": ".".join(map(str, error["loc"])), "message": error["msg"], "type": error["type"]} for error in exc.errors()]
    logger.error(f"Validation error for request {request.method} {request.url}:\n{json.dumps(readable_errors, indent=2, ensure_ascii=False)}")
    return JSONResponse(status_code=422, content={"detail": readable_errors})

allowed_origins = [APP_URL] if APP_URL else []
if os.getenv('DEV_MODE') and os.getenv('DEV_APP_URL'):
    allowed_origins.append(os.getenv('DEV_APP_URL'))

app.add_middleware(CORSMiddleware, allow_origins=allowed_origins or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_bot_instance() -> Bot:
    if _bot_instance is None: raise HTTPException(status_code=500, detail="Bot service is not ready.")
    return _bot_instance

def get_application_instance() -> Application:
    if _application_instance is None: raise HTTPException(status_code=500, detail="Bot application not initialized.")
    return _application_instance

def assemble_menu_items(venue_menu_items: List[VenueMenuItem], db: Session, cafe_id: str) -> List[dict]:
    products_dict = {}
    for item in venue_menu_items:
        if not item.variant or not item.variant.product: continue
        product = item.variant.product
        if product.id not in products_dict:
            products_dict[product.id] = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "category_id": product.category_id, "variants": [], "addons": []}
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
                    if venue_addon and venue_addon.is_available:
                        addon_group_for_response["items"].append({"id": addon_item.id, "name": addon_item.name, "cost": str(venue_addon.price)})
                if addon_group_for_response["items"]: product_addons.append(addon_group_for_response)
        product_data["addons"] = product_addons
    return list(products_dict.values())

@app.get("/")
async def read_root(): return {"message": "Welcome to Laurel Cafe API!"}

@app.post(WEBHOOK_PATH)
async def bot_webhook(request: Request, application_instance: Application = Depends(get_application_instance)):
    try:
        update = Update.de_json(await request.json(), application_instance.bot)
        await application_instance.process_update(update)
        return {"message": "OK"}
    except Exception as e:
        logger.error(f"Error processing webhook update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing update.")

@app.post("/suggest-address", response_model=DadataSuggestionResponse)
async def suggest_address(request_data: AddressSuggestionRequest):
    if not DADATA_API_KEY: raise HTTPException(status_code=500, detail="Address suggestion service is not configured.")
    api_url = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"
    headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": f"Token {DADATA_API_KEY}"}
    payload = {"query": request_data.query, "count": 5, "locations": [{"city": request_data.city}], "from_bound": {"value": "street"}, "to_bound": {"value": "house"}}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            logger.error(f"Error requesting Dadata: {e}")
            raise HTTPException(status_code=503, detail="Address suggestion service is unavailable.")

@app.get("/cafes", response_model=List[CafeSchema])
def get_all_cafes(db: Session = Depends(get_db_session)): return db.query(Cafe).all()

@app.get("/cafes/{cafe_id}/categories", response_model=List[CategorySchema])
def get_categories_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)): return db.query(Category).join(GlobalProduct).join(GlobalProductVariant).join(VenueMenuItem).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True).distinct().all()

@app.get("/cafes/{cafe_id}/popular", response_model=List[MenuItemSchema])
def get_popular_menu_by_cafe(cafe_id: str, db: Session = Depends(get_db_session)):
    venue_menu_items = db.query(VenueMenuItem).join(GlobalProductVariant).join(GlobalProduct).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).limit(5).all()
    return assemble_menu_items(venue_menu_items, db, cafe_id)

@app.get("/cafes/{cafe_id}/menu/{category_id}", response_model=List[MenuItemSchema])
def get_category_menu_by_cafe(cafe_id: str, category_id: str, db: Session = Depends(get_db_session)):
    venue_menu_items = db.query(VenueMenuItem).join(GlobalProductVariant).join(GlobalProduct).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProduct.category_id == category_id).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).all()
    return assemble_menu_items(venue_menu_items, db, cafe_id)

@app.get("/cafes/{cafe_id}/menu/details/{menu_item_id}", response_model=MenuItemSchema)
def get_menu_item_details_by_cafe(cafe_id: str, menu_item_id: str, db: Session = Depends(get_db_session)):
    venue_menu_items = db.query(VenueMenuItem).join(VenueMenuItem.variant).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.is_available == True, GlobalProductVariant.global_product_id == menu_item_id).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).all()
    if not venue_menu_items: raise HTTPException(status_code=404, detail=f"Menu item '{menu_item_id}' not found for this venue.")
    return assemble_menu_items(venue_menu_items, db, cafe_id)[0]

@app.get("/cafes/{cafe_id}/settings", response_model=CafeSettingsSchema)
def get_cafe_settings_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe: raise HTTPException(status_code=404, detail=f"Cafe '{cafe_id}' not found.")
    return CafeSettingsSchema(min_order_amount=cafe.min_order_amount)

@app.post("/cafes/{cafe_id}/order")
async def create_order(cafe_id: str, order_data: OrderRequest, db: Session = Depends(get_db_session), bot_instance: Bot = Depends(get_bot_instance)):
    if not auth.validate_auth_data(BOT_TOKEN, order_data.auth):
        raise HTTPException(status_code=401, detail="Invalid auth data.")
    
    labeled_prices = []
    total_amount = 0
    # --- ИСПРАВЛЕНИЕ 1: Используем order_data.cart_items вместо order_data.cartItems ---
    for item in order_data.cart_items:
        venue_item = db.query(VenueMenuItem).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.variant_id == item.variant.id, VenueMenuItem.is_available == True).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).first()
        if not venue_item:
            raise HTTPException(status_code=400, detail=f"Item variant '{item.variant.id}' is not available.")
        total_amount += venue_item.price * item.quantity
        labeled_prices.append(LabeledPrice(label=f"{venue_item.variant.product.name} ({venue_item.variant.name}) x{item.quantity}", amount=venue_item.price * item.quantity))

    user_info_dict, user_id = {}, None
    try:
        parsed_auth = parse_qs(order_data.auth)
        if 'user' in parsed_auth:
            user_data = json.loads(parsed_auth['user'][0])
            user_info_dict, user_id = user_data, user_data.get('id')
    except Exception as e:
        logger.error(f"Could not parse user info: {e}")

    if order_data.address:
        user_info_dict['shipping_address'] = order_data.address.dict()

    new_order = Order(
        cafe_id=cafe_id,
        user_info=user_info_dict,
        # --- ИСПРАВЛЕНИЕ 2: Используем order_data.cart_items здесь тоже ---
        cart_items=[item.model_dump() for item in order_data.cart_items],
        total_amount=total_amount,
        currency="RUB",
        # --- ИСПРАВЛЕНИЕ 3: Используем order_data.payment_method вместо order_data.paymentMethod ---
        status='pending' if order_data.payment_method != 'online' else 'awaiting_payment'
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    if order_data.payment_method == 'online':
        invoice_url = await create_invoice_link(prices=labeled_prices, payload=str(new_order.id), bot_instance=bot_instance)
        if not invoice_url: raise HTTPException(status_code=500, detail="Could not create invoice.")
        return {'invoiceUrl': invoice_url}
    else:
        await send_new_order_notifications(order=new_order, bot_instance=bot_instance, user_id_to_notify=user_id, staff_group_to_notify=os.getenv('STAFF_GROUP_ID'))
        return {"message": "Order accepted"}