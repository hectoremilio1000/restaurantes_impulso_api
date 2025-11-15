// app/models/restaurant.ts
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MenuPhoto from '#models/menu_photo'

export default class Restaurant extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare defaultLocale: string

  @column()
  declare websiteUrl?: string | null

  @column()
  declare isActive: boolean

  @hasMany(() => MenuPhoto)
  declare menuPhotos: HasMany<typeof MenuPhoto>
}
