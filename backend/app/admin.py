# backend/app/admin.py
import os
from passlib.context import CryptContext

# ИСПРАВЛЕННЫЕ ИМПОРТЫ
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.datastructures import UploadFile
from starlette.requests import Request
from wtforms import FileField # <-- Импортируем стандартное поле из WTForms

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
    
    # --- ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ ЗАГРУЗКИ ФАЙЛОВ ---
    # Мы говорим, что для этих полей в форме нужно использовать
    # стандартное поле для загрузки файлов из WTForms.
    form_overrides = {
        'cover_image': FileField,
        'logo_image': FileField,
    }
    # form_args больше не нужен.

    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    
    # Этот метод теперь должен вручную обрабатывать загрузку файла.
    async def on_model_change(self, data, model, is_created, request):
        cover_image_file = data.get("cover_image")
        logo_image_file = data.get("logo_image")

        # Проверяем, был ли загружен новый файл для cover_image
        if cover_image_file and isinstance(cover_image_file, UploadFile) and cover_image_file.filename:
            # Сохраняем файл и получаем его имя
            saved_filename = await storage.write(name=cover_image_file.filename, file=cover_image_file.file)
            # Обновляем данные для сохранения в БД только именем файла
            data["cover_image"] = saved_filename
        else:
            # Если файл не меняли (или удалили), убираем ключ из данных,
            # чтобы не затереть старое значение в БД пустым значением.
            data.pop("cover_image", None)

        # Аналогично для logo_image
        if logo_image_file and isinstance(logo_image_file, UploadFile) and logo_image_file.filename:
            saved_filename = await storage.write(name=logo_image_file.filename, file=logo_image_file.file)
            data["logo_image"] = saved_filename
        else:
            data.pop("logo_image", None)


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
    
    form_overrides = {'image': FileField}

    form_columns = [
        GlobalProduct.id, GlobalProduct.name, GlobalProduct.description, "image",
        GlobalProduct.category, GlobalProduct.sub_category, GlobalProduct.is_popular,
        GlobalProduct.addon_groups
    ]
    
    async def on_model_change(self, data, model, is_created, request):
        image_file = data.get("image")
        if image_file and isinstance(image_file, UploadFile) and image_file.filename:
            saved_filename = await storage.write(name=image_file.filename, file=image_file.file)
            data["image"] = saved_filename
        else:
            data.pop("image", None)

# ... (Остальная часть файла остается без изменений) ...

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