// database/migrations/xxxx_menu_photos.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MenuPhotos extends BaseSchema {
  protected tableName = 'menu_photos'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('restaurant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('restaurants')
        .onDelete('CASCADE')

      table.string('locale', 5).notNullable() // 'es' | 'en'
      table.string('section', 50).notNullable() // 'alimentos', 'bebidas', etc.

      table.text('url').notNullable()
      table.string('alt_text', 255).nullable()

      table.integer('sort_order').notNullable().defaultTo(0)

      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())

      table.index(['restaurant_id', 'locale', 'section'], 'idx_menu_rest_locale_section')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
