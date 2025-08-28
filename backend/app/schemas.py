# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional

# --- Схемы для ответа API (то, что мы отдаем фронтенду) ---

class CafeSchema(BaseModel):
    id: str
    name: str
    cover_image: Optional[str] = None
    logo_image: Optional[str] = None
    kitchen_categories: Optional[str] = None
    rating: Optional[str] = None
    cooking_time: Optional[str] = None
    status: Optional[str] = None
    opening_hours: Optional[str] = None
    min_order_amount: Optional[int] = None

    class Config:
        from_attributes = True

class CategorySchema(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    background_color: Optional[str] = None

    class Config:
        from_attributes = True

class MenuItemVariantSchema(BaseModel):
    id: str
    name: str
    cost: str
    weight: Optional[str] = None

class AddonItemSchema(BaseModel):
    id: str
    name: str
    cost: str

class AddonGroupSchema(BaseModel):
    id: str
    name: str
    items: List[AddonItemSchema]

class MenuItemSchema(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    category_id: str
    variants: List[MenuItemVariantSchema]
    addons: Optional[List[AddonGroupSchema]] = []
    subCategory: Optional[str] = None

    class Config:
        from_attributes = True


class CafeSettingsSchema(BaseModel):
    min_order_amount: Optional[int] = None


# --- Схемы для тела запроса (то, что мы получаем от фронтенда) ---

class OrderItemCafeItem(BaseModel):
    id: str
    name: Optional[str] = None

class OrderItemVariant(BaseModel):
    id: str
    name: Optional[str] = None
    cost: Optional[str] = None

class CartItemRequest(BaseModel):
    cafeItem: OrderItemCafeItem
    variant: OrderItemVariant
    quantity: int
    categoryId: str

class DeliveryAddress(BaseModel):
    city: str
    street: str
    house: str
    apartment: str
    comment: str

class OrderRequest(BaseModel):
    auth: str
    cartItems: List[CartItemRequest]
    address: Optional[DeliveryAddress] = None
    paymentMethod: str

class AddressSuggestionRequest(BaseModel):
    query: str
    city: str

class DadataSuggestionResponse(BaseModel):
    suggestions: List[dict]