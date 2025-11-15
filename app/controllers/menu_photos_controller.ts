// app/controllers/menu_photos_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import path from 'node:path'
import Database from '@adonisjs/lucid/services/db'
import MenuPhoto from '#models/menu_photo'
import Restaurant from '#models/restaurant'
import FtpMenuUploader from '#services/ftp_menu_uploader'

export default class MenuPhotosController {
  private async getRestaurantOrFail(slugParam: string) {
    const slug = String(slugParam || '').trim()
    if (!slug) {
      throw new Error('slug_requerido')
    }

    const restaurant = await Restaurant.query().where('slug', slug).where('is_active', true).first()

    if (!restaurant) {
      throw new Error('restaurant_no_encontrado')
    }

    return restaurant
  }

  /** GET /api/restaurants/:slug/menus/:locale/:section/photos */
  public async list({ params, response }: HttpContext) {
    try {
      const restaurant = await this.getRestaurantOrFail(params.slug)
      const locale = String(params.locale || '').trim()
      const section = String(params.section || '').trim()

      if (!locale || !section) {
        return response.badRequest({
          error: 'locale y section son requeridos',
        })
      }

      const photos = await MenuPhoto.query()
        .where('restaurant_id', restaurant.id)
        .andWhere('locale', locale)
        .andWhere('section', section)
        .orderBy('sort_order', 'asc')
        .select(['id', 'url', 'alt_text as altText', 'sort_order as sortOrder'])

      return { ok: true, photos }
    } catch (err: any) {
      if (err.message === 'slug_requerido') {
        return response.badRequest({ error: 'slug requerido' })
      }
      if (err.message === 'restaurant_no_encontrado') {
        return response.notFound({ error: 'Restaurant no encontrado' })
      }
      console.error(err)
      return response.internalServerError({ error: 'Error interno' })
    }
  }

  /** POST /api/restaurants/:slug/menus/:locale/:section/photos */
  public async upload({ params, request, response }: HttpContext) {
    try {
      const restaurant = await this.getRestaurantOrFail(params.slug)
      const locale = String(params.locale || '').trim()
      const section = String(params.section || '').trim()
      const altText = request.input('altText') as string | undefined

      if (!locale || !section) {
        return response.badRequest({
          error: 'locale y section son requeridos',
        })
      }

      const single = request.file('file', {
        size: '20mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })
      const many = request.files('files', {
        size: '60mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })

      const files = [...(single ? [single] : []), ...(many && many.length ? many : [])]

      if (!files.length) {
        return response.badRequest({ error: 'file o files son requeridos' })
      }

      for (const f of files) {
        if (!f.isValid) {
          return response.badRequest({ error: f.errors })
        }
      }

      // último sort_order
      const last = await MenuPhoto.query()
        .where('restaurant_id', restaurant.id)
        .andWhere('locale', locale)
        .andWhere('section', section)
        .orderBy('sort_order', 'desc')
        .first()

      let nextOrder = last ? (last.sortOrder || 0) + 1 : 1

      const tmpDir = app.makePath('tmp')
      const created: Array<{ id: number; url: string; sortOrder: number }> = []

      for (const file of files) {
        await file.move(tmpDir, {
          name: `${Date.now()}_${file.clientName || 'menu'}`,
        })

        const localName = file.fileName!
        const localPath = path.join(tmpDir, localName)

        // sharp + FTPS
        const url = await FtpMenuUploader.upload({
          restaurantSlug: restaurant.slug,
          locale,
          section,
          localPath,
        })

        const photo = await MenuPhoto.create({
          restaurantId: restaurant.id,
          locale,
          section,
          url,
          altText: altText ?? null, // <-- aquí ya no truena
          sortOrder: nextOrder++,
        })

        created.push({ id: photo.id, url: photo.url, sortOrder: photo.sortOrder })
      }

      return { ok: true, count: created.length, photos: created }
    } catch (err: any) {
      if (err.message === 'slug_requerido') {
        return response.badRequest({ error: 'slug requerido' })
      }
      if (err.message === 'restaurant_no_encontrado') {
        return response.notFound({ error: 'Restaurant no encontrado' })
      }
      console.error(err)
      return response.internalServerError({ error: 'Error interno' })
    }
  }

  /** PATCH /api/restaurants/:slug/menus/:locale/:section/photos/order */
  public async reorder({ params, request, response }: HttpContext) {
    try {
      const restaurant = await this.getRestaurantOrFail(params.slug)
      const locale = String(params.locale || '').trim()
      const section = String(params.section || '').trim()
      const ids = request.input('ids') as number[]

      if (!locale || !section || !Array.isArray(ids) || !ids.length) {
        return response.badRequest({
          error: 'locale, section e ids (array) son requeridos',
        })
      }

      const rows = await MenuPhoto.query()
        .where('restaurant_id', restaurant.id)
        .andWhere('locale', locale)
        .andWhere('section', section)

      const valid = new Set(rows.map((r) => r.id))
      for (const pid of ids) {
        if (!valid.has(pid)) {
          return response.badRequest({
            error: `Photo ${pid} no pertenece a ${restaurant.slug}/${locale}/${section}`,
          })
        }
      }

      const cases = ids.map((pid, idx) => `WHEN id = ${pid} THEN ${idx + 1}`).join(' ')

      await Database.rawQuery(
        `UPDATE menu_photos
         SET sort_order = CASE ${cases} ELSE sort_order END
         WHERE restaurant_id = ? AND locale = ? AND section = ? AND id IN (?)`,
        [restaurant.id, locale, section, ids]
      )

      const updated = await MenuPhoto.query()
        .where('restaurant_id', restaurant.id)
        .andWhere('locale', locale)
        .andWhere('section', section)
        .orderBy('sort_order', 'asc')
        .select(['id', 'url', 'alt_text as altText', 'sort_order as sortOrder'])

      return { ok: true, photos: updated }
    } catch (err: any) {
      if (err.message === 'slug_requerido') {
        return response.badRequest({ error: 'slug requerido' })
      }
      if (err.message === 'restaurant_no_encontrado') {
        return response.notFound({ error: 'Restaurant no encontrado' })
      }
      console.error(err)
      return response.internalServerError({ error: 'Error interno' })
    }
  }

  /** DELETE /api/restaurants/:slug/menus/:locale/:section/photos/:photoId */
  public async destroy({ params, response }: HttpContext) {
    try {
      const restaurant = await this.getRestaurantOrFail(params.slug)
      const locale = String(params.locale || '').trim()
      const section = String(params.section || '').trim()
      const photoId = Number(params.photoId)

      if (!locale || !section || !photoId) {
        return response.badRequest({ error: 'Parámetros inválidos' })
      }

      const photo = await MenuPhoto.query()
        .where('id', photoId)
        .andWhere('restaurant_id', restaurant.id)
        .andWhere('locale', locale)
        .andWhere('section', section)
        .first()

      if (!photo) {
        return response.notFound({ error: 'Photo not found' })
      }

      try {
        if (typeof (FtpMenuUploader as any).delete === 'function') {
          await (FtpMenuUploader as any).delete(photo.url)
        }
      } catch {
        // ignorar errores al borrar remoto
      }

      await photo.delete()
      return { ok: true }
    } catch (err: any) {
      if (err.message === 'slug_requerido') {
        return response.badRequest({ error: 'slug requerido' })
      }
      if (err.message === 'restaurant_no_encontrado') {
        return response.notFound({ error: 'Restaurant no encontrado' })
      }
      console.error(err)
      return response.internalServerError({ error: 'Error interno' })
    }
  }
}
