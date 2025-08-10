from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# Используйте LabeledPrice из библиотеки python-telegram-bot, а не создавайте свою схему с таким же именем, если только это не нужно для специфичной валидации.
# from telegram import LabeledPrice # Импортируйте LabeledPrice из telegram в bot.py/main.py при работе с инвойсами.
# Если вам нужна Pydantic схема для валидации данных в теле запроса /order,
# где вы получаете список LabeledPrice (что необычно, обычно это список ваших OrderItem),
# то схема для LabeledPrice может выглядеть так:
# class LabeledPriceSchema(BaseModel):
#     label: str
#     amount: int


class CafeInfoSchema(BaseModel):
    # Используйте Field(alias="...") для соответствия snake_case в Python и camelCase/другому в JSON
    cover_image: str = Field(..., alias="coverImage")
    logo_image: str = Field(..., alias="logoImage")
    name: str
    kitchen_categories: str = Field(..., alias="kitchenCategories")
    rating: str
    cooking_time: str = Field(..., alias="cookingTime")
    status: str

    class Config:
        populate_by_name = True # Позволяет Pydantic маппить имена по alias

class CategorySchema(BaseModel):
    id: str
    icon: str
    name: str
    background_color: str = Field(..., alias="backgroundColor")

    class Config:
        populate_by_name = True

# Схема для варианта пункта меню (как они хранятся в JSON или будут в БД JSON поле)
class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: str # Или int, если храните в копейках/центах как число
    weight: str # Или int/float в зависимости от данных

# Это схема для данных, которые БЭКЕНД ОТДАЕТ (MenuItemSchema)
class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: str # Или int, если храните в копейках/центах как число
    weight: str

# Схема для пункта меню (для эндпоинтов GET /menu/*)
class MenuItemSchema(BaseModel):
    id: str
    image: str
    name: str
    description: str
    variants: List[MenuItemVariantSchema]

# Схемы для валидации тела POST запроса /order
# Эти схемы описывают структуру данных, которую фронтенд отправляет при заказе
class OrderItemCafeItem(BaseModel):
    id: str
    name: str 
    image: str 

class OrderItemVariant(BaseModel): # Упрощенная схема для варианта в запросе
    id: str
    name: str 
    cost: str 

class CartItemRequest(BaseModel): # Схема для одного элемента в массиве cartItems
    cafe_item: OrderItemCafeItem = Field(..., alias="cafeItem")
    variant: OrderItemVariant
    quantity: int # Количество, должно быть числом

    class Config:
         populate_by_name = True # Позволяет использовать alias "cafeItem"


class OrderRequest(BaseModel): # Схема для всего тела запроса /order
    # Измените имя поля на auth_data и используйте alias="_auth"
    auth_data: str = Field(..., alias="_auth") # <-- ИЗМЕНЕНИЕ ЗДЕСЬ! Переименовано в auth_data
    cart_items: List[CartItemRequest] = Field(..., alias="cartItems")

    class Config:
        populate_by_name = True # Позволяет использовать alias "cafeItem", "cartItems"

class CafeSettingsSchema(BaseModel):
    min_order_amount: int # Минимальная сумма заказа в минимальных единицах валюты
    # В будущем здесь могут быть другие настройки

# Если вы определили LabeledPrice в schemas.py для использования в качестве типа ответа,
# хотя FastAPI эндпоинт /order возвращает {"invoiceUrl": "..."}, а не список LabeledPrice:
# class LabeledPrice(BaseModel): # <-- Переименуйте, чтобы не конфликтовать с telegram.LabeledPrice
#    label: str
#    amount: int