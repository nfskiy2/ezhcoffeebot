// frontend_modern/src/utils/timeUtils.ts
import { logger } from './logger';

/**
 * Проверяет, открыто ли кафе в данный момент, основываясь на строке с часами работы.
 * @param openingHoursString Строка с часами работы, например "Mon-Fri: 7AM-7PM, Sat-Sun: 8AM-5PM"
 * @returns { status: 'Открыто' | 'Закрыто', color: 'var(--success-color)' | 'var(--error-color)' }
 */
export function getCafeStatus(openingHoursString?: string): { status: string; color: string } {
    if (!openingHoursString) {
        return { status: 'Закрыто', color: 'var(--error-color)' };
    }

    try {
        const now = new Date();
        // Получаем текущее время в часовом поясе Томска (Asia/Tomsk, UTC+7)
        const tomskTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tomsk' }));
        
        const currentDay = tomskTime.getDay(); // 0 = Вс, 1 = Пн, ..., 6 = Сб
        const currentHour = tomskTime.getHours();
        const currentMinute = tomskTime.getMinutes();

        // Преобразуем 0 (Вс) в 7 для удобства сравнения с диапазонами
        const dayOfWeek = currentDay === 0 ? 7 : currentDay;

        // Разбираем строку с часами работы
        const parts = openingHoursString.split(',').map(p => p.trim());

        for (const part of parts) {
            const [daysPart, timesPart] = part.split(': ').map(p => p.trim());
            
            if (!daysPart || !timesPart) continue;

            const [startDayStr, endDayStr] = daysPart.split('-');
            const [startTimeStr, endTimeStr] = timesPart.split('-');

            // Парсинг дней
            const dayMap: { [key: string]: number } = {
                'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
            };
            const startDay = dayMap[startDayStr];
            const endDay = dayMap[endDayStr] || startDay; // Если день один (e.g., Sat: 9AM-5PM)

            // Проверяем, попадает ли текущий день в диапазон
            if (dayOfWeek >= startDay && dayOfWeek <= endDay) {
                // Парсинг времени
                const parseTime = (timeStr: string) => {
                    const isPM = timeStr.includes('PM');
                    let [hour, minute] = timeStr.replace(/AM|PM/i, '').split(':').map(Number);
                    minute = minute || 0;
                    if (isPM && hour !== 12) {
                        hour += 12;
                    }
                    if (!isPM && hour === 12) { // 12AM это полночь (00:00)
                        hour = 0;
                    }
                    return { hour, minute };
                };

                const { hour: startHour, minute: startMinute } = parseTime(startTimeStr);
                const { hour: endHour, minute: endMinute } = parseTime(endTimeStr);

                const currentTimeInMinutes = currentHour * 60 + currentMinute;
                const startTimeInMinutes = startHour * 60 + startMinute;
                const endTimeInMinutes = endHour * 60 + endMinute;

                // Проверяем, попадает ли текущее время в диапазон
                if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
                    return { status: 'Открыто', color: 'var(--success-color)' };
                }
            }
        }

    } catch (e) {
        logger.error("Failed to parse opening hours string:", e);
        return { status: 'Закрыто', color: 'var(--error-color)' }; // В случае ошибки считаем, что закрыто
    }

    return { status: 'Закрыто', color: 'var(--error-color)' };
}