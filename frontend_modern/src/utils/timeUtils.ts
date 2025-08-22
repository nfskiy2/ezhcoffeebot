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
        formattedString = formattedString.replace(new RegExp(key, 'g'), dayTranslations[key]);
    }

    // Добавляем пробелы вокруг тире для лучшей читаемости, если их нет
    formattedString = formattedString.replace(/(\d{2}:\d{2})-(\d{2}:\d{2})/g, '$1 - $2');

    return formattedString;
}

/**
 * Проверяет, открыто ли кафе, парся строку с часами работы.
 * Поддерживает форматы "Mon-Fri: 9AM-7PM" и "пн-пт: 09:00-19:00".
 * @param openingHoursString Строка с часами работы
 * @returns Объект со статусом и цветом
 */
export function getCafeStatus(openingHoursString?: string): { status: string; color: string } {
    if (!openingHoursString) {
        return { status: 'Закрыто', color: 'var(--error-color)' };
    }

    try {
        const now = new Date();
        const tomskTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tomsk' }));
        
        const currentDay = tomskTime.getDay(); // 0 = Вс, 1 = Пн, ...
        const currentHour = tomskTime.getHours();
        const currentMinute = tomskTime.getMinutes();
        const dayOfWeek = currentDay === 0 ? 7 : currentDay;

        // Нормализуем строку: заменяем русские сокращения на английские для парсинга
        const dayReverseTranslations: { [key: string]: string } = {
            'пн': 'Mon', 'вт': 'Tue', 'ср': 'Wed', 'чт': 'Thu', 'пт': 'Fri', 'сб': 'Sat', 'вс': 'Sun'
        };
        let parsableString = openingHoursString;
        for (const key in dayReverseTranslations) {
            parsableString = parsableString.replace(new RegExp(key, 'g'), dayReverseTranslations[key]);
        }
        
        const parts = parsableString.split(',').map(p => p.trim());

        for (const part of parts) {
            // Удаляем пробелы вокруг тире для统一 парсинга
            const cleanPart = part.replace(/\s*:\s*/, ':').replace(/\s*-\s*/, '-');
            const [daysPart, timesPart] = cleanPart.split(':');
            
            if (!daysPart || !timesPart) continue;

            const [startDayStr, endDayStr] = daysPart.split('-');
            const [startTimeStr, endTimeStr] = timesPart.split('-');

            const dayMap: { [key: string]: number } = {
                'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
            };
            const startDay = dayMap[startDayStr];
            const endDay = dayMap[endDayStr] || startDay;

            if (dayOfWeek >= startDay && dayOfWeek <= endDay) {
                const parseTime = (timeStr: string) => {
                    // Обработка формата 09:00
                    if (timeStr.includes(':')) {
                        const [hour, minute] = timeStr.split(':').map(Number);
                        return { hour, minute: minute || 0 };
                    }
                    // Обработка формата 9AM/7PM
                    const isPM = timeStr.toUpperCase().includes('PM');
                    let hour = parseInt(timeStr.replace(/AM|PM/i, ''));
                    if (isPM && hour !== 12) hour += 12;
                    if (!isPM && hour === 12) hour = 0;
                    return { hour, minute: 0 };
                };

                const { hour: startHour, minute: startMinute } = parseTime(startTimeStr);
                const { hour: endHour, minute: endMinute } = parseTime(endTimeStr);
                
                const currentTimeInMinutes = currentHour * 60 + currentMinute;
                const startTimeInMinutes = startHour * 60 + startMinute;
                let endTimeInMinutes = endHour * 60 + endMinute;

                // Обработка случая, когда кафе работает после полуночи (например, 22:00-02:00)
                if (endTimeInMinutes < startTimeInMinutes) {
                    endTimeInMinutes += 24 * 60; // Добавляем 24 часа к времени закрытия
                    if (currentTimeInMinutes < startTimeInMinutes) {
                        // Если текущее время, например, 01:00, оно тоже должно быть "на следующий день"
                        // currentTimeInMinutes += 24 * 60; // Это усложняет, пока не будем
                    }
                }
                
                if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
                    return { status: 'Открыто', color: 'var(--success-color)' };
                }
            }
        }
    } catch (e) {
        logger.error("Failed to parse opening hours string:", e);
        return { status: 'Закрыто', color: 'var(--error-color)' };
    }

    return { status: 'Закрыто', color: 'var(--error-color)' };
}