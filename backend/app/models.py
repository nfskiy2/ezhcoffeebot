from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class Category(Base):
    __tablename__ = 'categories'

    id = Column(String, primary_key=True)
    icon = Column(String)
    name = Column(String)
    background_color = Column(String) # Может быть полезно

    menu_items = relationship("MenuItem", back_populates="category")

class MenuItem(Base):
    __tablename__ = 'menu_items'

    id = Column(String, primary_key=True)
    category_id = Column(String, ForeignKey('categories.id'))
    image = Column(String)
    name = Column(String)
    description = Column(String)
    variants = Column(JSON) # Храним варианты как JSON массив внутри записи

    category = relationship("Category", back_populates="menu_items")

# Возможно, модель для info (проще одну запись или хардкод, но для примера):
# class CafeInfo(Base):
#     __tablename__ = 'cafe_info'
#     id = Column(Integer, primary_key=True) # Нужен PK
#     cover_image = Column(String)
#     logo_image = Column(String)
#     name = Column(String)
#     kitchen_categories = Column(String)
#     rating = Column(String)
#     cooking_time = Column(String)
#     status = Column(String)