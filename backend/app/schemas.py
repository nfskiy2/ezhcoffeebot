# backend/app/schemas.py
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional

# ---
# ГЛАВНОЕ ИЗМЕНЕНИЕ: Базовая модель для автоматической конвертации
# snake_case (Python) <--> camelCase (JSON)
# ---
class CustomBaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

# --- Схемы для ответа API (теперь все наследуются от CustomBaseModel) ---

class CafeSchema(CustomBaseModel):
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

class CategorySchema(CustomBaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    background_color: Optional[str] = None

class MenuItemVariantSchema(CustomBaseModel):
    id: str
    name: str
    cost: str
    weight: Optional[str] = None

class AddonItemSchema(CustomBaseModel):
    id: str
    name: str
    cost: str

class AddonGroupSchema(CustomBaseModel):
    id: str
    name: str
    items: List[AddonItemSchema]

class MenuItemSchema(CustomBaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    category_id: str
    variants: List[MenuItemVariantSchema]
    addons: Optional[List[AddonGroupSchema]] = []
    sub_category: Optional[str] = None

class CafeSettingsSchema(CustomBaseModel):
    min_order_amount: Optional[int] = None


# --- Схемы для тела запроса (поля тоже приводим к snake_case) ---

class OrderItemCafeItem(CustomBaseModel):
    id: str
    name: Optional[str] = None

class OrderItemVariant(CustomBaseModel):
    id: str
    name: Optional[str] = None
    cost: Optional[str] = None

# --- FIX: Define a schema for selected addons in the request ---
class SelectedAddonSchema(CustomBaseModel):
    id: str
    name: str
    cost: str

class CartItemRequest(CustomBaseModel):
    cafe_item: OrderItemCafeItem
    variant: OrderItemVariant
    quantity: int
    category_id: str
    # --- FIX: Add the missing selected_addons field ---
    selected_addons: Optional[List[SelectedAddonSchema]] = None

class DeliveryAddress(CustomBaseModel):
    city: str
    street: str
    house: str
    apartment: str
    comment: str

class OrderRequest(CustomBaseModel):
    auth: str
    cart_items: List[CartItemRequest]
    address: Optional[DeliveryAddress] = None
    payment_method: str

class AddressSuggestionRequest(CustomBaseModel):
    query: str
    city: str

class DadataSuggestionResponse(CustomBaseModel):
    suggestions: List[dict]

class PromotionSchema(CustomBaseModel):
    id: str
    title: str
    subtitle: str
    image_url: str
    linked_category_id: str