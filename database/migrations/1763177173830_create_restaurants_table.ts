// database/migrations/xxxx_restaurants.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Restaurants extends BaseSchema {
  protected tableName = 'restaurants'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 150).notNullable()
      table.string('slug', 100).notNullable().unique() // ej: 'la-llorona', 'hamburguesas-x'
      table.string('default_locale', 5).notNullable().defaultTo('es')
      table.string('website_url', 255).nullable() // https://lalloronacantina.com, etc.
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
