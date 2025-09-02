# backend/app/admin.py

import os
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin.fields import SelectField
from markupsafe import Markup
from starlette.requests import Request

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

# --- Configuration ---
UPLOAD_DIR = "/app/uploads"
ICON_DIR = "/app/public_media/icons/category"

def get_icon_choices():
    choices = [("", "Нет")]
    if not os.path.exists(ICON_DIR):
        print(f"ПРЕДУПРЕЖДЕНИЕ: Директория с иконками не найдена: {ICON_DIR}")
        return choices
    for filename in sorted(os.listdir(ICON_DIR)):
        if filename.endswith(".svg"):
            icon_path = f"/icons/category/{filename}"
            choices.append((icon_path, filename))
    return choices

# --- Аутентификация ---
class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form["username"], form["password"]
        admin_user = os.getenv("ADMIN_USER", "admin")
        admin_pass = os.getenv("ADMIN_PASS", "secret")
        if username == admin_user and password == admin_pass:
            request.session.update({"token": "..."})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = BasicAuth(secret_key=os.getenv("SECRET_KEY", "a_very_secret_key"))


# --- Inline Model Views (for managing related items directly) ---

class GlobalProductVariantInline(InlineModelView, model=GlobalProductVariant):
    """Inline view for product variants (e.g., Small, Medium)."""
    column_list = [GlobalProductVariant.id, GlobalProductVariant.name, GlobalProductVariant.weight]
    form_include_pk = True # Allow setting custom string IDs

class GlobalAddonItemInline(InlineModelView, model=GlobalAddonItem):
    """Inline view for addon items (e.g., Vanilla Syrup, Caramel Syrup)."""
    column_list = [GlobalAddonItem.id, GlobalAddonItem.name]
    form_include_pk = True

class VenueMenuItemInline(InlineModelView, model=VenueMenuItem):
    """Inline view for managing prices and availability of product variants in a specific venue."""
    # We want to see the product name, not just the variant ID
    column_list = [VenueMenuItem.id, "variant.product", "variant", VenueMenuItem.price, VenueMenuItem.is_available]
    # Make names more readable
    column_labels = {
        "variant.product": "Product",
        "variant": "Variant",
        "price": "Price (in cents)",
        "is_available": "Available"
    }

class VenueAddonItemInline(InlineModelView, model=VenueAddonItem):
    """Inline view for managing prices and availability of addons in a specific venue."""
    column_list = [VenueAddonItem.id, "addon.name", "addon.group.name", VenueAddonItem.price, VenueAddonItem.is_available]
    column_labels = {
        "addon.name": "Addon",
        "addon.group.name": "Group",
        "price": "Price (in cents)",
        "is_available": "Available"
    }


# --- Main Model Views ---

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-tags"
    column_list = [Category.id, Category.name, Category.icon, Category.background_color]
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]
    form_overrides = {"icon": SelectField}
    form_args = {"icon": {'label': 'Иконка', 'choices': get_icon_choices(), 'allow_blank': True}}

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"
    name_plural = "Продукты (Глобально)"
    icon = "fa-solid fa-pizza-slice"
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    form_args = {"image": {"base_path": UPLOAD_DIR, "url_prefix": "/media/"}}
    form_columns = [
        GlobalProduct.id, GlobalProduct.name, GlobalProduct.description,
        GlobalProduct.image, GlobalProduct.category, GlobalProduct.sub_category,
        GlobalProduct.is_popular, GlobalProduct.variants, GlobalProduct.addon_groups,
    ]

class CafeAdmin(ModelView, model=Cafe):
    name = "Кофейня"
    name_plural = "Кофейни и Доставка"
    icon = "fa-solid fa-store"
    column_list = [Cafe.id, Cafe.name, Cafe.status]
    form_args = {
        "cover_image": {"upload_dir": UPLOAD_DIR},
        "logo_image": {"upload_dir": UPLOAD_DIR},
    }

class OrderAdmin(ModelView, model=Order):
    can_create = False
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"

# <<< ИСПРАВЛЕНИЕ: СОЗДАЕМ КЛАССЫ-ПРЕДСТАВЛЕНИЯ ДЛЯ ДОБАВОК >>>
class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    name = "Группа добавок"
    name_plural = "Группы добавок"
    icon = "fa-solid fa-layer-group"
    form_include_pk = True
    form_columns = [GlobalAddonGroup.id, GlobalAddonGroup.name, GlobalAddonGroup.items]

class GlobalAddonItemAdmin(ModelView, model=GlobalAddonItem):
    name = "Добавка"
    name_plural = "Все добавки"
    icon = "fa-solid fa-plus"

# <<< ИСПРАВЛЕНИЕ: ЧИСТАЯ И ПРАВИЛЬНАЯ РЕГИСТРАЦИЯ >>>
def register_all_views(admin: Admin):
    # Global catalog management
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalAddonGroupAdmin) # Регистрируем новый класс
    admin.add_view(GlobalAddonItemAdmin)  # Регистрируем новый класс
    admin.add_view(CafeAdmin)
    
    # Order management
    admin.add_view(OrderAdmin)