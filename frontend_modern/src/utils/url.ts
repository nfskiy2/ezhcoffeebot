// frontend_modern/src/utils/url.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Преобразует путь к изображению, полученный от API, в полный URL.
 * @param path Путь к изображению (например, "/media/my-image.jpg" или "http://.../img.png")
 * @returns Полный URL для использования в <img>
 */
export const getImageUrl = (path: string | undefined): string => {
    if (!path) {
        // Возвращаем заглушку, если путь не предоставлен
        return "/icons/icon-transparent.svg";
    }
    // Если это уже полный URL, возвращаем как есть
    if (path.startsWith('http')) {
        return path;
    }
    // Если это относительный путь, добавляем базовый URL API
    return `${API_BASE_URL}${path}`;
};
