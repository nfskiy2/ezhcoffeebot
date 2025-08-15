// frontend_modern/src/utils/logger.ts

// Vite автоматически предоставляет import.meta.env.PROD
// true в продакшен-сборке (npm run build)
// false в девелоперской сборке (npm run dev)
const isProduction = import.meta.env.PROD;

export const logger = {
  log: (...args: any[]): void => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  warn: (...args: any[]): void => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  error: (...args: any[]): void => {
    // Ошибки обычно логируются всегда, даже в продакшене,
    // так как они сигнализируют о критических проблемах.
    console.error(...args);
  },
  // Добавьте другие методы console.* по необходимости
  // info: (...args: any[]): void => {
  //   if (!isProduction) {
  //     console.info(...args);
  //   }
  // },
};