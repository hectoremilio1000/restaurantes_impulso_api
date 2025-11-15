/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| Aquí definimos las rutas HTTP de este microservicio de restaurantes +
| fotos de menús.
|
*/

import router from '@adonisjs/core/services/router'
import Database from '@adonisjs/lucid/services/db'

const RestaurantsController = () => import('#controllers/restaurants_controller')
const MenuPhotosController = () => import('#controllers/menu_photos_controller')

// Ruta raíz simple para probar que el servicio responde
router.get('/', async () => {
  return {
    name: 'restaurante_pagina',
    status: 'ok',
  }
})

// Health check de base de datos
router.get('/health-db', async () => {
  await Database.rawQuery('SELECT 1')
  return { db: 'ok' }
})

/*
|--------------------------------------------------------------------------
| Rutas API
|--------------------------------------------------------------------------
| Prefijo /api para todo lo que consuma tu frontend (Next.js, Vite, etc.)
*/
router
  .group(() => {
    // Pequeño hello dentro del namespace /api
    router.get('/', async () => ({ hello: 'world' }))

    // =======================
    // RESTAURANTES
    // =======================

    // GET /api/restaurants → lista de restaurantes activos
    router.get('/restaurants', [RestaurantsController, 'index'])

    // GET /api/restaurants/:slug → detalle por slug
    router.get('/restaurants/:slug', [RestaurantsController, 'show'])

    router.post('/restaurants', [RestaurantsController, 'store'])
    router.patch('/restaurants/:id', [RestaurantsController, 'update'])

    // =======================
    // MENÚS (FOTOS)
    // =======================

    // GET  /api/restaurants/:slug/menus/:locale/:section/photos
    router.get('/restaurants/:slug/menus/:locale/:section/photos', [MenuPhotosController, 'list'])

    // POST /api/restaurants/:slug/menus/:locale/:section/photos
    // Body: form-data con file o files[], altText opcional
    router.post('/restaurants/:slug/menus/:locale/:section/photos', [
      MenuPhotosController,
      'upload',
    ])

    // PATCH /api/restaurants/:slug/menus/:locale/:section/photos/order
    // Body: { ids: number[] } en el nuevo orden deseado
    router.patch('/restaurants/:slug/menus/:locale/:section/photos/order', [
      MenuPhotosController,
      'reorder',
    ])

    // DELETE /api/restaurants/:slug/menus/:locale/:section/photos/:photoId
    router.delete('/restaurants/:slug/menus/:locale/:section/photos/:photoId', [
      MenuPhotosController,
      'destroy',
    ])
  })
  .prefix('/api')
