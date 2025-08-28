# backend/app/bot.py
import logging
import os
import asyncio
import uuid
from typing import Optional

from telegram import (
    Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Bot
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters, PreCheckoutQueryHandler, ContextTypes
)
from telegram.error import TelegramError

from .database import SessionLocal
from .models import Order

# --- Константы и переменные окружения ---
BOT_TOKEN = os.getenv('BOT_TOKEN')
PAYMENT_PROVIDER_TOKEN = os.getenv('PAYMENT_PROVIDER_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
WEBHOOK_PATH = '/bot'
APP_URL = os.getenv('APP_URL')
STAFF_GROUP_ID = os.getenv('STAFF_GROUP_ID')

# Настройка логирования
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Вспомогательные функции ---

def format_order_for_message(order: Order, for_staff: bool = False) -> str:
    """
    (ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
    Форматирует детали заказа в красивое текстовое сообщение.
    Использует правильные snake_case ключи для доступа к данным.
    """
    order_id_short = str(order.id).split('-')[0]
    
    item_lines = []
    for item in order.cart_items:
        # --- ИСПРАВЛЕНИЕ 1: Ищем ключ 'cafe_item' вместо 'cafeItem' ---
        item_name = item.get('cafe_item', {}).get('name', 'Неизвестный товар')
        variant_name = item.get('variant', {}).get('name', '')
        quantity = item.get('quantity', 0)
        
        # Основная строка товара
        line = f"  - {item_name} ({variant_name}) x {quantity}"
        
        # --- ИСПРАВЛЕНИЕ 2: Ищем ключ 'selected_addons' вместо 'selectedAddons' ---
        addons = item.get('selected_addons', [])
        if addons:
            for addon in addons:
                addon_name = addon.get('name', 'добавка')
                line += f"\n    + {addon_name}"
        
        item_lines.append(line)
    
    items_text = "\n".join(item_lines)
    total_amount_rub = order.total_amount / 100.0

    if for_staff:
        user_info = order.user_info or {}
        username = user_info.get('username', 'N/A')
        first_name = user_info.get('first_name', '')
        last_name = user_info.get('last_name', '')
        
        message_text = (
            f"🔔 Новый заказ `#{order_id_short}`\n\n"
            f"👤 **Клиент:** {first_name} {last_name} (@{username})\n"
            f"🌿 **Состав заказа:**\n{items_text}\n\n"
            f"💰 **Итого:** {total_amount_rub:.2f} RUB"
        )
    else:
        message_text = (
            f"✅ Ваш заказ `#{order_id_short}` принят! 🎉\n\n"
            f"🌿 **Состав заказа:**\n{items_text}\n\n"
            f"💰 **Итого:** {total_amount_rub:.2f} RUB\n\n"
            f"Мы скоро начнем готовить. Ожидайте, пожалуйста!"
        )
        
    return message_text


async def send_new_order_notifications(
    order: Order, 
    bot_instance: Bot, 
    user_id_to_notify: Optional[int],
    staff_group_to_notify: Optional[str]
):
    """Отправляет уведомления о новом заказе пользователю и/или персоналу."""
    if not order:
        return

    # Сообщение для пользователя
    if user_id_to_notify:
        try:
            user_text = format_order_for_message(order, for_staff=False)
            await bot_instance.send_message(chat_id=user_id_to_notify, text=user_text, parse_mode='Markdown')
            logger.info(f"Successfully sent order confirmation to user {user_id_to_notify}")
        except TelegramError as e:
            logger.error(f"Failed to send confirmation to user {user_id_to_notify}: {e}")

    # Сообщение для персонала
    if staff_group_to_notify:
        try:
            staff_text = format_order_for_message(order, for_staff=True)
            await bot_instance.send_message(chat_id=staff_group_to_notify, text=staff_text, parse_mode='Markdown')
            logger.info(f"Successfully sent order notification to staff group {staff_group_to_notify}")
        except TelegramError as e:
            logger.error(f"Failed to send order notification to staff group {staff_group_to_notify}: {e}")


# --- Хендлеры Telegram ---

async def handle_start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработка команды /start."""
    if not update.effective_chat: return
    text = '*Добро пожаловать в EZH Cafe!* 🌿\n\nНажмите кнопку ниже, чтобы посмотреть меню.'
    markup = InlineKeyboardMarkup([[InlineKeyboardButton("Открыть меню", web_app=WebAppInfo(url=APP_URL))]])
    await update.effective_chat.send_message(text, parse_mode='Markdown', reply_markup=markup)

async def handle_pre_checkout_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Отвечает на запрос PreCheckout, подтверждая готовность к оплате."""
    query = update.pre_checkout_query
    if not query: return
    await query.answer(ok=True)
    logger.info(f"Answered pre-checkout query {query.id} successfully.")

async def successful_payment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обрабатывает успешную онлайн-оплату.
    """
    if not update.message or not update.message.successful_payment: return
    
    payment_info = update.message.successful_payment
    order_id_str = payment_info.invoice_payload
    
    logger.info(f"Successful payment received for order_id: {order_id_str}")

    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == uuid.UUID(order_id_str)).first()
        if order:
            order.status = 'paid'
            order.telegram_payment_charge_id = payment_info.telegram_payment_charge_id
            db.commit()
            
            await send_new_order_notifications(
                order=order,
                bot_instance=context.bot,
                user_id_to_notify=update.message.from_user.id,
                staff_group_to_notify=STAFF_GROUP_ID
            )
        else:
            logger.error(f"CRITICAL: Order with ID {order_id_str} not found after successful payment!")
    except Exception as e:
        logger.error(f"Error processing successful payment for order {order_id_str}: {e}")
    finally:
        db.close()


# --- Функции для взаимодействия с FastAPI ---

async def initialize_bot_app() -> Application:
    """Инициализирует приложение Telegram Bot и регистрирует хендлеры."""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not set! Bot will not work.")
        return Application.builder().build()

    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", handle_start_command))
    application.add_handler(PreCheckoutQueryHandler(handle_pre_checkout_query))
    application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))
    
    logger.info("Telegram Bot handlers registered.")
    return application


async def create_invoice_link(prices: list[LabeledPrice], payload: str, bot_instance: Bot) -> Optional[str]:
    """Создает и возвращает ссылку на инвойс для оплаты."""
    if not PAYMENT_PROVIDER_TOKEN:
        logger.error("PAYMENT_PROVIDER_TOKEN is not set! Cannot create invoice link.")
        return None
    
    try:
        link = await bot_instance.create_invoice_link(
            title='Заказ в EZH Cafe',
            description='Ваш заказ почти готов! Осталось только оплатить.',
            payload=payload,
            provider_token=PAYMENT_PROVIDER_TOKEN,
            currency='RUB',
            prices=prices,
        )
        return link
    except TelegramError as e:
        logger.error(f"Failed to create invoice link for payload {payload}: {e}")
        return None


async def setup_webhook(application: Application) -> None:
    """Устанавливает вебхук для бота."""
    if not WEBHOOK_URL or not WEBHOOK_PATH:
        logger.warning("WEBHOOK_URL or WEBHOOK_PATH not set. Webhook not configured.")
        return

    full_webhook_url = f"{WEBHOOK_URL.rstrip('/')}{WEBHOOK_PATH}"
    try:
        await application.bot.set_webhook(url=full_webhook_url)
        logger.info(f"Webhook set to {full_webhook_url}")
    except TelegramError as e:
        logger.error(f"Failed to set webhook: {e}")