exports.up = function (knex, Promise) {
  return knex.schema.createTable('Publication', function (table) {
    table.string('id').primary()
    table.text('abstract')
    table.string('name').notNullable()
    table.string('type').notNullable()
    table.timestamp('datePublished')
    table.integer('numberOfPages')
    table.string('encodingFormat')
    table.jsonb('metadata')
    table.jsonb('readingOrder').notNullable()
    table.jsonb('resources')
    table.jsonb('links')
    table.jsonb('json')
    table
      .string('readerId')
      .references('id')
      .inTable('Reader')
      .notNullable()
      .onDelete('CASCADE')
      .index()
    table
      .timestamp('published')
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('updated')
      .defaultTo(knex.fn.now())
      .notNullable()
    table
      .timestamp('deleted')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTable('Publication')
}
