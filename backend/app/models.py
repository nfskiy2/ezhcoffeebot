# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, JSON, ForeignKey, DateTime, func,
    PrimaryKeyConstraint, ForeignKeyConstraint
)
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

from pydantic import BaseModel, Field
from typing import List, Any, Optional
from pydantic.alias_generators import to_camel

Base = declarative_base()

class Cafe(Base):
    __tablename__ = 'cafes'

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cover_image = Column(String)
    logo_image = Column(String)
    kitchen_categories = Column(String)
    rating = Column(String)
    cooking_time = Column(String)
    status = Column(String)
    opening_hours = Column(String)
    min_order_amount = Column(Integer, default=0)

    categories = relationship("Category", back_populates="cafe")
    orders = relationship("Order", back_populates="cafe")
    menu_items = relationship("MenuItem", back_populates="cafe", overlaps="category")

class Category(Base):
    __tablename__ = 'categories'

    id = Column(String, primary_key=True)
    cafe_id = Column(String, ForeignKey('cafes.id'), primary_key=True)
    icon = Column(String)
    name = Column(String)
    background_color = Column(String)

    cafe = relationship("Cafe", back_populates="categories")
    menu_items = relationship("MenuItem", back_populates="category", overlaps="cafe,menu_items")

    __table_args__ = (PrimaryKeyConstraint('id', 'cafe_id'),)

class MenuItem(Base):
    __tablename__ = 'menu_items'

    id = Column(String, primary_key=True)
    cafe_id = Column(String, primary_key=True)
    category_id = Column(String, nullable=False)
    
    image = Column(String)
    name = Column(String)
    description = Column(String)
    variants = Column(JSON)
    addons = Column(JSON, nullable=True)
    sub_category = Column(String, nullable=True)

    category = relationship(
        "Category",
        foreign_keys=[category_id, cafe_id],
        back_populates="menu_items",
        overlaps="menu_items"
    )
    cafe = relationship("Cafe", foreign_keys=[cafe_id], back_populates="menu_items", overlaps="category,menu_items")

    __table_args__ = (
        PrimaryKeyConstraint('id', 'cafe_id'),
        ForeignKeyConstraint(
            ['category_id', 'cafe_id'],
            ['categories.id', 'categories.cafe_id']
        ),
        ForeignKeyConstraint(['cafe_id'], ['cafes.id']),
    )
    
class Order(Base):
    __tablename__ = 'orders'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cafe_id = Column(String, ForeignKey('cafes.id'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    user_info = Column(JSON)
    cart_items = Column(JSON)
    total_amount = Column(Integer)
    currency = Column(String(3))
    telegram_payment_charge_id = Column(String, unique=True, nullable=True)
    status = Column(String, default='pending')

    cafe = relationship("Cafe", back_populates="orders")

class CafeSettingsSchema(BaseModel):
    min_order_amount: int

    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True

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


# --- Схемы для подсказок адреса (Dadata) ---

# Схема для запроса подсказок
class AddressSuggestionRequest(BaseModel):
    query: str
    city: str

# Схемы для ответа от Dadata
class DadataSuggestionData(BaseModel):
    street_with_type: Optional[str] = None
    house: Optional[str] = None

class DadataSuggestion(BaseModel):
    value: str
    data: DadataSuggestionData

class DadataSuggestionResponse(BaseModel):
    suggestions: List[DadataSuggestion] = []