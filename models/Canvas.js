// @flow
'use strict'
const Model = require('objection').Model
const { BaseModel } = require('./BaseModel.js')
const _ = require('lodash')
const { urlToId } = require('../utils/utils')
const crypto = require('crypto')
const debug = require('debug')('ink:models:Canvas')

class Canvas extends BaseModel {
  static get tableName () /*: string */ {
    return 'Canvas'
  }
  get path () /*: string */ {
    return 'canvas'
  }
  static get jsonSchema () /*: any */ {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        settings: { type: ['object', 'null'] },
        json: { type: ['object', 'null'] },
        readerId: { type: 'string' },
        notebookId: { type: ['string', 'null'] },
        published: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' }
      },
      required: ['readerId', 'notebookId']
    }
  }
  static get relationMappings () /*: any */ {
    const { Reader } = require('./Reader')
    const { NoteContext } = require('./NoteContext')

    return {
      reader: {
        relation: Model.BelongsToOneRelation,
        modelClass: Reader,
        join: {
          from: 'Canvas.readerId',
          to: 'Reader.id'
        }
      },
      noteContexts: {
        relation: Model.HasManyRelation,
        modelClass: NoteContext,
        join: {
          from: 'Canvas.id',
          to: 'NoteContext.canvasId'
        }
      }
    }
  }

  static async createCanvas (
    object /*: any */,
    readerId /*: string */
  ) /*: Promise<any> */ {
    debug('**createCanvas**')
    debug('incoming canvas object: ', object)
    debug('readerId', readerId)
    const props = _.pick(object, [
      'name',
      'description',
      'json',
      'settings',
      'notebookId'
    ])
    props.readerId = readerId
    props.id = `${urlToId(readerId)}-${crypto.randomBytes(5).toString('hex')}`
    debug('canvas to add to database: ', props)
    return await Canvas.query().insertAndFetch(props)
  }

  static async byId (id /*: string */) /*: Promise<any> */ {
    debug('**byId**')
    debug('id: ', id)
    const canvas = await Canvas.query()
      .findById(id)
      .withGraphFetched('[noteContexts(notDeleted)]')
      .modifiers({
        notDeleted (builder) {
          builder.whereNull('deleted')
        }
      })
    debug('canvas retrieved: ', canvas)
    return canvas
  }

  static async update (object /*: any */) /*: Promise<any> */ {
    debug('**update**')
    debug('incoming object: ', object)
    const props = _.pick(object, [
      'readerId',
      'name',
      'description',
      'json',
      'settings',
      'notebookId'
    ])
    debug('props passed to database: ', props)
    return await Canvas.query().updateAndFetchById(object.id, props)
  }

  static async delete (id /*: string */) /*: Promise<any> */ {
    debug('**delete**')
    debug('id: ', id)
    return await Canvas.query().deleteById(id)
  }

  $formatJson (json /*: any */) /*: any */ {
    json = super.$formatJson(json)
    json.shortId = urlToId(json.id)
    json = _.omitBy(json, _.isNil)

    return json
  }
}

module.exports = { Canvas }