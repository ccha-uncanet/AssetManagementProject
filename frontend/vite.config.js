import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ── เพิ่มส่วนนี้เข้าไปเพื่อให้มือถือในวง Wi-Fi เดียวกันวิ่งเข้ามาหาคอมได้ ──
  server: {
    host: true,  // เปิดสิทธิ์การเข้าถึงผ่าน IP ในวง Network
    port: 5173,  // ล็อกพอร์ตไว้ที่ 5173 (หรือจะเปลี่ยนเป็นพอร์ตอื่นตามใจชอบได้ครับ)
  }
})