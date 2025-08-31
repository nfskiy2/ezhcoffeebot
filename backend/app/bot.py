# backend/app/bot.py
import logging
import os
import asyncio
import uuid
from typing import Optional

from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, filters, PreCheckoutQueryHandler, ContextTypes
from telegram.error import TelegramError

from .database import SessionLocal
from .models import Order, Cafe

BOT_TOKEN, PAYMENT_PROVIDER_TOKEN, APP_URL, STAFF_GROUP_ID = os.getenv('BOT_TOKEN'), os.getenv('PAYMENT_PROVIDER_TOKEN'), os.getenv('APP_URL'), os.getenv('STAFF_GROUP_ID')
WEBHOOK_URL, WEBHOOK_PATH = os.getenv('WEBHOOK_URL'), '/bot'
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

def format_order_for_message(order: Order) -> tuple[str, str]:
    db = SessionLocal()
    try:
        cafe = db.query(Cafe).filter(Cafe.id == order.cafe_id).first()
        order_id_short, total_amount_rub = str(order.id).split('-')[0], order.total_amount / 100.0
        user_info = order.user_info or {}
        first_name, username = user_info.get('first_name', 'Клиент'), user_info.get('username', '')

        item_lines = []
        for item in order.cart_items:
            item_name, variant_name, quantity = item.get('cafe_item', {}).get('name', 'Неизвестный товар'), item.get('variant', {}).get('name', ''), item.get('quantity', 0)
            line = f"  - {item_name} ({variant_name}) x {quantity}"
            addons = item.get('selected_addons', [])
            if addons: line += "\n" + "\n".join([f"     + {addon.get('name', 'добавка')}" for addon in addons])
            item_lines.append(line)
        items_text = "\n".join(item_lines)

        # --- Формирование сообщения для персонала ---
        payment_type = "💳 Онлайн" if order.status == 'paid' else "💵 При получении"
        staff_header = f"🔥 Новый заказ ({payment_type})! `#{order_id_short}` 🔥"
        
        client_link = f"@{username}" if username else "N/A"
        client_info = f"👤 **Клиент:** {first_name} ({client_link})"

        if order.order_type == 'delivery':
            address_info = user_info.get('shipping_address', {})
            address_text = (
                f"Способ получения: **Доставка**\n"
                f"📍 **Адрес:** {address_info.get('city', '')}, {address_info.get('street', '')}, д. {address_info.get('house', '')}, кв./офис {address_info.get('apartment', '')}\n"
                f"💬 **Комментарий:** {address_info.get('comment', 'нет')}"
            )
        else:
            address_text = f"Способ получения: **Самовывоз**\n📍 **Кофейня:** {cafe.name if cafe else 'Не указана'}"

        staff_text = (
            f"{staff_header}\n\n"
            f"🛍️ **Состав заказа:**\n{items_text}\n\n"
            f"💰 **Сумма:** {total_amount_rub:.2f} RUB\n"
            f"{client_info}\n\n{address_text}\n\n"
            "Необходимо связаться с клиентом для подтверждения."
        )

        # --- Формирование сообщения для клиента ---
        customer_text = (
            f"✅ Ваш заказ, {first_name}, `#{order_id_short}` принят! 🎉\n\n"
            f"🌿 **Состав заказа:**\n{items_text}\n\n"
            f"💰 **Итого:** {total_amount_rub:.2f} RUB\n\n"
            f"{address_text.replace('**', '')}\n\n" # Убираем жирный шрифт для клиента
            "Мы скоро начнем готовить. Ожидайте, пожалуйста!"
        )
        return staff_text, customer_text
    finally:
        db.close()

async def send_new_order_notifications(order: Order, bot_instance: Bot, user_id_to_notify: Optional[int], staff_group_to_notify: Optional[str]):
    staff_text, user_text = format_order_for_message(order)
    if user_id_to_notify:
        try:
            await bot_instance.send_message(chat_id=user_id_to_notify, text=user_text, parse_mode='Markdown')
        except TelegramError as e: logger.error(f"Failed to send confirmation to user {user_id_to_notify}: {e}")
    if staff_group_to_notify:
        try:
            await bot_instance.send_message(chat_id=staff_group_to_notify, text=staff_text, parse_mode='Markdown')
        except TelegramError as e: logger.error(f"Failed to send order to staff group {staff_group_to_notify}: {e}")

async def handle_start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat: return
    markup = InlineKeyboardMarkup([[InlineKeyboardButton("Открыть меню", web_app=WebAppInfo(url=APP_URL))]])
    await update.effective_chat.send_message('*Добро пожаловать в EZH Cafe!* 🌿', parse_mode='Markdown', reply_markup=markup)

async def handle_pre_checkout_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.pre_checkout_query: await update.pre_checkout_query.answer(ok=True)

async def successful_payment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.successful_payment: return
    payment_info, order_id_str = update.message.successful_payment, update.message.successful_payment.invoice_payload
    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == uuid.UUID(order_id_str)).first()
        if order:
            order.status, order.telegram_payment_charge_id = 'paid', payment_info.telegram_payment_charge_id
            db.commit()
            await send_new_order_notifications(order, context.bot, update.message.from_user.id, STAFF_GROUP_ID)
        else: logger.error(f"Order with ID {order_id_str} not found after payment!")
    finally: db.close()

async def initialize_bot_app() -> Application:
    if not BOT_TOKEN: logger.error("BOT_TOKEN is not set!"); return Application.builder().build()
    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", handle_start_command))
    application.add_handler(PreCheckoutQueryHandler(handle_pre_checkout_query))
    application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))
    return application

async def create_invoice_link(prices: list[LabeledPrice], payload: str, bot_instance: Bot) -> Optional[str]:
    logger.info(f"Attempting to create invoice with payment token: '{PAYMENT_PROVIDER_TOKEN[:8]}...'")
    if not PAYMENT_PROVIDER_TOKEN:
        logger.error("PAYMENT_PROVIDER_TOKEN is not set!")
        return None
    try:
        return await bot_instance.create_invoice_link('Заказ в EZH Cafe', 'Ваш заказ почти готов!', payload, PAYMENT_PROVIDER_TOKEN, 'RUB', prices)
    except TelegramError as e:
        logger.error(f"Failed to create invoice link for payload {payload}: {e}")
        return None

async def setup_webhook(application: Application) -> None:
    if not WEBHOOK_URL: logger.warning("WEBHOOK_URL not set."); return
    full_webhook_url = f"{WEBHOOK_URL.rstrip('/')}{WEBHOOK_PATH}"
    await application.bot.set_webhook(url=full_webhook_url)
    logger.info(f"Webhook set to {full_webhook_url}")