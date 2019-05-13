'use strict'
const Model = require('objection').Model
const { BaseModel } = require('./BaseModel.js')
const _ = require('lodash')
const { Attribution } = require('./Attribution')
const { ReadActivity } = require('./ReadActivity')

const metadataProps = ['inLanguage', 'keywords']
const attributionTypes = ['author', 'editor']

/**
 * @property {Reader} reader - Returns the reader that owns this publication.
 * @property {Document[]} attachment - Returns the documents attached to this publication.
 * @property {Note[]} replies - Returns the notes associated with this publication.
 * @property {Activity[]} outbox - Returns the activities on this publication. **Question** how should a publication reference its activities?
 * @property {Attribution[]} attributedTo - returns the `Attribution` objects (can be many) attributed with contributing to or creating this document.
 * @property {Tag[]} tag - Returns the publication's `Tag` objects (i.e. links, hashtags, stacks and categories).
 *
 * This class represents an individual publication and holds references to the documents it contains, its creators/contributors, the notes on both the documents and publication itself, the reader who owns it, and the tags used to group it (and its contents) with other publications.
 */
class Publication extends BaseModel {
  static get tableName () /*: string */ {
    return 'Publication'
  }
  get path () /*: string */ {
    return 'publication'
  }
  static get jsonSchema () /*: any */ {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        readerId: { type: 'string' },
        name: { type: 'string' },
        author: { type: 'array' },
        description: { type: 'string' },
        editor: { type: 'array' },
        datePublished: { type: 'string', format: 'date-time' },
        inLanguage: { type: 'array' },
        keywords: { type: 'array' },
        readingOrder: { type: 'object' },
        resources: { type: 'object' },
        links: { type: 'object' },
        json: { type: 'object' },
        updated: { type: 'string', format: 'date-time' },
        published: { type: 'string', format: 'date-time' },
        deleted: { type: 'string', format: 'date-time' }
      },
      required: ['name', 'readerId', 'readingOrder']
    }
  }
  static get relationMappings () /*: any */ {
    const { Reader } = require('./Reader')
    const { Document } = require('./Document.js')
    const { Note } = require('./Note.js')
    const { Tag } = require('./Tag.js')
    return {
      reader: {
        relation: Model.BelongsToOneRelation,
        modelClass: Reader,
        join: {
          from: 'Publication.readerId',
          to: 'Reader.id'
        }
      },
      attributions: {
        relation: Model.HasManyRelation,
        modelClass: Attribution,
        join: {
          from: 'Publication.id',
          to: 'Attribution.publicationId'
        }
      },
      replies: {
        relation: Model.HasManyRelation,
        modelClass: Note,
        join: {
          from: 'Publication.id',
          to: 'Note.publicationId'
        }
      },
      attachment: {
        relation: Model.HasManyRelation,
        modelClass: Document,
        join: {
          from: 'Publication.id',
          to: 'Document.publicationId'
        }
      },
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: Tag,
        join: {
          from: 'Publication.id',
          through: {
            from: 'publication_tag.publicationId',
            to: 'publication_tag.tagId'
          },
          to: 'Tag.id'
        }
      },
      readActivities: {
        relation: Model.HasManyRelation,
        modelClass: ReadActivity,
        join: {
          from: 'Publication.id',
          to: 'readActivity.publicationId'
        }
      }
    }
  }

  asRef () /*: any */ {
    const pub = this.toJSON()
    return _.omit(pub, ['resources', 'readingOrder', 'links', 'json'])
  }

  static async createPublication (
    reader /*: any */,
    publication /*: any */
  ) /*: any */ {
    const metadata = {}
    metadataProps.forEach(property => {
      metadata[property] = publication[property]
    })

    const props = _.pick(publication, [
      'id',
      'name',
      'description',
      'datePublished',
      'json',
      'readingOrder',
      'resources',
      'links'
    ])
    props.readerId = reader.id
    props.metadata = metadata
    props.readingOrder = { data: props.readingOrder }
    if (props.links) props.links = { data: props.links }
    if (props.resources) props.resources = { data: props.resources }

    const createdPublication = await Publication.query(
      Publication.knex()
    ).insertAndFetch(props)

    // create attributions
    for (const type of attributionTypes) {
      if (publication[type]) {
        if (_.isString(publication[type])) {
          publication[type] = [{ type: 'Person', name: publication[type] }]
        }
        createdPublication[type] = []
        for (const instance of publication[type]) {
          const createdAttribution = await Attribution.createAttribution(
            instance,
            type,
            createdPublication
          )
          createdPublication[type].push(createdAttribution)
        }
      }
    }

    return createdPublication
  }

  static async byId (id /*: string */) /*: Promise<any> */ {
    const pub = await Publication.query()
      .findById(id)
      .eager('[reader, replies, tags, attributions]')

    if (!pub || pub.deleted) return null

    pub.readingOrder = pub.readingOrder.data
    if (pub.links) pub.links = pub.links.data
    if (pub.resources) pub.resources = pub.resources.data

    return pub
  }

  static async delete (id /*: string */) /*: number */ {
    let publication = await Publication.query().findById(id)
    if (!publication || publication.deleted) {
      return null
    }
    const date = new Date().toISOString()
    return await Publication.query().patchAndFetchById(id, { deleted: date })
  }

  static async update (newPubObj /*: any */) /*: Promise<any> */ {
    console.log('New pub obj')
    console.log(newPubObj)
    // Create metadata
    const metadata = {}
    metadataProps.forEach(property => {
      metadata[property] = newPubObj[property]
    })

    // Fetch the Publication that will be modified
    let publication = await Publication.query().findById(newPubObj.id)
    if (!publication) {
      return null
    }

    console.log('pub fetched from db')
    console.log(publication)

    const modifications = _.pick(newPubObj, [
      'id',
      'name',
      'description',
      'datePublished',
      'json',
      'readingOrder',
      'resources',
      'links'
    ])

    // modifications.metadata = metadata
    if (modifications.readingOrder) { modifcations.readingOrder = { data: modifications.readingOrder } }
    if (modifications.links) modifications.links = { data: modifications.links }
    if (modifications.resources) {
      modifications.resources = { data: modifications.resources }
    }

    console.log("What's in modifications")
    console.log(modifications)

    // Assign the modifications to the object and update
    publication = Object.assign(publication, modifications)

    console.log('publication after assigned modifications')
    console.log(publication)

    const newPub = await Publication.query().updateAndFetchById(
      newPubObj.id,
      publication
    )

    console.log('New publication after update')
    console.log(newPub)

    // Update Attributions if necessary
    if (newPubObj.author) {
      // Delete previous authors
      const numDeleted = await Attribution.deleteAttributionOfPub(
        newPubObj.id,
        'author'
      )

      if (typeof newPubObj.author === 'string') {
        const attribution = await Attribution.createAttribution(
          newPubObj.author,
          'author',
          newPub
        )
      } else {
        for (var i = 0; i < newPubObj.author.length; i++) {
          const attribution = await Attribution.createAttribution(
            newPubObj.author[i],
            'author',
            newPub
          )
        }
      }
    } else if (newPubObj.editor) {
      // Delete previous editors
      const numDeleted = await Attribution.deleteAttributionOfPub(
        newPubObj.id,
        'editor'
      )

      if (typeof newPubObj.editor === 'string') {
        const attribution = await Attribution.createAttribution(
          newPubObj.editor,
          'editor',
          newPub
        )
      } else {
        for (var i = 0; i < newPubObj.editor.length; i++) {
          const attribution = await Attribution.createAttribution(
            newPubObj.editor[i],
            'editor',
            newPub
          )
        }
      }
    }

    return newPub
  }

  $beforeInsert (queryOptions /*: any */, context /*: any */) /*: any */ {
    const parent = super.$beforeInsert(queryOptions, context)
    let doc = this
    return Promise.resolve(parent).then(function () {
      doc.updated = new Date().toISOString()
    })
  }

  $formatJson (json /*: any */) /*: any */ {
    json = super.$formatJson(json)
    json.id = json.id + '/'
    json.type = 'Publication'
    if (json.attributions) {
      attributionTypes.forEach(type => {
        json[type] = json.attributions.filter(
          attribution => attribution.role === type
        )
      })
      json.attributions = undefined
    }

    if (json.metadata) {
      metadataProps.forEach(prop => {
        json[prop] = json.metadata[prop]
      })
      json.metadata = undefined
    }
    json = _.omitBy(json, _.isNil)

    return json
  }
}

module.exports = { Publication }
