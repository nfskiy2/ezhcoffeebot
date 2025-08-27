import logging
import os
import re
import asyncio
from .database import SessionLocal
from .models import Order
import uuid

# Импорты из python-telegram-bot
from telegram import (
    Update, WebAppInfo, Message, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Bot
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, filters, PreCheckoutQueryHandler, CallbackContext
)
from telegram.error import TelegramError # Для обработки ошибок Telegram API

# Получаем переменные окружения
BOT_TOKEN = os.getenv('BOT_TOKEN')
PAYMENT_PROVIDER_TOKEN = os.getenv('PAYMENT_PROVIDER_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
WEBHOOK_PATH = '/bot'
APP_URL = os.getenv('APP_URL')
# НОВАЯ ПЕРЕМЕННАЯ: ID группы для уведомлений
STAFF_GROUP_ID = os.getenv('STAFF_GROUP_ID')

# Настройка логирования
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация Application и регистрация хендлеров
# Эта функция создает и возвращает Application, но не управляет его жизненным циклом (polling/webhook)
async def initialize_bot_app() -> Application: # Переименовано в initialize_bot_app
    """Инициализирует приложение Telegram Bot и регистрирует хендлеры."""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not set! Bot will not work.")
        # Возвращаем Application без токена; большинство API-вызовов упадут.
        return Application.builder().build()

    application_instance = Application.builder().token(BOT_TOKEN).build()

    # Регистрация хендлеров. Они используют context.bot
    application_instance.add_handler(MessageHandler(filters.SuccessfulPayment(), handle_successful_payment))
    application_instance.add_handler(PreCheckoutQueryHandler(handle_pre_checkout_query))
    application_instance.add_handler(CommandHandler("start", handle_start_command))
    application_instance.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_all_messages))

    logger.info("Telegram Bot handlers registered on Application object.")
    return application_instance

# УДАЛЕНЫ ГЛОБАЛЬНЫЕ application и bot_instance из этого файла.
# Они будут инициализированы и управляться в main.py.


# --- Асинхронные функции-хендлеры бота ---
# Они принимают `update` и `context`. `context.bot` предоставляет доступ к экземпляру Bot.
async def handle_pre_checkout_query(update: Update, context: CallbackContext) -> None:
    """Обработка Pre-Checkout запроса."""
    if not update.pre_checkout_query:
         logger.warning("Received pre-checkout query update with missing data.")
         return

    query_id = update.pre_checkout_query.id
    user_id = update.pre_checkout_query.from_user.id
    logger.info(f"Received pre-checkout query (ID: {query_id}) from user_id: {user_id}")

    try:
        start_time = asyncio.get_event_loop().time()
        await update.pre_checkout_query.answer(ok=True)
        end_time = asyncio.get_event_loop().time()
        logger.info(f"Answered pre-checkout query (ID: {query_id}) successfully in {end_time - start_time:.3f} seconds.")
    except TelegramError as e:
        logger.error(f"Failed to answer pre-checkout query (ID: {query_id}): {e}")
    except Exception as e:
        logger.error(f"Unexpected error answering pre-checkout query (ID: {query_id}): {e}")

async def handle_successful_payment(update: Update, context: CallbackContext) -> None:
    """Обработка успешного платежа."""
    if not update.message or not update.message.successful_payment or not update.effective_chat:
        logger.warning("Received successful payment update with missing data.")
        return

    logger.info(f"Received successful payment from chat_id: {update.effective_chat.id}")
    user_name = update.message.successful_payment.order_info.name or "Friend"
    text = f'Спасибо за ваш заказ, *{user_name}*! Это не настоящее кафе, так что ваша карта не была списана.\n\nХорошего дня 🙂'
    try:
        await context.bot.send_message( # Используем context.bot
            chat_id=update.effective_chat.id,
            text=text,
            parse_mode='Markdown'
        )
    except TelegramError as e:
        logger.error(f"Failed to send success message: {e}")


async def handle_successful_payment(update: Update, context: CallbackContext) -> None:
    """Обработка успешного платежа."""
    if not update.message or not update.message.successful_payment or not update.effective_chat:
        logger.warning("Received successful payment update with missing data.")
        return

    payment = update.message.successful_payment
    chat_id = update.effective_chat.id
    user_name = payment.order_info.name or "Friend"

    order_id_str = payment.invoice_payload # <--- ПОЛУЧАЕМ ID НАШЕГО ЗАКАЗА
    
    # 1. Обновляем статус заказа в БД и получаем детали
    order_details = None
    with SessionLocal() as db:
        try:
            order_id = uuid.UUID(order_id_str)
            order_in_db = db.query(Order).filter(Order.id == order_id).first()
            if order_in_db:
                order_in_db.status = 'paid'
                order_in_db.telegram_payment_charge_id = payment.telegram_payment_charge_id
                db.commit()
                db.refresh(order_in_db)
                order_details = order_in_db
                logger.info(f"Order {order_id} status updated to 'paid'.")
            else:
                logger.error(f"Order with ID {order_id} not found in DB after successful payment!")
        except Exception as e:
            logger.error(f"Error updating order status in DB: {e}")

    # 2. Формируем и отправляем уведомление в группу сотрудников
    if STAFF_GROUP_ID and order_details:
        try:
            # Собираем информацию о заказе
            order_info = payment.order_info
            shipping_address = order_info.shipping_address
            
            # Форматируем список товаров
            items_text_list = []
            for item in order_details.cart_items:
                item_name = item.get('cafeItem', {}).get('name', 'Unknown Item')
                variant_name = item.get('variant', {}).get('name', 'Standard')
                quantity = item.get('quantity', 0)
                items_text_list.append(f"  - {item_name} ({variant_name}) x {quantity}")
            
            items_text = "\n".join(items_text_list)

            # Форматируем красивое сообщение для сотрудников
            staff_notification_text = (
                f"🎉 *Новый заказ!* `#{str(order_details.id)[:8]}` 🎉\n\n"
                f"🛍️ *Состав заказа:*\n{items_text}\n\n"
                f"💰 *Сумма:* {payment.total_amount / 100} {payment.currency}\n"
                f"👤 *Клиент:* {order_info.name or 'Не указано'}\n"
                f"📞 *Телефон:* {order_info.phone_number or 'Не указан'}\n\n"
                f"📍 *Адрес доставки:*\n"
                f"   `{shipping_address.country_code}, {shipping_address.state}`\n"
                f"   `{shipping_address.city}, {shipping_address.street_line1}`\n"
                f"   `{shipping_address.street_line2 or ''}`\n"
                f"   `Почтовый индекс: {shipping_address.post_code}`\n\n"
                f"Проверьте детали в вашей системе."
            )

            await context.bot.send_message(
                chat_id=STAFF_GROUP_ID,
                text=staff_notification_text,
                parse_mode='Markdown'
            )
            logger.info(f"Successfully sent detailed order notification to staff group {STAFF_GROUP_ID}")
        except TelegramError as e:
            logger.error(f"Failed to send order notification to staff group {STAFF_GROUP_ID}: {e}")
        except Exception as e:
            logger.error(f"An unexpected error occurred while sending staff notification: {e}")
    else:
        logger.warning("STAFF_GROUP_ID is not set. Skipping notification to staff.")



async def handle_start_command(update: Update, context: CallbackContext) -> None:
    """Обработка команды /start."""
    if not update.effective_chat:
        logger.warning("Received start command update with missing chat data.")
        return

    logger.info(f"Received start command from chat_id: {update.effective_chat.id}")
    # Передаем context.bot явно в send_actionable_message
    await send_actionable_message(
        chat_id=update.effective_chat.id,
        text='*Добро пожаловать в Laurel Cafe!* 🌿\n\nПора заказать что-нибудь вкусненькое 😋 Нажмите кнопку ниже, чтобы начать.',
        bot_instance=context.bot # Передаем Bot
    )


async def handle_all_messages(update: Update, context: CallbackContext) -> None:
    """Fallback хендлер для всех остальных текстовых сообщений."""
    if not update.effective_chat or not update.message or not update.message.text:
        logger.warning("Received text message update with missing data.")
        return

    logger.info(f"Received text message from chat_id: {update.effective_chat.id}: {update.message.text}")
    # Передаем context.bot явно в send_actionable_message
    await send_actionable_message(
        chat_id=update.effective_chat.id,
        text="Честно говоря, я не знаю, как отвечать на сообщения. Но могу предложить вам ознакомиться с нашим меню. Уверен, вы найдете что-то по вкусу! 😉",
        bot_instance=context.bot # Передаем Bot
    )


# --- Вспомогательные асинхронные функции бота ---
# Теперь принимает bot_instance явно
async def send_actionable_message(chat_id: int, text: str, bot_instance: Bot) -> None:
    """Отправка сообщения с кнопкой Mini App."""
    if bot_instance is None:
        logger.error("Bot instance is not provided to send_actionable_message!")
        return

    if not APP_URL:
        logger.warning("APP_URL is not set. Cannot send actionable message with Mini App button.")
        try:
             await bot_instance.send_message(chat_id=chat_id, text=text, parse_mode='Markdown')
        except TelegramError as e:
            logger.error(f"Failed to send basic message: {e}")
        return

    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("Исследовать меню", web_app=WebAppInfo(url=APP_URL))]
    ])
    try:
        await bot_instance.send_message(
            chat_id=chat_id,
            text=text,
            parse_mode='Markdown',
            reply_markup=markup
        )
    except TelegramError as e:
        logger.error(f"Failed to send actionable message: {e}")


# --- Синхронная функция для создания ссылки на инвойс (вызывается из FastAPI) ---
# Теперь принимает bot_instance явно
async def create_invoice_link(prices: list[LabeledPrice], payload: str, bot_instance: Bot) -> str | None:
    """Создание ссылки на инвойс для оплаты. Вызывается из FastAPI."""
    if bot_instance is None:
        logger.error("Bot instance is not provided to create_invoice_link! Cannot create invoice link.")
        return None

    if not PAYMENT_PROVIDER_TOKEN:
         logger.error("PAYMENT_PROVIDER_TOKEN is not set! Cannot create invoice link.")
         return None
    
    logger.info(f"Attempting to create invoice link with payload: {payload}")
    logger.info(f"PAYMENT_PROVIDER_TOKEN being used: {PAYMENT_PROVIDER_TOKEN}")
    logger.info(f"Prices being sent: {[p.to_dict() for p in prices]}")

    try:
        # ВНИМАНИЕ: create_invoice_link теперь асинхронный
        return await bot_instance.create_invoice_link(
            title='Заказ в EZH Cafe', # Можно сделать более информативным
            description='Отличный выбор! Осталось только оплатить.',
            payload=payload,
            provider_token=PAYMENT_PROVIDER_TOKEN,
            currency='RUB',
            prices=prices,
            need_name=False,
            need_phone_number=False,
            need_shipping_address=False, 
            currency='RUB',
            prices=prices,
            need_name=True,
            need_phone_number=True,
            need_shipping_address=True,
        )
    except TelegramError as e:
        logger.error(f"Failed to create invoice link: {e}")
        return None


# --- Функция для установки вебхука (вызывается из FastAPI startup event) ---
# Теперь принимает application_instance явно
async def setup_webhook(application_instance: Application) -> None:
    """Устанавливает вебхук бота, если WEBHOOK_URL и WEBHOOK_PATH заданы."""
    if application_instance is None:
        logger.error("Bot application is not provided to setup_webhook! Cannot set webhook.")
        return

    if not WEBHOOK_URL or not WEBHOOK_PATH:
        logger.warning("WEBHOOK_URL or WEBHOOK_PATH not set. Webhook not configured.")
        return

    full_webhook_url = WEBHOOK_URL + WEBHOOK_PATH
    try:
        await application_instance.bot.set_webhook(url=full_webhook_url)
        logger.info(f"Webhook set to {full_webhook_url}")
    except TelegramError as e:
        logger.error(f"Failed to set webhook to {full_webhook_url}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred while setting webhook: {e}")