# backend/app/models.py
from sqlalchemy import (
    Column, Integer, String, JSON, ForeignKey,
    PrimaryKeyConstraint, ForeignKeyConstraint, DateTime, func
)
import uuid # Для генерации уникальных ID
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

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
    menu_items = relationship("MenuItem", back_populates="cafe", overlaps="category")

class Order(Base):
    __tablename__ = 'orders'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4) # Уникальный ID заказа
    cafe_id = Column(String, ForeignKey('cafes.id'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    # Сохраняем данные о пользователе и заказе как JSON
    user_info = Column(JSON) # { "name": "...", "phone_number": "...", "shipping_address": "..." }
    cart_items = Column(JSON) # [ { "cafeItem": {...}, "variant": {...}, "quantity": ... }, ... ]
    total_amount = Column(Integer) # Общая сумма в минимальных единицах
    currency = Column(String(3))
    telegram_payment_charge_id = Column(String, unique=True, nullable=True) # ID платежа от Telegram
    status = Column(String, default='pending') # Статусы: pending, paid, failed

    cafe = relationship("Cafe")

# ОБНОВЛЕННАЯ МОДЕЛЬ: Category с составным первичным ключом
class Category(Base):
    __tablename__ = 'categories'

    # Составной первичный ключ по id и cafe_id
    id = Column(String, nullable=False) # Больше не primary_key=True здесь
    cafe_id = Column(String, ForeignKey('cafes.id'), nullable=False)
    # Определяем составной первичный ключ
    __table_args__ = (PrimaryKeyConstraint('id', 'cafe_id'),) # <--- ДОБАВЬТЕ ЭТУ СТРОКУ

    icon = Column(String)
    name = Column(String)
    background_color = Column(String)

    cafe = relationship("Cafe", back_populates="categories")
    menu_items = relationship("MenuItem", back_populates="category")


# ОБНОВЛЕННАЯ МОДЕЛЬ: MenuItem с составным первичным ключом (id, cafe_id)
class MenuItem(Base):
    __tablename__ = 'menu_items'
    
    id = Column(String, nullable=False)
    cafe_id = Column(String, ForeignKey('cafes.id'), nullable=False)
    category_id = Column(String, nullable=False) # Привязка к категории (без ForeignKeyConstraint здесь)
    # Определяем составной первичный ключ
    __table_args__ = (
        PrimaryKeyConstraint('id', 'cafe_id'),
        ForeignKeyConstraint( # <--- Вот где используется
            ['category_id', 'cafe_id'], # Колонки в MenuItem
            ['categories.id', 'categories.cafe_id'] # Колонки в Categories, на которые ссылаемся
        ),
    )

    image = Column(String)
    name = Column(String)
    description = Column(String)
    variants = Column(JSON)
    addons = Column(JSON, nullable=True)

    # Устанавливаем отношение с Category.
    # primaryjoin гарантирует, что мы связываем MenuItem с Category, принадлежащей той же кофейне.
    category = relationship(
        "Category",
        primaryjoin="and_(MenuItem.category_id == Category.id, MenuItem.cafe_id == Category.cafe_id)",
        back_populates="menu_items"
    )
    # ИСПРАВЛЕНИЕ: Добавляем overlaps
    cafe = relationship("Cafe", back_populates="menu_items", overlaps="category") # Добавляем overlaps здесь
