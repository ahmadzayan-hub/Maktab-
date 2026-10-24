import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // PostCSS بيدوّر على إعداد في المجلدات الأعلى، فكان بيلقط postcss.config.js
  // بتاع تطبيق Lahza في جذر الريبو (tailwind) ويفشل. إعداد فاضي صريح بيوقف
  // البحث لفوق — الستايل هنا CSS عادي من غير أي معالجة.
  css: { postcss: { plugins: [] } },
  build: { target: 'es2020', outDir: 'dist' },
});
