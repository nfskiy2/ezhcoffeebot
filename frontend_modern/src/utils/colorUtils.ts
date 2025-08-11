// frontend_modern/src/utils/colorUtils.ts

/**
 * Определяет, какой цвет текста (черный или белый) будет лучше контрастировать с данным цветом фона.
 * Использует формулу для расчета яркости (luminance) цвета.
 *
 * @param hexOrRgbColorString Цвет фона в формате HEX (#RRGGBB) или RGB (rgb(r, g, b)).
 * @returns 'black' или 'white'.
 */
export function getContrastingTextColor(hexOrRgbColorString: string): 'black' | 'white' {
    let r: number, g: number, b: number;

    // Парсим HEX
    if (hexOrRgbColorString.startsWith('#')) {
        const hex = hexOrRgbColorString.slice(1);
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    // Парсим RGB
    else if (hexOrRgbColorString.startsWith('rgb')) {
        const parts = hexOrRgbColorString.match(/\d+/g);
        if (parts && parts.length >= 3) {
            r = parseInt(parts[0]);
            g = parseInt(parts[1]);
            b = parseInt(parts[2]);
        } else {
            // Возвращаем дефолт, если не удалось распарсить
            return 'black';
        }
    } else {
        // Неизвестный формат цвета, возвращаем дефолт
        return 'black';
    }

    // Расчет яркости (luminance) по формуле для контраста
    // (популярный метод: Y = (0.299*R + 0.587*G + 0.114*B))
    // Для более точного восприятия яркости:
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Выбираем черный или белый цвет текста на основе порога яркости
    // Порог 0.5 - это общий ориентир, можно подстроить
    return luminance > 0.5 ? 'black' : 'white';
}