import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',           // ← FORCE VITE TO USE ROOT index.html
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html' // ← EXPLICIT ENTRY
    }
  }
})
