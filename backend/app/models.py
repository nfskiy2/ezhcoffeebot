# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, JSON, ForeignKey, DateTime, func, Boolean
)
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

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
    menu_items = relationship("VenueMenuItem", back_populates="venue", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="cafe")

class Category(Base):
    __tablename__ = 'categories'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String)
    background_color = Column(String)
    products = relationship("GlobalProduct", back_populates="category")

class GlobalProduct(Base):
    __tablename__ = 'global_products'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    image = Column(String)
    category_id = Column(String, ForeignKey('categories.id'))
    category = relationship("Category", back_populates="products")
    variants = relationship("GlobalProductVariant", back_populates="product", cascade="all, delete-orphan")
    venue_specific_items = relationship("VenueMenuItem", back_populates="global_product", cascade="all, delete-orphan")

class GlobalProductVariant(Base):
    __tablename__ = 'global_product_variants'
    id = Column(String, primary_key=True, index=True)
    global_product_id = Column(String, ForeignKey('global_products.id'))
    name = Column(String, nullable=False)
    weight = Column(String, nullable=True)
    product = relationship("GlobalProduct", back_populates="variants")
    venue_specific_items = relationship("VenueMenuItem", back_populates="variant", cascade="all, delete-orphan")

class VenueMenuItem(Base):
    __tablename__ = 'venue_menu_items'
    id = Column(Integer, primary_key=True)
    venue_id = Column(String, ForeignKey('cafes.id'))
    variant_id = Column(String, ForeignKey('global_product_variants.id'))
    global_product_id = Column(String, ForeignKey('global_products.id')) # Явный ключ
    price = Column(Integer, nullable=False)
    is_available = Column(Boolean, default=True)
    venue = relationship("Cafe", back_populates="menu_items")
    variant = relationship("GlobalProductVariant", back_populates="venue_specific_items")
    global_product = relationship("GlobalProduct", back_populates="venue_specific_items")

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