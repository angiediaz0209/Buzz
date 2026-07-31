import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE is set by scripts/build-gh.mjs, which derives it from
// package.json "homepage". Firebase serves from the domain root (the default).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})