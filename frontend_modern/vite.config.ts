// frontend_modern/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // Убедитесь, что build.minify не переопределяет плагин
  build: {
    minify: true,
  },
})