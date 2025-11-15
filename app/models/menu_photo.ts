// app/models/menu_photo.ts
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Restaurant from '#models/restaurant'

export default class MenuPhoto extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare restaurantId: number

  @column()
  declare locale: string

  @column()
  declare section: string

  @column()
  declare url: string

  @column()
  declare altText: string | null

  @column()
  declare sortOrder: number

  @belongsTo(() => Restaurant)
  declare restaurant: BelongsTo<typeof Restaurant>
}
