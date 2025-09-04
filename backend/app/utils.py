# backend/app/utils.py
import os
import logging
from typing import Optional

# Выносим общую логику сюда
API_URL = os.getenv("API_URL", "")
logger = logging.getLogger(__name__)

def create_full_image_url(path: Optional[str]) -> Optional[str]:
    """Преобразует относительный путь к медиа-файлу в абсолютный URL."""
    if not path or path.startswith('http'):
        return path
    
    if path.startswith('/media/'):
        if API_URL:
            return f"{API_URL.rstrip('/')}{path}"
        else:
            # Логируем предупреждение, если API_URL не установлен
            logger.warning(f"API_URL is not set. Returning relative path for media file: {path}")
    
    # Возвращаем путь как есть для всего остального (например, /icons/... или если API_URL не задан)
    return path