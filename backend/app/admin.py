import os
from sqladmin import Admin, ModelView
from markupsafe import Markup 
from sqladmin.fields import SelectField
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from .models import (
    Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order,
    GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
UPLOAD_DIR = "/app/uploads"
ICON_DIR = "/app/public_media/icons/category"

def get_icon_choices():
    """Динамически сканирует папку с иконками и создает список для выпадающего меню."""
    choices = [("", "Нет")] # Позволяет не выбирать иконку
    if not os.path.exists(ICON_DIR):
        print(f"ПРЕДУПРЕЖДЕНИЕ: Директория с иконками не найдена по пути {ICON_DIR}")
        return choices

    for filename in sorted(os.listdir(ICON_DIR)):
        if filename.endswith(".svg"):
            icon_path = f"/icons/category/{filename}"
            # Для красивого отображения в админке можно использовать Markup,
            # но для стабильности начнем с простого текста.
            choices.append((icon_path, filename))
    return choices

UPLOAD_DIR = "/app/uploads"
# --- ПРОСТАЯ АУТЕНТИФИКАЦИЯ ---
# (В будущем можно заменить на OAuth2 или JWT)
class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form["username"], form["password"]
        
        # Используем переменные окружения для безопасности
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


# --- ОПРЕДЕЛЕНИЕ ПРЕДСТАВЛЕНИЙ (VIEWS) ДЛЯ КАЖДОЙ МОДЕЛИ ---

class CategoryAdmin(ModelView, model=Category):
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-tags"
    column_list = [Category.id, Category.name, Category.icon, Category.background_color]
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]


    form_overrides = {
        "icon": SelectField,
    }
    form_args = {
        "icon": {
            'label': 'Иконка',
            'choices': get_icon_choices(), # Динамически получаем список
            'allow_blank': True,
        }
    }


class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Продукт"
    name_plural = "Продукты (Глобально)"
    icon = "fa-solid fa-pizza-slice"
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]

    # Добавляем возможность редактировать варианты и группы добавок прямо со страницы продукта
    column_details_exclude_list = [GlobalProduct.category_id]
    form_include_pk = True

    # Указываем, куда сохранять файлы и как на них ссылаться
    form_args = {
        "image": {
            "base_path": UPLOAD_DIR,
            "url_prefix": "/media/"
        }
    }

    form_columns = [
        GlobalProduct.id,
        GlobalProduct.name,
        GlobalProduct.description,
        GlobalProduct.image, # Это поле станет загрузчиком автоматически
        GlobalProduct.category,
        GlobalProduct.sub_category,
        GlobalProduct.is_popular,
        GlobalProduct.variants,
        GlobalProduct.addon_groups,
    ]

class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    column_list = [GlobalAddonGroup.id, GlobalAddonGroup.name]
    name = "Группа добавок"
    name_plural = "Группы добавок"
    icon = "fa-solid fa-layer-group"
    form_include_pk = True
    form_columns = [
        GlobalAddonGroup.id,
        GlobalAddonGroup.name,
        GlobalAddonGroup.items
    ]

class CafeAdmin(ModelView, model=Cafe):
    name = "Кофейня"
    name_plural = "Кофейни и Доставка"
    icon = "fa-solid fa-store"    
    column_list = [Cafe.id, Cafe.name, Cafe.status]

    # Включаем управление ценами и стоп-листом прямо из карточки кофейни

    form_args = {
        "cover_image": { "base_path": UPLOAD_DIR, "url_prefix": "/media/" },
        "logo_image": { "base_path": UPLOAD_DIR, "url_prefix": "/media/" }
    }

    column_details_list = [
        Cafe.id, Cafe.name, Cafe.cover_image, Cafe.logo_image,
        Cafe.kitchen_categories, Cafe.opening_hours, Cafe.min_order_amount,
        Cafe.menu_items,  # Цены на основные блюда
        Cafe.addon_items # Цены на добавки
    ]

class OrderAdmin(ModelView, model=Order):
    can_create = False
    can_delete = False
    column_list = [Order.id, Order.cafe, Order.status, Order.created_at]
    column_details_exclude_list = [Order.cafe_id]
    column_default_sort = ("created_at", True)
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"

# Регистрируем все представления для админки
def register_all_views(admin: Admin):
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    # ИСПРАВЛЕННЫЙ СИНТАКСИС ДЛЯ ВСЕХ ModelView
    admin.add_view(ModelView(GlobalAddonGroup, name="Группы добавок", name_plural="Группы добавок", icon="fa-solid fa-layer-group"))
    admin.add_view(ModelView(GlobalAddonItem, name="Добавка", name_plural="Все добавки", icon="fa-solid fa-plus"))
    admin.add_view(CafeAdmin)
    admin.add_view(OrderAdmin)
