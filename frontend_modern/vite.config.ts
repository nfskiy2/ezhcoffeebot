// frontend_modern/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import removeConsole from 'vite-plugin-remove-console'; // <--- ИМПОРТ ПЛАГИНА

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    removeConsole({
      // Опции плагина (необязательно, по умолчанию удаляет log, warn, error, info и т.д.)
      // exclude: ['error'], // Пример: не удалять console.error
      // includes: ['log', 'warn'], // Пример: удалять только log и warn
    }),
  ],
  // Убедитесь, что build.minify не переопределяет плагин
  build: {
    minify: true, // Использовать минификацию по умолчанию (terser или esbuild)
    // Убедитесь, что здесь нет конфликтующих настроек terserOptions или esbuild
    // Если есть проблемы, можно попробовать 'terser' и убедиться, что он используется
    // minify: 'terser',
    // terserOptions: {
    //   compress: {
    //     // Эти опции могут конфликтовать с плагином, лучше удалить их, если плагин работает
    //     // drop_console: true,
    //     // drop_debugger: true,
    //   },
    // },
  },
})