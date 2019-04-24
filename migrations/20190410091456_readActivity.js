exports.up = function (knex, Promise) {
  return knex.schema.createTable('readActivity', function (table) {
    table.string('id').primary()
    table.json('selector')
    table.jsonb('json')
    table
      .string('readerId')
      .references('id')
      .inTable('Reader')
      .notNullable()
      .onDelete('CASCADE')
      .index()
    table
      .string('publicationId')
      .references('id')
      .inTable('Publication')
      .notNullable()
      .onDelete('CASCADE')
      .index()
    table
      .timestamp('published')
      .defaultTo(knex.fn.now())
      .notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTable('readActivity')
}
