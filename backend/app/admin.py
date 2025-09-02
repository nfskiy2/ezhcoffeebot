# backend/app/admin.py
import os
import json
from passlib.context import CryptContext
from babel.numbers import format_currency
from markupsafe import Markup

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.datastructures import UploadFile
from starlette.requests import Request
from wtforms import FileField

from .models import (
    Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order,
    GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
from fastapi_storages import FileSystemStorage

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
storage = FileSystemStorage(path=UPLOAD_DIR)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def bool_icon(value: bool) -> Markup:
    if value:
        return Markup('<i class="fa-solid fa-check-circle text-success"></i>')
    return Markup('<i class="fa-solid fa-times-circle text-danger"></i>')

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")
        ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
        ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
        if not ADMIN_USERNAME or not ADMIN_PASSWORD_HASH: return False
        if username == ADMIN_USERNAME and pwd_context.verify(password, ADMIN_PASSWORD_HASH):
            request.session.update({"token": "admin_token"})
            return True
        return False
    async def logout(self, request: Request) -> bool:
        request.session.clear(); return True
    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = AdminAuth(secret_key=os.getenv("SECRET_KEY", "your-super-secret-key-for-sessions"))

class CafeAdmin(ModelView, model=Cafe):
    name = "Заведение"; name_plural = "Заведения"; icon = "fa-solid fa-store"; category = "Управление"
    column_list = [Cafe.id, Cafe.name, Cafe.status]
    column_details_list = [
        Cafe.id, Cafe.name, Cafe.status, Cafe.kitchen_categories, 
        Cafe.rating, Cafe.cooking_time, Cafe.opening_hours, 
        'min_order_amount', 'menu_items', 'addon_items'
    ]
    column_searchable_list = [Cafe.name, Cafe.id]
    form_overrides = {'cover_image': FileField, 'logo_image': FileField}
    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    column_formatters = { "min_order_amount": lambda m, a: format_currency(m.min_order_amount / 100, 'RUB', locale='ru_RU') }
    column_formatters_detail = {
        'min_order_amount': lambda m, a: format_currency(m.min_order_amount / 100, 'RUB', locale='ru_RU'),
        'menu_items': lambda m, a: Markup("<br>".join(
            [f"<b>{item.variant.product.name} - {item.variant.name}</b> ({format_currency(item.price / 100, 'RUB', locale='ru_RU')})"
             for item in sorted(m.menu_items, key=lambda x: x.variant.product.name if x.variant and x.variant.product else "")
             if item.variant and item.variant.product]
        )),
        'addon_items': lambda m, a: ", ".join(
            [f"{item.addon.name} ({format_currency(item.price / 100, 'RUB', locale='ru_RU')})"
             for item in sorted(m.addon_items, key=lambda x: x.addon.name if x.addon else "")
             if item.addon]
        )
    }
    async def on_model_change(self, data, model, is_created, request):
        for field in ["cover_image", "logo_image"]:
            if file := data.get(field):
                if isinstance(file, UploadFile) and file.filename:
                    data[field] = await storage.write(name=file.filename, file=file.file)
                else: data.pop(field, None)
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(
            selectinload(self.model.menu_items).selectinload(VenueMenuItem.variant).selectinload(GlobalProductVariant.product),
            selectinload(self.model.addon_items).selectinload(VenueAddonItem.addon)
        )

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"; name_plural = "Категории"; icon = "fa-solid fa-list"; category = "Каталог"
    column_formatters = { "background_color": lambda m, a: Markup(f'<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: {m.background_color}; margin-right: 5px;"></span> {m.background_color}') }
    column_list = [Category.id, Category.name, Category.background_color]
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]
    column_searchable_list = [Category.name]

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"; name_plural = "Продукты"; icon = "fa-solid fa-burger"; category = "Каталог"
    column_formatters = { "is_popular": lambda m, a: bool_icon(m.is_popular) }
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, "is_popular"]
    column_searchable_list = [GlobalProduct.name]
    form_ajax_refs = {"category": {"fields": ("name",), "order_by": "id"}, "addon_groups": {"fields": ("name",), "order_by": "id"}}
    form_overrides = {'image': FileField}
    form_columns = ["id", "name", "description", "image", "category", "sub_category", "is_popular", "addon_groups"]
    async def on_model_change(self, data, model, is_created, request):
        if file := data.get("image"):
            if isinstance(file, UploadFile) and file.filename:
                data["image"] = await storage.write(name=file.filename, file=file.file)
            else: data.pop("image", None)

class VenueMenuItemAdmin(ModelView, model=VenueMenuItem):
    name = "Позиция Меню"; name_plural = "Цены и Наличие"; icon = "fa-solid fa-dollar-sign"; category = "Управление"
    column_formatters = {"price": lambda m, a: format_currency(m.price / 100, 'RUB', locale='ru_RU'), "variant": lambda m, a: str(m.variant.product) + " - " + str(m.variant) if m.variant and m.variant.product else "", "is_available": lambda m, a: bool_icon(m.is_available)}
    column_list = [VenueMenuItem.venue, "variant", "price", "is_available"]
    form_ajax_refs = {"venue": {"fields": ("name",), "order_by": "id"}, "variant": {"fields": ("name", "id"), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.variant).selectinload(GlobalProductVariant.product), selectinload(self.model.venue))

class OrderAdmin(ModelView, model=Order):
    name = "Заказ"; name_plural = "Заказы"; icon = "fa-solid fa-receipt"; category = "Управление"
    can_create = False; can_delete = True
    _status_map = {'pending': Markup('<span class="badge bg-yellow-lt">🟡 Ожидает</span>'),'paid': Markup('<span class="badge bg-green-lt">🟢 Оплачен</span>'),'awaiting_payment': Markup('<span class="badge bg-blue-lt">🔵 Ждет оплаты</span>'),'completed': Markup('<span class="badge bg-muted-lt">⚪️ Выполнен</span>'),'cancelled': Markup('<span class="badge bg-red-lt">🔴 Отменен</span>')}
    column_labels = {"id": "ID", "cafe": "Заведение", "created_at": "Дата", "total_amount": "Сумма", "status": "Статус", "order_type": "Тип", "payment_method": "Оплата", "cart_items": "Состав Заказа", "user_info": "Клиент"}
    column_list = [Order.id, Order.cafe, "created_at", "total_amount", Order.status]
    column_details_list = [Order.id, Order.cafe, "created_at", "total_amount", Order.status, Order.order_type, Order.payment_method, "user_info", "cart_items"]
    column_formatters = {"total_amount": lambda m, a: format_currency(m.total_amount / 100, 'RUB', locale='ru_RU'), "created_at": lambda m, a: m.created_at.strftime("%d.%m.%Y %H:%M") if m.created_at else "", "status": lambda m, a: OrderAdmin._status_map.get(m.status, m.status.capitalize())}
    def _format_cart_items(model, attribute):
        items_html = "<ul>";
        for item in model.cart_items:
            name = item.get('cafe_item', {}).get('name', '?'); variant = item.get('variant', {}).get('name', '?'); quantity = item.get('quantity', 0)
            items_html += f"<li><b>{name} ({variant})</b> x {quantity}</li>"
            if addons := item.get('selected_addons', []):
                items_html += "<ul>"; items_html += "".join([f"<li>+ {addon.get('name', '?')}</li>" for addon in addons]); items_html += "</ul>"
        return Markup(items_html + "</ul>")
    def _format_user_info(model, attribute):
        user = model.user_info or {}; address = user.get('shipping_address', {})
        name = user.get('first_name', 'N/A'); username = f"@{user.get('username', 'N/A')}"
        info = [f"<b>Имя:</b> {name}", f"<b>Telegram:</b> {username}"]
        if address:
            info.append(f"<b>Адрес:</b> {address.get('city', '')}, {address.get('street', '')}, д.{address.get('house', '')}, кв.{address.get('apartment', '')}")
            if comment := address.get('comment'): info.append(f"<b>Комментарий:</b> {comment}")
        return Markup("<br>".join(info))
    column_formatters_detail = {"status": lambda m, a: OrderAdmin._status_map.get(m.status, m.status.capitalize()), "cart_items": _format_cart_items, "user_info": _format_user_info}
    column_default_sort = ("created_at", True); form_columns = [Order.status]

class GlobalProductVariantAdmin(ModelView, model=GlobalProductVariant):
    name = "Вариант Продукта"; name_plural = "Варианты Продуктов"; icon = "fa-solid fa-tags"; category = "Каталог"
    
    column_details_list = [
        GlobalProductVariant.id,
        GlobalProductVariant.name,
        GlobalProductVariant.weight,
        'product',
        'venue_specific_items',
    ]
    
    column_formatters = {'product': lambda m, a: m.product.name if m.product else "N/A"}
    
    # --- ИСПРАВЛЕННЫЙ ФОРМАТТЕР ---
    column_formatters_detail = {
        'product': lambda m, a: m.product.name if m.product else "N/A",
        'venue_specific_items': lambda m, a: Markup(
            "<ul>" + "".join(
                [
                    f"<li><b>{item.venue.name}</b>: {format_currency(item.price / 100, 'RUB', locale='ru_RU')}</li>"
                    for item in sorted(m.venue_specific_items, key=lambda x: x.venue.name if x.venue else "")
                    if item.venue
                ]
            ) + "</ul>"
        )
    }
    # -----------------------------

    column_list = [GlobalProductVariant.id, GlobalProductVariant.name, 'product']
    form_ajax_refs = {"product": {"fields": ("name",), "order_by": "id"}}
    
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.product))
        
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(
            selectinload(self.model.product),
            selectinload(self.model.venue_specific_items).selectinload(VenueMenuItem.venue)
        )

# --- ВОЗВРАЩАЕМ УДАЛЕННЫЕ КЛАССЫ ---
class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    name = "Группа Добавок"; name_plural = "Группы Добавок"; icon = "fa-solid fa-layer-group"; category = "Каталог"
    column_list = [GlobalAddonGroup.id, GlobalAddonGroup.name]

class GlobalAddonItemAdmin(ModelView, model=GlobalAddonItem):
    name = "Добавка"; name_plural = "Добавки"; icon = "fa-solid fa-plus"; category = "Каталог"
    column_list = [GlobalAddonItem.id, GlobalAddonItem.name, GlobalAddonItem.group]
    form_ajax_refs = {"group": {"fields": ("name",), "order_by": "id"}}
    def list_query(self, request: Request): return select(self.model).options(selectinload(self.model.group))
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(
            selectinload(self.model.group),
            selectinload(self.model.venue_specific_items).selectinload(VenueAddonItem.venue)
        )
# ------------------------------------

class VenueAddonItemAdmin(ModelView, model=VenueAddonItem):
    name = "Цена Добавки"; name_plural = "Цены на Добавки"; icon = "fa-solid fa-money-bill-wave"; category = "Управление"
    column_formatters = {"price": lambda m, a: format_currency(m.price / 100, 'RUB', locale='ru_RU'), "addon": lambda m, a: str(m.addon) if m.addon else "", "is_available": lambda m, a: bool_icon(m.is_available)}
    column_list = [VenueAddonItem.venue, "addon", "price", "is_available"]
    form_ajax_refs = {"venue": {"fields": ("name",), "order_by": "id"},"addon": {"fields": ("name", "id"), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.addon), selectinload(self.model.venue))

def register_all_views(admin: Admin):
    admin.add_view(CafeAdmin); admin.add_view(VenueMenuItemAdmin); admin.add_view(VenueAddonItemAdmin)
    admin.add_view(OrderAdmin); admin.add_view(CategoryAdmin); admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalProductVariantAdmin); admin.add_view(GlobalAddonGroupAdmin); admin.add_view(GlobalAddonItemAdmin)