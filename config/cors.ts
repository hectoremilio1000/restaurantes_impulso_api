// /config/cors.ts
import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,

  origin: (origin) => {
    if (!origin) return true // curl/postman

    // Dominios del sitio público (con y sin www)
    if (origin === 'https://impulsorestaurantero.com') return true
    if (origin === 'https://www.impulsorestaurantero.com') return true
    // (opcional) cualquier subdominio de impulsorestaurantero.com:
    if (/^https:\/\/([a-z0-9-]+\.)*impulsorestaurantero\.com$/.test(origin)) return true

    // Admin prod + previews de Vercel
    if (origin === 'https://impulso-admin-front-page.vercel.app') return true
    if (/^https:\/\/impulso-admin-front-page-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true
    if (
      /^https:\/\/impulso-admin-front-page-[a-z0-9-]+\.hectoremilio1000-s-team\.vercel\.app$/.test(
        origin
      )
    )
      return true

    // Dev locales
    if (origin === 'http://localhost:3000') return true
    if (origin === 'http://localhost:5173') return true

    return false
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  headers: true,
  exposeHeaders: [],
  credentials: false,
  maxAge: 90,
})
