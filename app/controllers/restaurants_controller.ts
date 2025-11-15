// app/controllers/restaurants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Restaurant from '#models/restaurant'

export default class RestaurantsController {
  public async index({}: HttpContext) {
    // 👇 SIN .select, así serializa todas las columnas mapeadas en el modelo
    const restaurants = await Restaurant.query().orderBy('name', 'asc')

    return { ok: true, restaurants }
  }

  public async show({ params, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    if (!slug) return response.badRequest({ error: 'Slug requerido' })

    // 👇 también quitamos el filtro de is_active aquí
    const restaurant = await Restaurant.query().where('slug', slug).first()

    if (!restaurant) return response.notFound({ error: 'Restaurant not found' })

    return { ok: true, restaurant }
  }

  public async store({ request, response }: HttpContext) {
    const name = String(request.input('name') || '').trim()
    const slug = String(request.input('slug') || '').trim()
    const defaultLocale = String(request.input('defaultLocale') || 'es').trim()
    const websiteUrl = request.input('websiteUrl') as string | undefined
    const isActive =
      request.input('isActive') === undefined ? true : Boolean(request.input('isActive'))

    if (!name || !slug) {
      return response.badRequest({
        error: 'name y slug son requeridos',
      })
    }

    const exists = await Restaurant.query().where('slug', slug).first()
    if (exists) {
      return response.conflict({
        error: `Ya existe un restaurante con slug "${slug}"`,
      })
    }

    const restaurant = await Restaurant.create({
      name,
      slug,
      defaultLocale,
      websiteUrl: websiteUrl || null,
      isActive,
    })

    return response.created({ ok: true, restaurant })
  }

  public async update({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!id) return response.badRequest({ error: 'Id requerido' })

    const restaurant = await Restaurant.find(id)
    if (!restaurant) return response.notFound({ error: 'Restaurant not found' })

    const name = String(request.input('name') || restaurant.name).trim()
    const slug = String(request.input('slug') || restaurant.slug).trim()
    const defaultLocale = String(
      request.input('defaultLocale') || restaurant.defaultLocale || 'es'
    ).trim()
    const websiteUrl = request.input('websiteUrl') as string | undefined
    const isActive =
      request.input('isActive') === undefined
        ? restaurant.isActive
        : Boolean(request.input('isActive'))

    if (!name || !slug) {
      return response.badRequest({
        error: 'name y slug son requeridos',
      })
    }

    // Verificar slug único si cambió
    if (slug !== restaurant.slug) {
      const exists = await Restaurant.query().where('slug', slug).first()
      if (exists) {
        return response.conflict({
          error: `Ya existe un restaurante con slug "${slug}"`,
        })
      }
    }

    restaurant.merge({
      name,
      slug,
      defaultLocale,
      websiteUrl: websiteUrl || null,
      isActive,
    })
    await restaurant.save()

    return { ok: true, restaurant }
  }
}
