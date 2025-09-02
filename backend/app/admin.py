# backend/app/admin.py

import os
from markupsafe import Markup
from sqlalchemy.orm import Session
from starlette.requests import Request

from sqladmin import Admin, ModelView, action
from sqladmin.authentication import AuthenticationBackend
from sqladmin.fields import SelectField

from .models import (
    Cafe, Category, GlobalProduct, GlobalAddonGroup, GlobalAddonItem, Order
)

# --- ПУТИ ДЛЯ ФАЙЛОВ ---
UPLOAD_DIR = "/app/uploads"
ICON_DIR = "/app/public_media/icons/category"

def get_icon_choices():
    """Динамически загружает список иконок для категорий."""
    choices = [("", "Нет")]
    if not os.path.exists(ICON_DIR):
        print(f"ПРЕДУПРЕЖДЕНИЕ: Директория с иконками не найдена: {ICON_DIR}")
        return choices
    try:
        for filename in sorted(os.listdir(ICON_DIR)):
            if filename.endswith(".svg"):
                icon_path = f"/icons/category/{filename}"
                choices.append((icon_path, filename))
    except OSError as e:
        print(f"ОШИБКА: Не удалось прочитать директорию с иконками: {e}")
    return choices

# --- Аутентификация ---
class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")
        admin_user = os.getenv("ADMIN_USER", "admin")
        admin_pass = os.getenv("ADMIN_PASS", "secret")
        if username == admin_user and password == admin_pass:
            request.session.update({"token": "secret-token"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = BasicAuth(secret_key=os.getenv("SECRET_KEY", "a_very_secret_key"))

# --- Представления Моделей ---

class CategoryAdmin(ModelView, model=Category):
    category = "Меню"
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-tags"
    
    column_list = [Category.id, Category.name, Category.icon, Category.background_color]
    form_columns = [Category.name, Category.icon, Category.background_color]
    
    form_overrides = {"icon": SelectField}
    form_args = {"icon": {'label': 'Иконка', 'choices': get_icon_choices(), 'allow_blank': True}}

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    category = "Меню"
    name = "Продукт"
    name_plural = "Продукты (Глобально)"
    icon = "fa-solid fa-pizza-slice"

    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    column_searchable_list = [GlobalProduct.name, GlobalProduct.description]
    
    # ИЗМЕНЕНИЕ: Упрощаем фильтр до прямого поля, чтобы избежать ошибки.
    # Это должно работать со старыми версиями sqladmin.
    column_filters = [GlobalProduct.category_id, GlobalProduct.is_popular]
    column_labels = {GlobalProduct.category_id: "ID Категории"}

    form_args = {"image": {"base_path": UPLOAD_DIR, "url_prefix": "/media/"}}
    form_columns = [
        GlobalProduct.name, GlobalProduct.description,
        GlobalProduct.image, GlobalProduct.category, GlobalProduct.sub_category,
        GlobalProduct.is_popular, GlobalProduct.variants, GlobalProduct.addon_groups,
    ]
    column_details_exclude_list = [GlobalProduct.category_id]


class CafeAdmin(ModelView, model=Cafe):
    category = "Заведения и Заказы"
    name = "Кофейня"
    name_plural = "Кофейни и Доставка"
    icon = "fa-solid fa-store"
    
    column_list = [Cafe.id, Cafe.name, Cafe.status]
    column_filters = [Cafe.status]
    
    form_args = {
        "cover_image": { "base_path": UPLOAD_DIR, "url_prefix": "/media/" },
        "logo_image": { "base_path": UPLOAD_DIR, "url_prefix": "/media/" }
    }
    column_details_list = [
        Cafe.id, Cafe.name, Cafe.cover_image, Cafe.logo_image,
        Cafe.kitchen_categories, Cafe.opening_hours, Cafe.min_order_amount,
        Cafe.menu_items, Cafe.addon_items
    ]

class OrderAdmin(ModelView, model=Order):
    category = "Заведения и Заказы"
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"
    
    can_create = False
    column_default_sort = ("created_at", True)

    column_list = [Order.id, Order.cafe, "user_info", Order.total_amount, Order.status, Order.created_at]
    column_filters = [Order.status, Order.order_type, Order.cafe]
    
    column_labels = {
        "user_info": "Клиент",
        Order.total_amount: "Сумма",
        Order.status: "Статус",
        Order.created_at: "Время заказа",
    }
    
    column_formatters = {
        'total_amount': lambda m, a: f"{m.total_amount / 100:.2f} ₽" if m.total_amount else "0.00 ₽",
        'user_info': lambda m, a: m.user_info.get("first_name", "N/A") if m.user_info else "N/A",
        'status': lambda m, a: Markup(f'<span class="badge bg-success">{m.status}</span>') if m.status == 'paid' \
                                else Markup(f'<span class="badge bg-warning text-dark">{m.status}</span>') if m.status in ['pending', 'awaiting_payment'] \
                                else Markup(f'<span class="badge bg-primary">{m.status}</span>')
    }

    @action(
        name="mark_as_completed", label="Отметить выполненным",
        confirmation_message="Отметить выбранные заказы как 'completed'?",
        add_in_list=True, add_in_detail=True
    )
    async def mark_as_completed(self, request: Request):
        pks = request.query_params.get("pks", "").split(",")
        if not pks or pks == ['']:
            return
        
        session: Session = request.state.session
        for pk in pks:
            if not pk:
                continue
            model = await self.get_obj(pk, session)
            if model:
                model.status = "completed"
        session.flush()

class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    category = "Меню"
    name = "Группа добавок"
    name_plural = "Группы добавок"
    icon = "fa-solid fa-layer-group"
    
    form_include_pk = True
    form_columns = [GlobalAddonGroup.id, GlobalAddonGroup.name, GlobalAddonGroup.items]

class GlobalAddonItemAdmin(ModelView, model=GlobalAddonItem):
    category = "Меню"
    name = "Добавка"
    name_plural = "Все добавки"
    icon = "fa-solid fa-plus"

def register_all_views(admin: Admin):
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalAddonGroupAdmin)
    admin.add_view(GlobalAddonItemAdmin)
    admin.add_view(CafeAdmin)
    admin.add_view(OrderAdmin)