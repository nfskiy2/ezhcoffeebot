// frontend_modern/src/utils/timeUtils.ts
import { logger } from './logger';

/**
 * Форматирует строку с часами работы в русский формат с сокращениями.
 * @param openingHoursString Строка типа "Mon-Fri: 09:00-20:30, Sat-Sun: 10:00-19:00"
 * @returns Отформатированная строка типа "пн-пт: 09:00 - 20:30, сб-вс: 10:00 - 19:00"
 */
export function formatOpeningHours(openingHoursString?: string): string {
    if (!openingHoursString) {
        return "Часы работы не указаны";
    }
    
    // Словарь для перевода дней недели
    const dayTranslations: { [key: string]: string } = {
        'Mon': 'пн', 'Tue': 'вт', 'Wed': 'ср', 'Thu': 'чт', 'Fri': 'пт', 'Sat': 'сб', 'Sun': 'вс'
    };

    // Заменяем английские сокращения на русские
    let formattedString = openingHoursString;
    for (const key in dayTranslations) {
        // Используем RegExp с флагом 'g' для замены всех вхождений
        formattedString = formattedString.replace(new RegExp(key, 'gi'), dayTranslations[key]);
    }

    // Добавляем пробелы вокруг тире для лучшей читаемости, если их нет
    formattedString = formattedString.replace(/(\d{2}:\d{2})-(\d{2}:\d{2})/g, '$1 - $2');

    return formattedString.replace(/-/g, ' - ');
}

/**
 * Проверяет, открыто ли кафе, парся строку с часами работы.
 * Поддерживает форматы "Mon-Fri: 9AM-7PM" и "пн-пт: 09:00-19:00".
 * @param openingHoursString Строка с часами работы
 * @returns Объект со статусом и цветом
 */
export function getCafeStatus(openingHoursString?: string): { status: string; color: string } {
    const defaultClosed = { status: 'Закрыто', color: 'var(--error-color)' };
    if (!openingHoursString) return defaultClosed;


    try {
        const now = new Date();
        const tomskTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tomsk' }));
        
        const currentDay = tomskTime.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        const currentHour = tomskTime.getHours();
        const currentMinute = tomskTime.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const dayOfWeek = currentDay === 0 ? 7 : currentDay;

        logger.log(`Checking status for: ${tomskTime.toLocaleString()}. Day: ${dayOfWeek}, Time: ${currentHour}:${currentMinute}`);


        // Нормализуем строку: заменяем русские сокращения на английские для парсинга
        const dayMap: { [key: string]: number } = {
            'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6, 'вс': 7,
            'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 7
        };

        const schedules = openingHoursString.split(',').map(s => s.trim());

        for (const schedule of schedules) {
            const match = schedule.match(/([а-яa-z]+)(?:-([а-яa-z]+))?:\s*(\d{2}:\d{2})-(\d{2}:\d{2})/i);
            if (!match) continue;

            const [, startDayStr, endDayStr, startTimeStr, endTimeStr] = match;
            const startDay = dayMap[startDayStr.toLowerCase()];
            const endDay = endDayStr ? dayMap[endDayStr.toLowerCase()] : startDay;

            if (!startDay || (endDayStr && !endDay)) continue;

            if (dayOfWeek >= startDay && dayOfWeek <= endDay) {
                const [startHour, startMinute] = startTimeStr.split(':').map(Number);
                const [endHour, endMinute] = endTimeStr.split(':').map(Number);
                
                const startTimeInMinutes = startHour * 60 + startMinute;
                const endTimeInMinutes = endHour * 60 + endMinute;

                if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
                    return { status: 'Открыто', color: 'var(--success-color)' };
                }
            }
        }
    } catch (e) {
        logger.error("Failed to parse opening hours string:", e);
        return defaultClosed;
    }

    return defaultClosed;
}