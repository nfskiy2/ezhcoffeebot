# backend/app/schemas.py
from pydantic import BaseModel, Field
from typing import List, Any, Optional
from pydantic.alias_generators import to_camel # НОВЫЙ ИМПОРТ

class CafeSchema(BaseModel):
    id: str
    name: str
    coverImage: Optional[str]
    logoImage: Optional[str]
    kitchenCategories: Optional[str]
    rating: Optional[str]
    cookingTime: Optional[str]
    status: Optional[str]
    openingHours: Optional[str]
    minOrderAmount: Optional[int]

    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True

class CategorySchema(BaseModel):
    id: str
    cafe_id: str
    icon: Optional[str]
    name: Optional[str]
    backgroundColor: Optional[str]

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
    minOrderAmount: int

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