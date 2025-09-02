# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, JSON, ForeignKey, DateTime, func, Boolean, Table, event
)
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

product_addon_groups_association = Table(
    'product_addon_groups', Base.metadata,
    Column('product_id', String, ForeignKey('global_products.id'), primary_key=True),
    Column('addon_group_id', String, ForeignKey('global_addon_groups.id'), primary_key=True)
)

# --- Улучшение: Добавим __str__ для красивого отображения в админке ---
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
    addon_items = relationship("VenueAddonItem", back_populates="venue", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="cafe")

    def __str__(self):
        return self.name

# --- ИСПРАВЛЕННАЯ ЛОГИКА ДОБАВЛЕНИЯ ПРЕФИКСА ---
@event.listens_for(Cafe, 'before_insert')
@event.listens_for(Cafe, 'before_update')
def prepend_media_prefix_to_cafe_images(mapper, connection, target):
    # Добавляем префикс, только если это не полный URL и префикса еще нет
    if target.cover_image and not target.cover_image.startswith(('http', '/media/')):
        target.cover_image = f'/media/{target.cover_image}'
    if target.logo_image and not target.logo_image.startswith(('http', '/media/')):
        target.logo_image = f'/media/{target.logo_image}'

class Category(Base):
    __tablename__ = 'categories'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String)
    background_color = Column(String)
    products = relationship("GlobalProduct", back_populates="category")
    
    def __str__(self):
        return self.name

class GlobalProduct(Base):
    __tablename__ = 'global_products'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    image = Column(String)
    category_id = Column(String, ForeignKey('categories.id'))
    sub_category = Column(String, nullable=True)
    is_popular = Column(Boolean, default=False, nullable=False)
    
    category = relationship("Category", back_populates="products")
    variants = relationship("GlobalProductVariant", back_populates="product", cascade="all, delete-orphan")
    addon_groups = relationship("GlobalAddonGroup", secondary=product_addon_groups_association, back_populates="products")

    def __str__(self):
        return self.name

# --- ИСПРАВЛЕННАЯ ЛОГИКА ДОБАВЛЕНИЯ ПРЕФИКСА ---
@event.listens_for(GlobalProduct, 'before_insert')
@event.listens_for(GlobalProduct, 'before_update')
def prepend_media_prefix_to_product_image(mapper, connection, target):
    # Добавляем префикс, только если это не полный URL и префикса еще нет
    if target.image and not target.image.startswith(('http', '/media/')):
        target.image = f'/media/{target.image}'


class GlobalProductVariant(Base):
    __tablename__ = 'global_product_variants'
    id = Column(String, primary_key=True, index=True)
    global_product_id = Column(String, ForeignKey('global_products.id'))
    name = Column(String, nullable=False)
    weight = Column(String, nullable=True)
    
    product = relationship("GlobalProduct", back_populates="variants")
    venue_specific_items = relationship("VenueMenuItem", back_populates="variant", cascade="all, delete-orphan")

    def __str__(self):
        return f"{self.product.name if self.product else 'N/A'} - {self.name}"

class VenueMenuItem(Base):
    __tablename__ = 'venue_menu_items'
    id = Column(Integer, primary_key=True)
    venue_id = Column(String, ForeignKey('cafes.id'))
    variant_id = Column(String, ForeignKey('global_product_variants.id'))
    
    price = Column(Integer, nullable=False)
    is_available = Column(Boolean, default=True)

    venue = relationship("Cafe", back_populates="menu_items")
    variant = relationship("GlobalProductVariant", back_populates="venue_specific_items")

class GlobalAddonGroup(Base):
    __tablename__ = 'global_addon_groups'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    
    items = relationship("GlobalAddonItem", back_populates="group", cascade="all, delete-orphan")
    products = relationship("GlobalProduct", secondary=product_addon_groups_association, back_populates="addon_groups")

    def __str__(self):
        return self.name

class GlobalAddonItem(Base):
    __tablename__ = 'global_addon_items'
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey('global_addon_groups.id'))
    name = Column(String, nullable=False)
    
    group = relationship("GlobalAddonGroup", back_populates="items")
    venue_specific_items = relationship("VenueAddonItem", back_populates="addon", cascade="all, delete-orphan")

    def __str__(self):
        return self.name

class VenueAddonItem(Base):
    __tablename__ = 'venue_addon_items'
    id = Column(Integer, primary_key=True)
    venue_id = Column(String, ForeignKey('cafes.id'))
    addon_id = Column(String, ForeignKey('global_addon_items.id'))
    
    price = Column(Integer, nullable=False)
    is_available = Column(Boolean, default=True)

    venue = relationship("Cafe", back_populates="addon_items")
    addon = relationship("GlobalAddonItem", back_populates="venue_specific_items")

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
    order_type = Column(String, default='pickup')
    payment_method = Column(String, default='online')

    cafe = relationship("Cafe", back_populates="orders")
