// frontend_modern/src/utils/currency.ts
/**
 * Преобразует стоимость в минимальных единицах (копейках) в строку для отображения.
 * @param costInMinimalUnit Стоимость в копейках.
 * @returns Строка в формате "123.45 ₽".
 */
export function toDisplayCost(costInMinimalUnit: number): string {
    const numericCost = typeof costInMinimalUnit === 'number' ? costInMinimalUnit : parseInt(costInMinimalUnit, 10);
    if (isNaN(numericCost)) {
        return '0.00 ₽';
    }
    return `${(numericCost / 100.0).toFixed(2)} ₽`;
}