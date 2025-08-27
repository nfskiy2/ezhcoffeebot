# parser.py
import requests
from bs4 import BeautifulSoup
import json
import os
import re

BASE_URL = "https://ezh-coffee.qr-cafe.ru/"
DATA_DIR = "backend/data"
MENU_DIR = os.path.join(DATA_DIR, "menu")

# Создаем директории, если их нет
os.makedirs(MENU_DIR, exist_ok=True)

def get_soup(url):
    """Получает HTML-код страницы и возвращает объект BeautifulSoup."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_categories(soup):
    """Парсит категории с главной страницы."""
    categories = []
    category_links = soup.select("a.category-list__item")
    for link in category_links:
        category_id = link['href'].split('/')[-1]
        category_name = link.select_one(".category-list__item-name").get_text(strip=True)
        
        # Создаем простой backgroundColor на основе хеша имени
        background_color = f"#{hash(category_name) & 0xFFFFFF:06x}"
        
        categories.append({
            "id": category_id,
            "icon": f"icons/icon-{category_id}.svg", # Заглушка для иконки
            "name": category_name,
            "backgroundColor": background_color,
            "url": BASE_URL.strip('/') + link['href']
        })
    return categories

def parse_menu_items(category_url):
    """Парсит товары со страницы категории."""
    soup = get_soup(category_url)
    if not soup:
        return []
        
    items = []
    item_cards = soup.select("a[href^='/product/']") # Найти все <a>, у которых href начинается с /product/
    
    for card in item_cards:
        # Теперь все данные находятся внутри этой ссылки-карточки
        name_tag = card.find(text=True, recursive=False)
        name = name_tag.strip() if name_tag else "Unknown Item"
        
        item_id = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

        description_tag = card.select_one("div.text-xs")
        description = description_tag.get_text(strip=True) if description_tag else ""
        
        price_tag = card.select_one("div.font-bold")
        price_text = price_tag.get_text(strip=True) if price_tag else "0"
        price = int(re.sub(r'[^\d]', '', price_text)) * 100
        
        image_tag = card.select_one("img")
        image_url = image_tag['src'] if image_tag and image_tag.get('src') else ""

        variants = [{
            "id": "normal",
            "name": "Стандарт",
            "cost": str(price),
            "weight": ""
        }]

        items.append({
            "id": item_id,
            "image": BASE_URL.strip('/') + image_url if image_url.startswith('/') else image_url,
            "name": name,
            "description": description,
            "variants": variants
        })
    return items

def main():
    """Основная функция для запуска парсера."""
    print("Starting parser...")
    main_soup = get_soup(BASE_URL)
    
    if not main_soup:
        print("Could not fetch the main page. Exiting.")
        return
        
    # 1. Парсим и сохраняем категории
    print("Parsing categories...")
    categories = parse_categories(main_soup)
    
    # Готовим данные для categories.json (без 'url')
    categories_to_save = [{k: v for k, v in cat.items() if k != 'url'} for cat in categories]
    
    with open(os.path.join(DATA_DIR, "categories.json"), "w", encoding="utf-8") as f:
        json.dump(categories_to_save, f, ensure_ascii=False, indent=4)
    print(f"Saved {len(categories)} categories to categories.json")
    
    # 2. Проходим по каждой категории и парсим товары
    for category in categories:
        print(f"Parsing menu for category: {category['name']}...")
        menu_items = parse_menu_items(category['url'])
        
        if menu_items:
            filename = f"{category['id']}.json"
            filepath = os.path.join(MENU_DIR, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(menu_items, f, ensure_ascii=False, indent=4)
            print(f"Saved {len(menu_items)} items to {filename}")
        else:
            print(f"No items found for category: {category['name']}")
            
    print("Parsing finished successfully!")

if __name__ == "__main__":
    main()