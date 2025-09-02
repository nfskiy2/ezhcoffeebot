# backend/app/admin.py

import os
import json
from typing import Any

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin_fs.fields import ImageField  # <--- ЭТО ЕДИНСТВЕННО ПРАВИЛЬНЫЙ ИМПОРТ
from starlette.requests import Request
from markupsafe import Markup

from .models import (
    Cafe,
    Category,
    GlobalProduct,
    GlobalProductVariant,
    VenueMenuItem,
    GlobalAddonGroup,
    GlobalAddonItem,
    VenueAddonItem,
    Order,
)

# --- Конфигурация ---
UPLOAD_DIR = "/app/uploads"


def _pretty_json_formatter(model: Any, attr: str) -> Markup:
    """Вспомогательная функция для красивого отображения JSON в админке."""
    value = getattr(model, attr, None)
    if not value:
        return Markup("<p style='color: #888;'>&lt;пусто&gt;</p>")
    pretty_json = json.dumps(value, indent=2, ensure_ascii=False)
    return Markup(f"<pre><code>{pretty_json}</code></pre>")


# --- Аутентификация ---
class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")
        ADMIN_USER = os.getenv("ADMIN_USER", "admin")
        ADMIN_PASS = os.getenv("ADMIN_PASS", "secret")
        if username == ADMIN_USER and password == ADMIN_PASS:
            request.session.update({"token": "admin_logged_in"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = BasicAuth(secret_key=os.getenv("SECRET_KEY", "a_very_secret_key"))


# --- Представления Моделей ---
class CafeAdmin(ModelView, model=Cafe):
    name = "Заведение"
    name_plural = "Заведения (Кофейни и Доставка)"
    icon = "fa-solid fa-store"
    category = "Заведения и Меню"
    column_list = [Cafe.id, Cafe.name, Cafe.status, Cafe.min_order_amount]
    column_details_exclude_list = [Cafe.orders]
    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    form_overrides = {
        "cover_image": ImageField,
        "logo_image": ImageField,
    }
    form_args = {
        "cover_image": {"upload_dir": UPLOAD_DIR},
        "logo_image": {"upload_dir": UPLOAD_DIR},
    }

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-tags"
    category = "Глобальный Каталог"
    column_list = [Category.id, Category.name, Category.icon]
    column_searchable_list = [Category.name]
    form_include_pk = True
    form_columns = [Category.id, Category.name, "icon", Category.background_color]
    form_overrides = {"icon": ImageField}
    form_args = {"icon": {"upload_dir": UPLOAD_DIR}}

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"
    name_plural = "Продукты"
    icon = "fa-solid fa-cart-shopping"
    category = "Глобальный Каталог"
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    column_searchable_list = [GlobalProduct.name, GlobalProduct.description]
    column_sortable_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.is_popular]
    form_include_pk = True
    form_columns = [
        GlobalProduct.id, GlobalProduct.name, GlobalProduct.category,
        GlobalProduct.description, "image", GlobalProduct.sub_category,
        GlobalProduct.is_popular, GlobalProduct.addon_groups,
    ]
    form_overrides = {"image": ImageField}
    form_args = {"image": {"upload_dir": UPLOAD_DIR}}
    column_details_list = form_columns + [GlobalProduct.variants]

class OrderAdmin(ModelView, model=Order):
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"
    category = "Операции"
    can_create = False
    can_edit = False
    can_delete = False
    column_list = [Order.id, Order.cafe, Order.status, Order.total_amount, Order.created_at]
    column_details_list = [
        Order.id, Order.status, Order.order_type, Order.payment_method, Order.total_amount,
        Order.created_at, Order.cafe, "user_info", "cart_items", Order.telegram_payment_charge_id,
    ]
    column_formatters_detail = {
        "user_info": _pretty_json_formatter,
        "cart_items": _pretty_json_formatter,
    }
    column_sortable_list = [Order.created_at, Order.status, Order.total_amount]
    column_filters = [Order.status, Order.order_type, Order.cafe]

# --- Регистрация ---
def register_all_views(admin: Admin):
    admin.add_view(CafeAdmin)
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(OrderAdmin)