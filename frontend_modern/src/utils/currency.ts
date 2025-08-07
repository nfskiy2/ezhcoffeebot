// frontend_modern/src/utils/currency.ts
/**
 * Create display (user-friendly) string cost for the cost in minimal currency unit.
 * For this app calculations are in USD.
 * Example: 1000 => $10.00
 * @param costInMinimalUnit Cost in minimal unit (cents).
 * @returns Display cost string that may be used in the UI.
 */
export function toDisplayCost(costInMinimalUnit: number): string {
    // Убедимся, что входное значение - число
    const numericCost = typeof costInMinimalUnit === 'number' ? costInMinimalUnit : parseInt(costInMinimalUnit, 10);
    if (isNaN(numericCost)) {
        return '$0.00'; // Возвращаем дефолтное значение при некорректном входе
    }
    // Форматируем как доллары с двумя знаками после запятой
    return `\$${(numericCost / 100.0).toFixed(2)}`;
}

// Пример использования в коде:
// const priceInCents = 1234;
// const displayPrice = toDisplayCost(priceInCents); // Выведет "$12.34"