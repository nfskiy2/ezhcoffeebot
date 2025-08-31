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
BOT_TOKEN, APP_URL, STAFF_GROUP_ID = os.getenv('BOT_TOKEN'), os.getenv('APP_URL'), os.getenv('STAFF_GROUP_ID')
WEBHOOK_URL, DADATA_API_KEY = os.getenv('DADATA_API_KEY'), os.getenv('DADATA_API_KEY')
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

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

def assemble_menu_items(venue_menu_items: List[VenueMenuItem], db: Session, cafe_id: str) -> List[dict]:
    products_dict = {}
    for item in venue_menu_items:
        if not item.variant or not item.variant.product: continue
        product = item.variant.product
        if product.id not in products_dict: products_dict[product.id] = {"id": product.id, "name": product.name, "description": product.description, "image": product.image, "category_id": product.category_id, "variants": [], "addons": []}
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
    if not venue_menu_items: raise HTTPException(404, f"Menu item '{menu_item_id}' not found.")
    return assemble_menu_items(venue_menu_items, db, cafe_id)[0]

@app.get("/cafes/{cafe_id}/settings", response_model=CafeSettingsSchema)
def get_cafe_settings_by_id(cafe_id: str, db: Session = Depends(get_db_session)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe: raise HTTPException(404, f"Cafe '{cafe_id}' not found.")
    return CafeSettingsSchema(min_order_amount=cafe.min_order_amount)

@app.post("/cafes/{cafe_id}/order")
async def create_order(cafe_id: str, order_data: OrderRequest, db: Session = Depends(get_db_session), bot_instance: Bot = Depends(get_bot_instance)):
    if not auth.validate_auth_data(BOT_TOKEN, order_data.auth):
        raise HTTPException(401, "Invalid auth data.")

    labeled_prices = []
    total_amount = 0

    for item in order_data.cart_items:
        venue_item = db.query(VenueMenuItem).options(joinedload(VenueMenuItem.variant).joinedload(GlobalProductVariant.product)).filter(VenueMenuItem.venue_id == cafe_id, VenueMenuItem.variant_id == item.variant.id, VenueMenuItem.is_available == True).first()
        if not venue_item: raise HTTPException(400, f"Item variant '{item.variant.id}' unavailable.")

        # --- FIX: Create an itemized invoice ---
        # 1. Add the main product
        item_price = venue_item.price
        item_total_price = item_price * item.quantity
        total_amount += item_total_price

        # Truncate label to meet Telegram API's 32-character limit
        base_label = f"{venue_item.variant.product.name} ({item.variant.name}) x{item.quantity}"
        if len(base_label) > 32:
             base_label = f"{venue_item.variant.product.name[:20]}... x{item.quantity}"
        labeled_prices.append(LabeledPrice(label=base_label, amount=item_total_price))

        # 2. Add each addon as a separate item
        if item.selected_addons:
            for addon_data in item.selected_addons:
                venue_addon = db.query(VenueAddonItem).filter(VenueAddonItem.venue_id == cafe_id, VenueAddonItem.addon_id == addon_data.id, VenueAddonItem.is_available == True).first()
                if not venue_addon: raise HTTPException(400, f"Addon '{addon_data.id}' unavailable.")

                addon_total_price = venue_addon.price * item.quantity
                total_amount += addon_total_price

                if addon_total_price > 0: # Don't add free addons to the invoice
                    addon_label = f"+ {addon_data.name} x{item.quantity}"
                    if len(addon_label) > 32:
                         addon_label = f"+ {addon_data.name[:20]}... x{item.quantity}"
                    labeled_prices.append(LabeledPrice(label=addon_label, amount=addon_total_price))
        # --- End of FIX ---

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
        status='pending' if order_data.payment_method != 'online' else 'awaiting_payment'
    )
    db.add(new_order); db.commit(); db.refresh(new_order)
    
    if order_data.payment_method == 'online':
        invoice_url = await create_invoice_link(prices=labeled_prices, payload=str(new_order.id), bot_instance=bot_instance)
        if not invoice_url: raise HTTPException(500, "Could not create invoice.")
        return {'invoiceUrl': invoice_url}
    else:
        await send_new_order_notifications(order=new_order, bot_instance=bot_instance, user_id_to_notify=user_id, staff_group_to_notify=STAFF_GROUP_ID)
        return {"message": "Order accepted"}