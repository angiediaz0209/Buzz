import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE is set by the GitHub Pages deploy script ('/artistline/');
// Firebase Hosting serves from the domain root, which is the default.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})