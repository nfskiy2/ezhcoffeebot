# backend/app/admin.py

import os
import json
from typing import Any

from sqladmin import Admin, ModelView, InlineModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin_fs.fields import ImageField
from starlette.requests import Request
from markupsafe import Markup

from .models import (
    Cafe,
    Category,
    GlobalProduct,
    GlobalProductVariant,
    VenueMenuItem,
    GlobalAddonGroup,
    GlobalAddonItem,
    VenueAddonItem,
    Order,
)

# --- Configuration ---
UPLOAD_DIR = "/app/uploads"
# Base URL for media files, assuming they are served from '/media'
MEDIA_URL = "/media/"

# --- Helper Functions ---
def _pretty_json_formatter(model: Any, attr: str) -> Markup:
    """Helper function to beautifully display JSON in the admin panel."""
    value = getattr(model, attr, None)
    if not value:
        return Markup("<p style='color: #888;'>&lt;empty&gt;</p>")
    try:
        user_info = value.get('user_info', {})
        first_name = user_info.get('first_name', 'Unknown')
        username = user_info.get('username')
        if username:
            return Markup(f"<p>{first_name} (@{username})</p>")
        return Markup(f"<p>{first_name}</p>")
    except (AttributeError, TypeError):
         pretty_json = json.dumps(value, indent=2, ensure_ascii=False)
         return Markup(f"<pre><code>{pretty_json}</code></pre>")


def _image_formatter(model: Any, attr: str) -> Markup:
    """Helper function to display an image preview."""
    url = getattr(model, attr)
    if url:
        # Prepend MEDIA_URL if it's a relative path from uploads
        full_url = url if url.startswith('http') or url.startswith('/') else f"{MEDIA_URL}{url}"
        return Markup(f'<img src="{full_url}" width="60" height="60" style="object-fit: cover; border-radius: 8px;">')
    return Markup("<span>No Image</span>")

# --- Authentication ---
class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")
        ADMIN_USER = os.getenv("ADMIN_USER", "admin")
        ADMIN_PASS = os.getenv("ADMIN_PASS", "secret")
        if username == ADMIN_USER and password == ADMIN_PASS:
            request.session.update({"token": "admin_logged_in"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return "token" in request.session

authentication_backend = BasicAuth(secret_key=os.getenv("SECRET_KEY", "a_very_secret_key"))


# --- Inline Model Views (for managing related items directly) ---

class GlobalProductVariantInline(InlineModelView, model=GlobalProductVariant):
    """Inline view for product variants (e.g., Small, Medium)."""
    column_list = [GlobalProductVariant.id, GlobalProductVariant.name, GlobalProductVariant.weight]
    form_include_pk = True # Allow setting custom string IDs

class GlobalAddonItemInline(InlineModelView, model=GlobalAddonItem):
    """Inline view for addon items (e.g., Vanilla Syrup, Caramel Syrup)."""
    column_list = [GlobalAddonItem.id, GlobalAddonItem.name]
    form_include_pk = True

class VenueMenuItemInline(InlineModelView, model=VenueMenuItem):
    """Inline view for managing prices and availability of product variants in a specific venue."""
    # We want to see the product name, not just the variant ID
    column_list = [VenueMenuItem.id, "variant.product", "variant", VenueMenuItem.price, VenueMenuItem.is_available]
    # Make names more readable
    column_labels = {
        "variant.product": "Product",
        "variant": "Variant",
        "price": "Price (in cents)",
        "is_available": "Available"
    }

class VenueAddonItemInline(InlineModelView, model=VenueAddonItem):
    """Inline view for managing prices and availability of addons in a specific venue."""
    column_list = [VenueAddonItem.id, "addon.name", "addon.group.name", VenueAddonItem.price, VenueAddonItem.is_available]
    column_labels = {
        "addon.name": "Addon",
        "addon.group.name": "Group",
        "price": "Price (in cents)",
        "is_available": "Available"
    }


# --- Main Model Views ---

class CategoryAdmin(ModelView, model=Category):
    name = "Category"
    name_plural = "Categories"
    icon = "fa-solid fa-tags"
    category = "Global Catalog"
    
    column_list = ["icon_preview", Category.id, Category.name, Category.background_color]
    column_labels = {"id": "ID", "name": "Name", "background_color": "Background", "icon_preview": "Icon"}
    column_formatters = {"icon_preview": _image_formatter}
    column_searchable_list = [Category.name]
    
    form_include_pk = True
    form_columns = [Category.id, Category.name, "icon", Category.background_color]
    form_overrides = {"icon": ImageField}
    form_args = {"icon": {"upload_dir": UPLOAD_DIR}}

class GlobalProductAdmin(ModelView, model=GlobalProduct):
    name = "Product"
    name_plural = "Products"
    icon = "fa-solid fa-cookie-bite"
    category = "Global Catalog"

    # Inlines
    inlines = [GlobalProductVariantInline]

    column_list = ["image_preview", GlobalProduct.id, GlobalProduct.name, GlobalProduct.category, GlobalProduct.is_popular]
    column_labels = {"id": "ID", "name": "Name", "category": "Category", "is_popular": "Popular", "image_preview": "Image"}
    column_formatters = {"image_preview": _image_formatter}
    column_searchable_list = [GlobalProduct.name, GlobalProduct.description]
    column_sortable_list = [GlobalProduct.id, GlobalProduct.name, GlobalProduct.is_popular]
    column_filters = [GlobalProduct.category, GlobalProduct.is_popular]

    form_include_pk = True
    form_columns = [
        GlobalProduct.id,
        GlobalProduct.name,
        GlobalProduct.category,
        GlobalProduct.description,
        "image",
        GlobalProduct.sub_category,
        GlobalProduct.is_popular,
        GlobalProduct.addon_groups,
    ]
    form_overrides = {"image": ImageField}
    form_args = {"image": {"upload_dir": UPLOAD_DIR}}
    column_details_list = form_columns + [GlobalProduct.variants]

class GlobalAddonGroupAdmin(ModelView, model=GlobalAddonGroup):
    name = "Addon Group"
    name_plural = "Addon Groups"
    icon = "fa-solid fa-layer-group"
    category = "Global Catalog"

    inlines = [GlobalAddonItemInline]
    
    column_list = [GlobalAddonGroup.id, GlobalAddonGroup.name]
    column_searchable_list = [GlobalAddonGroup.name]
    form_include_pk = True

class CafeAdmin(ModelView, model=Cafe):
    name = "Venue"
    name_plural = "Venues & Menus"
    icon = "fa-solid fa-store"
    category = "Venues"
    
    # Inlines for managing menu prices
    inlines = [VenueMenuItemInline, VenueAddonItemInline]
    
    column_list = ["logo_preview", Cafe.id, Cafe.name, Cafe.status, Cafe.min_order_amount]
    column_labels = {"logo_preview": "Logo", "id": "ID", "name": "Name", "status": "Status", "min_order_amount": "Min. Order (cents)"}
    column_formatters = {"logo_preview": _image_formatter}
    column_searchable_list = [Cafe.name, Cafe.id]
    column_filters = [Cafe.status]

    form_columns = [
        Cafe.id, Cafe.name, Cafe.status, "cover_image", "logo_image",
        Cafe.kitchen_categories, Cafe.rating, Cafe.cooking_time,
        Cafe.opening_hours, Cafe.min_order_amount,
    ]
    form_overrides = {
        "cover_image": ImageField,
        "logo_image": ImageField,
    }
    form_args = {
        "cover_image": {"upload_dir": UPLOAD_DIR},
        "logo_image": {"upload_dir": UPLOAD_DIR},
    }

class OrderAdmin(ModelView, model=Order):
    name = "Order"
    name_plural = "Orders"
    icon = "fa-solid fa-receipt"
    category = "Operations"
    
    can_create = False
    can_edit = False
    can_delete = False
    
    column_list = [Order.id, Order.cafe, "user_info", Order.status, Order.total_amount, Order.created_at]
    column_labels = {
        "id": "Order ID", 
        "cafe": "Venue", 
        "user_info": "Customer", 
        "status": "Status", 
        "total_amount": "Total (cents)", 
        "created_at": "Date"
    }
    column_formatters = {
        "user_info": _pretty_json_formatter,
    }
    column_formatters_detail = {
        "user_info": _pretty_json_formatter,
        "cart_items": _pretty_json_formatter, # Keep the detailed JSON view for cart items
    }
    column_sortable_list = [Order.created_at, Order.status, Order.total_amount]
    column_filters = [Order.status, Order.order_type, Order.cafe]
    # Sort by most recent orders by default
    column_default_sort = ("created_at", True)


# --- Registration ---
def register_all_views(admin: Admin):
    # Global catalog management
    admin.add_view(CategoryAdmin)
    admin.add_view(GlobalProductAdmin)
    admin.add_view(GlobalAddonGroupAdmin)

    # Venue and menu price management
    admin.add_view(CafeAdmin)
    
    # Order management
    admin.add_view(OrderAdmin)