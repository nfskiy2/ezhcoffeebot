# backend/app/admin.py
import os
from passlib.context import CryptContext
from babel.numbers import format_currency

from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload
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
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = AdminAuth(secret_key=os.getenv("SECRET_KEY", "your-super-secret-key-for-sessions"))

class CafeAdmin(ModelView, model=Cafe):
    name = "Заведение"; name_plural = "Заведения"; icon = "fa-solid fa-store"; category = "Управление"
    column_list = [Cafe.id, Cafe.name, Cafe.status, Cafe.opening_hours]
    column_searchable_list = [Cafe.name, Cafe.id]
    form_overrides = {'cover_image': FileField, 'logo_image': FileField}
    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    async def on_model_change(self, data, model, is_created, request):
        for field in ["cover_image", "logo_image"]:
            file = data.get(field)
            if file and isinstance(file, UploadFile) and file.filename:
                saved_filename = await storage.write(name=file.filename, file=file.file)
                data[field] = saved_filename
            else: data.pop(field, None)

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"; name_plural = "Категории"; icon = "fa-solid fa-list"; category = "Каталог"
    column_list = [Category.id, Category.name, Category.background_color]
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]
    column_searchable_list = [Category.name]

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"; name_plural = "Продукты"; icon = "fa-solid fa-burger"; category = "Каталог"
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    column_searchable_list = [GlobalProduct.name]
    form_ajax_refs = {"category": {"fields": ("name",), "order_by": "id"}, "addon_groups": {"fields": ("name",), "order_by": "id"}}
    form_overrides = {'image': FileField}
    form_columns = [
        GlobalProduct.id, GlobalProduct.name, GlobalProduct.description, "image",
        GlobalProduct.category, GlobalProduct.sub_category, GlobalProduct.is_popular,
        GlobalProduct.addon_groups
    ]
    async def on_model_change(self, data, model, is_created, request):
        file = data.get("image")
        if file and isinstance(file, UploadFile) and file.filename:
            saved_filename = await storage.write(name=file.filename, file=file.file)
            data["image"] = saved_filename
        else: data.pop("image", None)
    
    # --- ИЗМЕНЕННЫЙ МЕТОД ---
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(
            selectinload(self.model.category), 
            selectinload(self.model.addon_groups),
            joinedload(self.model.variants) 
        )


class VenueMenuItemAdmin(ModelView, model=VenueMenuItem):
    name = "Позиция Меню"; name_plural = "Цены и Наличие"; icon = "fa-solid fa-dollar-sign"; category = "Управление"
    column_formatters = {"price": lambda m, a: format_currency(m.price / 100, 'RUB', locale='ru_RU')}
    column_list = [VenueMenuItem.venue, VenueMenuItem.variant, "price", VenueMenuItem.is_available]
    form_ajax_refs = {"venue": {"fields": ("name",), "order_by": "id"}, "variant": {"fields": ("name", "id"), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.variant).selectinload(GlobalProductVariant.product), selectinload(self.model.venue))
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == int(pk)).options(selectinload(self.model.variant).selectinload(GlobalProductVariant.product), selectinload(self.model.venue))

class OrderAdmin(ModelView, model=Order):
    name = "Заказ"; name_plural = "Заказы"; icon = "fa-solid fa-receipt"; category = "Управление"
    can_create = False; can_delete = True
    column_labels = {"id": "ID", "cafe": "Заведение", "created_at": "Дата", "total_amount": "Сумма", "status": "Статус", "order_type": "Тип", "payment_method": "Оплата"}
    column_formatters = {"total_amount": lambda m, a: format_currency(m.total_amount / 100, 'RUB', locale='ru_RU'), "created_at": lambda m, a: m.created_at.strftime("%d.%m.%Y %H:%M") if m.created_at else ""}
    column_list = [Order.id, Order.cafe, "created_at", "total_amount", Order.status, Order.order_type, Order.payment_method]
    column_default_sort = ("created_at", True)
    form_columns = [Order.status]

class GlobalProductVariantAdmin(ModelView, model=GlobalProductVariant):
    name = "Вариант Продукта"; name_plural = "Варианты Продуктов"; icon = "fa-solid fa-tags"; category = "Каталог"
    column_formatters = {
       'product': lambda m, a: m.product.name if m.product else "N/A"
    }
    # Включаем нашу новую "виртуальную" колонку в список
    column_list = [GlobalProductVariant.id, GlobalProductVariant.name, 'product']
    form_ajax_refs = {"product": {"fields": ("name",), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.product))
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(selectinload(self.model.product))

class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    name = "Группа Добавок"; name_plural = "Группы Добавок"; icon = "fa-solid fa-layer-group"; category = "Каталог"
    column_list = [GlobalAddonGroup.id, GlobalAddonGroup.name]

class GlobalAddonItemAdmin(ModelView, model=GlobalAddonItem):
    name = "Добавка"; name_plural = "Добавки"; icon = "fa-solid fa-plus"; category = "Каталог"
    column_list = [GlobalAddonItem.id, GlobalAddonItem.name, GlobalAddonItem.group]
    form_ajax_refs = {"group": {"fields": ("name",), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.group))
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == pk).options(selectinload(self.model.group))

class VenueAddonItemAdmin(ModelView, model=VenueAddonItem):
    name = "Цена Добавки"; name_plural = "Цены на Добавки"; icon = "fa-solid fa-money-bill-wave"; category = "Управление"
    column_formatters = {"price": lambda m, a: format_currency(m.price / 100, 'RUB', locale='ru_RU')}
    column_list = [VenueAddonItem.venue, VenueAddonItem.addon, "price", VenueAddonItem.is_available]
    form_ajax_refs = {"venue": {"fields": ("name",), "order_by": "id"},"addon": {"fields": ("name", "id"), "order_by": "id"}}
    def list_query(self, request: Request):
        return select(self.model).options(selectinload(self.model.addon).selectinload(GlobalAddonItem.group), selectinload(self.model.venue))
    def details_query(self, request: Request):
        pk = request.path_params["pk"]
        return select(self.model).where(self.model.id == int(pk)).options(selectinload(self.model.addon).selectinload(GlobalAddonItem.group), selectinload(self.model.venue))

def register_all_views(admin: Admin):
    admin.add_view(CafeAdmin); admin.add_view(VenueMenuItemAdmin); admin.add_view(VenueAddonItemAdmin)
    admin.add_view(OrderAdmin); admin.add_view(CategoryAdmin); admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalProductVariantAdmin); admin.add_view(GlobalAddonGroupAdmin); admin.add_view(GlobalAddonItemAdmin)