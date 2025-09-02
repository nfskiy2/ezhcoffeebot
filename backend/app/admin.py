# backend/app/admin.py
import os
from passlib.context import CryptContext

# ИСПРАВЛЕННЫЕ ИМПОРТЫ
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin.fields import ImageUploadField  # <-- Вот правильный класс

from starlette.requests import Request

from .models import (
    Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order,
    GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
from fastapi_storages import FileSystemStorage

# --- Настройка для загрузки файлов ---
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
storage = FileSystemStorage(path=UPLOAD_DIR)

# --- Настройка для хеширования паролей ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Безопасная аутентификация для админ-панели ---
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")

        ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
        ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")

        if not ADMIN_USERNAME or not ADMIN_PASSWORD_HASH:
            print("ERROR: ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set!")
            return False

        if username == ADMIN_USERNAME and pwd_context.verify(password, ADMIN_PASSWORD_HASH):
            request.session.update({"token": "admin_token"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = AdminAuth(secret_key=os.getenv("SECRET_KEY", "your-super-secret-key-for-sessions"))

# --- Представления моделей для админ-панели ---

class CafeAdmin(ModelView, model=Cafe):
    name = "Заведение"
    name_plural = "Заведения"
    icon = "fa-solid fa-store"
    category = "Управление"

    column_list = [Cafe.id, Cafe.name, Cafe.status, Cafe.opening_hours]
    column_searchable_list = [Cafe.name, Cafe.id]
    column_sortable_list = [Cafe.id, Cafe.name]

    # --- ИСПРАВЛЕННАЯ НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ---
    form_overrides = {
        'cover_image': ImageUploadField,
        'logo_image': ImageUploadField,
    }
    # Используем form_args, чтобы передать 'storage' в конструктор поля
    form_args = {
        'cover_image': {'storage': storage},
        'logo_image': {'storage': storage},
    }

    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    
    # Этот метод теперь правильно обрабатывает загруженный файл
    async def on_model_change(self, data, model, is_created, request):
        if data.get("cover_image") and hasattr(data["cover_image"], "file"):
            data["cover_image"] = data["cover_image"].filename
        if data.get("logo_image") and hasattr(data["logo_image"], "file"):
            data["logo_image"] = data["logo_image"].filename

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-list"
    category = "Каталог"
    column_list = [Category.id, Category.name, Category.background_color]
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]
    column_searchable_list = [Category.name]

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"
    name_plural = "Продукты (глобально)"
    icon = "fa-solid fa-burger"
    category = "Каталог"
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    column_searchable_list = [GlobalProduct.name]
    form_ajax_refs = {
        "category": {"fields": ("name",), "order_by": "id"},
        "addon_groups": {"fields": ("name",), "order_by": "id"},
    }
    
    form_overrides = {'image': ImageUploadField}
    form_args = {'image': {'storage': storage}}

    form_columns = [
        GlobalProduct.id, GlobalProduct.name, GlobalProduct.description, "image",
        GlobalProduct.category, GlobalProduct.sub_category, GlobalProduct.is_popular,
        GlobalProduct.addon_groups
    ]
    
    async def on_model_change(self, data, model, is_created, request):
        if data.get("image") and hasattr(data["image"], "file"):
            data["image"] = data["image"].filename

class GlobalProductVariantAdmin(ModelView, model=GlobalProductVariant):
    name = "Вариант Продукта"
    name_plural = "Варианты Продуктов"
    icon = "fa-solid fa-tags"
    category = "Каталог"
    column_list = [GlobalProductVariant.id, GlobalProductVariant.name, GlobalProductVariant.product]
    form_ajax_refs = {"product": {"fields": ("name",), "order_by": "id"}}

class VenueMenuItemAdmin(ModelView, model=VenueMenuItem):
    name = "Позиция Меню"
    name_plural = "Позиции Меню (цены/наличие)"
    icon = "fa-solid fa-dollar-sign"
    category = "Управление"
    column_list = [VenueMenuItem.venue, VenueMenuItem.variant, VenueMenuItem.price, VenueMenuItem.is_available]
    form_ajax_refs = {
        "venue": {"fields": ("name",), "order_by": "id"},
        "variant": {"fields": ("name", "id"), "order_by": "id"},
    }

class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    name = "Группа Добавок"
    name_plural = "Группы Добавок"
    icon = "fa-solid fa-layer-group"
    category = "Каталог"
    column_list = [GlobalAddonGroup.id, GlobalAddonGroup.name]

class GlobalAddonItemAdmin(ModelView, model=GlobalAddonItem):
    name = "Добавка"
    name_plural = "Добавки (глобально)"
    icon = "fa-solid fa-plus"
    category = "Каталог"
    column_list = [GlobalAddonItem.id, GlobalAddonItem.name, GlobalAddonItem.group]
    form_ajax_refs = {"group": {"fields": ("name",), "order_by": "id"}}

class VenueAddonItemAdmin(ModelView, model=VenueAddonItem):
    name = "Цена Добавки"
    name_plural = "Цены на Добавки"
    icon = "fa-solid fa-money-bill-wave"
    category = "Управление"
    column_list = [VenueAddonItem.venue, VenueAddonItem.addon, VenueAddonItem.price, VenueAddonItem.is_available]
    form_ajax_refs = {
        "venue": {"fields": ("name",), "order_by": "id"},
        "addon": {"fields": ("name", "id"), "order_by": "id"},
    }
    
class OrderAdmin(ModelView, model=Order):
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"
    category = "Управление"
    can_create, can_delete = False, True
    column_list = [Order.id, Order.cafe, Order.created_at, Order.total_amount, Order.status, Order.order_type, Order.payment_method]
    column_sortable_list = [Order.created_at]
    column_default_sort = ("created_at", True)
    form_columns = [Order.status]

def register_all_views(admin: Admin):
    admin.add_view(CafeAdmin)
    admin.add_view(VenueMenuItemAdmin)
    admin.add_view(VenueAddonItemAdmin)
    admin.add_view(OrderAdmin)
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalProductVariantAdmin)
    admin.add_view(GlobalAddonGroupAdmin)
    admin.add_view(GlobalAddonItemAdmin)