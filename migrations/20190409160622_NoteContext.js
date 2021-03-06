exports.up = function (knex, Promise) {
  return knex.schema.createTable('NoteContext', function (table) {
    table.string('id').primary()
    table.string('name')
    table.string('description')
    table.string('type').notNullable().index()
    table.jsonb('json')
    table
      .string('notebookId')
      .references('id')
      .inTable('Notebook')
      .onDelete('CASCADE')
      .index()
    table
      .string('canvasId')
      .references('id')
      .inTable('Canvas')
      .onDelete('CASCADE')
      .index()
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
  return knex.schema.dropTable('NoteContext')
}
