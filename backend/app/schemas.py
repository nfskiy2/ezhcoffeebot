# backend/app/schemas.py
from pydantic import BaseModel, Field
from typing import List, Any, Optional

# Схема для Cafe
class CafeSchema(BaseModel):
    id: str
    name: str
    cover_image: Optional[str] = Field(alias="coverImage") # Для camelCase conversion
    logo_image: Optional[str] = Field(alias="logoImage")   # Для camelCase conversion
    kitchen_categories: Optional[str] = Field(alias="kitchenCategories")
    rating: Optional[str] = None
    cooking_time: Optional[str] = Field(alias="cookingTime")
    status: Optional[str] = None
    opening_hours: Optional[str] = Field(alias="openingHours") # Новое поле
    min_order_amount: Optional[int] = Field(alias="minOrderAmount") # Новое поле

    class Config:
        populate_by_name = True
        from_attributes = True

# Схема для Category
class CategorySchema(BaseModel):
    id: str
    cafe_id: str # Привязка к кофейне
    icon: Optional[str] = None
    name: Optional[str] = None
    background_color: Optional[str] = Field(alias="backgroundColor")

    class Config:
        populate_by_name = True
        from_attributes = True

# Схема для MenuItemVariant (варианты блюд)
class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: str # Стоимость в минимальных единицах, как строка (например, "1199")
    weight: Optional[str] = None

# Схема для MenuItem (элемент меню)
class MenuItemSchema(BaseModel):
    id: str
    cafe_id: str
    category_id: str
    image: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    variants: List[MenuItemVariantSchema] = [] # Варианты теперь типизированы

    class Config:
        from_attributes = True

# Схема для настроек кафе (мин. сумма заказа)
class CafeSettingsSchema(BaseModel):
    min_order_amount: int

# --- Схемы для заказа (OrderRequest) ---

# Внутренняя схема для cafe_item в CartItemRequest
class OrderItemCafeItem(BaseModel):
    id: str
    name: Optional[str] = None # Имя для метки
    image: Optional[str] = None # Изображение для корзины на фронтенде (может не передаваться в order request)

# Внутренняя схема для variant в CartItemRequest
class OrderItemVariant(BaseModel):
    id: str
    name: Optional[str] = None
    cost: Optional[str] = None # Стоимость, которую фронтенд может передать (бэкенд все равно перепроверит)

# Схема для элемента корзины в запросе заказа
class CartItemRequest(BaseModel):
    cafe_item: OrderItemCafeItem = Field(alias="cafeItem")
    variant: OrderItemVariant
    quantity: int
    category_id: str # НОВОЕ ПОЛЕ: id категории, чтобы бэкенд мог проверить принадлежность

    class Config:
        populate_by_name = True # Позволяет использовать cafeItem вместо cafe_item при парсинге


class OrderRequest(BaseModel):
    # ИСПРАВЛЕНИЕ: Имя поля auth, alias="_auth"
    auth: str  # <--- ИСПРАВЛЕНО: Имя поля без подчеркивания. Alias для поля JSON
    cart_items: List[CartItemRequest] 

    class Config:
        populate_by_name = True

