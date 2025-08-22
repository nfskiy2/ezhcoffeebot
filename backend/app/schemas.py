# backend/app/schemas.py
from pydantic import BaseModel, Field
from typing import List, Any, Optional
from pydantic.alias_generators import to_camel # НОВЫЙ ИМПОРТ


class CafeSchema(BaseModel):
    id: str
    name: str
    cover_image: Optional[str]
    logo_image: Optional[str]
    kitchen_categories: Optional[str]
    rating: Optional[str]
    cooking_time: Optional[str]
    status: Optional[str]
    opening_hours: Optional[str]
    min_order_amount: Optional[int]

    class Config:
        from_attributes = True
        alias_generator = to_camel # <--- ДОБАВЬТЕ ЭТУ СТРОКУ
        populate_by_name = True

class CategorySchema(BaseModel):
    id: str
    cafe_id: str
    icon: Optional[str]
    name: Optional[str]
    background_color: Optional[str]

    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True

class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: str
    weight: Optional[str]

class MenuItemSchema(BaseModel):
    id: str
    cafe_id: str
    category_id: str
    image: Optional[str]
    name: Optional[str]
    description: Optional[str]
    variants: List[MenuItemVariantSchema]

    class Config:
        from_attributes = True

class CafeSettingsSchema(BaseModel):
    min_order_amount: int = Field(alias='minOrderAmount')

    class Config:
        alias_generator = to_camel
        populate_by_name = True
        from_attributes = True

# --- Схемы для заказа (OrderRequest) ---
class OrderItemCafeItem(BaseModel):
    id: str
    name: Optional[str]

class OrderItemVariant(BaseModel):
    id: str
    name: Optional[str]
    cost: Optional[str]

class CartItemRequest(BaseModel):
    cafeItem: OrderItemCafeItem
    variant: OrderItemVariant
    quantity: int
    categoryId: str

class OrderRequest(BaseModel):
    auth: str
    cartItems: List[CartItemRequest]