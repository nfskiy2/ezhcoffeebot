import os
from sqladmin import Admin, ModelView
from markupsafe import Markup 
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from .models import (
    Cafe, Category, GlobalProduct, GlobalProductVariant, VenueMenuItem, Order,
    GlobalAddonGroup, GlobalAddonItem, VenueAddonItem
)
UPLOAD_DIR = "/app/uploads"
ICON_DIR = "/app/public_media/icons/category"

def get_icon_choices():
    """Сканирует папку с иконками и создает список для выпадающего меню."""
    # Путь к папке с иконками на хост-машине (снаружи Docker)
    # Мы "смотрим" из папки backend в папку frontend_modern
    icon_dir_path = os.path.join(
        os.path.dirname(__file__), # /app/
        '..', 
        '..', 
        'public_media',
        'icons',
        'category'
    )
    
    choices = []

    if os.path.exists(ICON_DIR):
        for filename in sorted(os.listdir(ICON_DIR)):
            if filename.endswith(".svg"):
                icon_path = f"/icons/category/{filename}"
                label = Markup(
                    f"<img src='{icon_path}' width='20' height='20' style='margin-right: 8px;'>"
                    f"<span>{filename}</span>"
                )
                choices.append((icon_path, label))
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
    column_list = [Category.id, Category.name, Category.background_color]
    name = "Категория"
    name_plural = "Категории"
    icon = "fa-solid fa-tags"
    form_columns = [Category.id, Category.name, Category.icon, Category.background_color]

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    column_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    name = "Продукт"
    name_plural = "Продукты (Глобально)"
    icon = "fa-solid fa-pizza-slice"
    # Добавляем возможность редактировать варианты и группы добавок прямо со страницы продукта
    column_details_exclude_list = [GlobalProduct.category_id]
    form_include_pk = True

    # Указываем, куда сохранять файлы и как на них ссылаться
    form_args = {
        "image": {
            "base_path": UPLOAD_DIR,
            "url_prefix": "/media/"
            # 'label': 'Иконка',
            # 'choices': get_icon_choices(), # Заполняем список файлами из папки
            # 'allow_blank': True, # Разрешить не выбирать иконку
        }
    }

    form_columns = [
        GlobalProduct.id,
        GlobalProduct.name,
        Category.icon,
        GlobalProduct.description,
        GlobalProduct.image,
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
    column_list = [Cafe.id, Cafe.name, Cafe.status]
    name = "Кофейня"
    name_plural = "Кофейни и Доставка"
    icon = "fa-solid fa-store"
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
    column_list = [Order.id, Order.cafe, Order.status, Order.created_at]
    column_details_exclude_list = [Order.cafe_id]
    column_default_sort = ("created_at", True) # Сортировка по дате, новые сверху
    can_create = False # Заказы создаются только через приложение
    can_delete = False # Не стоит удалять историю заказов
    name = "Заказ"
    name_plural = "Заказы"
    icon = "fa-solid fa-receipt"

# Регистрируем все представления для админки
def register_all_views(admin: Admin):
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalAddonGroupAdmin)
    # Модели-связки лучше скрыть из основного меню для чистоты
    # admin.add_view(ModelView(model=GlobalProductVariant, icon="fa-solid fa-list"))
    # admin.add_view(ModelView(model=GlobalAddonItem, icon="fa-solid fa-plus"))
    admin.add_view(CafeAdmin)
    # admin.add_view(ModelView(model=VenueMenuItem, icon="fa-solid fa-tag"))
    # admin.add_view(ModelView(model=VenueAddonItem, icon="fa-solid fa-tag"))
    admin.add_view(OrderAdmin)

