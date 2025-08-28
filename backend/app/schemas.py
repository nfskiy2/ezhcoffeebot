# backend/app/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional
from pydantic.alias_generators import to_camel

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
        alias_generator = to_camel
        populate_by_name = True

class CategorySchema(BaseModel):
    id: str
    icon: Optional[str]
    name: Optional[str]
    background_color: Optional[str]

    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True

class MenuItemVariantSchema(BaseModel):
    id: str # ID варианта, например 'cappuccino-s'
    name: str
    cost: int # Теперь это число
    weight: Optional[str] = None

# Эта схема теперь для самой карточки товара
class MenuItemSchema(BaseModel):
    id: str # ID глобального продукта, например 'cappuccino'
    name: str
    description: Optional[str]
    image: Optional[str]
    variants: List[MenuItemVariantSchema]


class CafeSettingsSchema(BaseModel):
    min_order_amount: int

    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True

# --- Схемы для заказа (OrderRequest) ---
class DeliveryAddressSchema(BaseModel):
    city: Optional[str] = None
    street: Optional[str] = None
    house: Optional[str] = None
    apartment: Optional[str] = None
    comment: Optional[str] = None
class OrderItemCafeItem(BaseModel):
    id: str
    name: Optional[str]

class OrderItemVariant(BaseModel):
    id: str
    name: str | None = None
    cost: int | None = None

class CartItemRequest(BaseModel):
    cafeItem: OrderItemCafeItem
    variant: OrderItemVariant
    quantity: int
    categoryId: str

class OrderRequest(BaseModel):
    auth: str
    cartItems: List[CartItemRequest]
    address: Optional[DeliveryAddressSchema] = None
    paymentMethod: str 


# --- Схемы для подсказок адреса (Dadata) ---
class AddressSuggestionRequest(BaseModel):
    query: str
    city: str

class DadataSuggestionData(BaseModel):
    street_with_type: Optional[str] = None
    house: Optional[str] = None

class DadataSuggestion(BaseModel):
    value: str
    data: DadataSuggestionData

class DadataSuggestionResponse(BaseModel):
    suggestions: List[DadataSuggestion] = []

class AddonItemSchema(BaseModel):
    id: str
    name: str
    cost: int

class AddonGroupSchema(BaseModel):
    id: str
    name: str
    items: List[AddonItemSchema]

class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: int
    weight: Optional[str] = None

class MenuItemSchema(BaseModel):
    id: str
    name: str
    description: Optional[str]
    image: Optional[str]
    variants: List[MenuItemVariantSchema]
    addons: Optional[List[AddonGroupSchema]] = None
