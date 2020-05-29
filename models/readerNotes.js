const { Note } = require('./Note')
const { Reader } = require('./Reader')
const { urlToId } = require('../utils/utils')
const urlparse = require('url').parse

class ReaderNotes {
  static async getNotesCount (readerId, filters) {
    // note: not applied with filters.document
    let flag
    if (filters.flag) {
      flag = filters.flag.toLowerCase()
    }
    let resultQuery = Note.query(Note.knex())
      .count()
      .whereNull('Note.deleted')
      .whereNull('Note.contextId')
      .andWhere('Note.readerId', '=', readerId)
      .leftJoin('NoteBody', 'NoteBody.noteId', '=', 'Note.id')

    if (filters.publication) {
      resultQuery = resultQuery.where(
        'Note.publicationId',
        '=',
        urlToId(filters.publication)
      )
    }
    if (filters.motivation) {
      resultQuery = resultQuery.where(
        'NoteBody.motivation',
        '=',
        filters.motivation
      )
    }

    if (filters.search) {
      resultQuery = resultQuery.where(
        'NoteBody.content',
        'ilike',
        '%' + filters.search.toLowerCase() + '%'
      )
    }

    if (filters.publishedStart) {
      resultQuery = resultQuery.where(
        'Note.published',
        '>=',
        filters.publishedStart
      )
    }

    if (filters.publishedEnd) {
      resultQuery = resultQuery.where(
        'Note.published',
        '<=',
        filters.publishedEnd
      )
    }

    if (filters.collection) {
      resultQuery = resultQuery
        .leftJoin(
          'note_tag AS note_tag_collection',
          'note_tag_collection.noteId',
          '=',
          'Note.id'
        )
        .leftJoin(
          'Tag AS Tag_collection',
          'note_tag_collection.tagId',
          '=',
          'Tag_collection.id'
        )
        .whereNull('Tag_collection.deleted')
        .where('Tag_collection.name', '=', filters.collection)
        .andWhere('Tag_collection.type', '=', 'stack')
    }

    if (filters.tag) {
      resultQuery = resultQuery
        .leftJoin(
          'note_tag AS note_tag_tag',
          'note_tag_tag.noteId',
          '=',
          'Note.id'
        )
        .leftJoin('Tag AS Tag_tag', 'note_tag_tag.tagId', '=', 'Tag_tag.id')
        .whereNull('Tag_tag.deleted')
        .where('Tag_tag.id', '=', filters.tag)
    }

    if (filters.flag) {
      resultQuery = resultQuery
        .leftJoin(
          'note_tag AS note_tag_flag',
          'note_tag_flag.noteId',
          '=',
          'Note.id'
        )
        .leftJoin('Tag AS Tag_flag', 'note_tag_flag.tagId', '=', 'Tag_flag.id')
        .whereNull('Tag_flag.deleted')
        .where('Tag_flag.name', '=', flag)
        .andWhere('Tag_flag.type', '=', 'flag')
    }

    const result = await resultQuery

    return result[0].count
  }

  static async getNotes (
    readerAuthId /*: string */,
    limit /*: number */,
    offset /*: number */,
    filters /*: any */
  ) /*: Promise<Array<any>> */ {
    offset = !offset ? 0 : offset
    const qb = Reader.query(Reader.knex()).where('authId', '=', readerAuthId)
    let flag

    if (filters.flag) {
      flag = filters.flag.toLowerCase()
    }
    if (filters.document) {
      // no pagination for filter by document
      offset = 0
      limit = 100000
    }

    const readers = await qb
      .withGraphFetched('replies.[publication.[attributions], body, tags]')
      .modifyGraph('replies', builder => {
        builder.modifyGraph('body', bodyBuilder => {
          bodyBuilder.select('content', 'language', 'motivation')
          bodyBuilder.whereNull('deleted')
        })
        builder.select('Note.*').from('Note')
        builder.distinct('Note.id')
        // load details of parent publication for each note
        builder.modifyGraph('publication', pubBuilder => {
          pubBuilder.whereNull('Publication.deleted')
          pubBuilder.select(
            'id',
            'name',
            'type',
            'published',
            'updated',
            'deleted'
          )
        })
        builder.whereNull('Note.deleted')
        builder.whereNull('Note.contextId')

        // filters
        if (filters.publication) {
          builder.where('publicationId', '=', urlToId(filters.publication))
        }
        if (filters.document) {
          builder.where('document', '=', filters.document)
        }

        if (filters.publishedStart) {
          builder.where('Note.published', '>=', filters.publishedStart)
        }
        if (filters.publishedEnd) {
          builder.where('Note.published', '<=', filters.publishedEnd)
        }

        builder.leftJoin('NoteBody', 'NoteBody.noteId', '=', 'Note.id')
        if (filters.motivation) {
          builder.where('NoteBody.motivation', '=', filters.motivation)
        }

        if (filters.search) {
          builder.where(
            'NoteBody.content',
            'ilike',
            '%' + filters.search.toLowerCase() + '%'
          )
        }

        if (filters.collection) {
          builder.leftJoin(
            'note_tag AS note_tag_collection',
            'note_tag_collection.noteId',
            '=',
            'Note.id'
          )
          builder.leftJoin(
            'Tag AS Tag_collection',
            'note_tag_collection.tagId',
            '=',
            'Tag_collection.id'
          )
          builder.whereNull('Tag_collection.deleted')

          builder
            .where('Tag_collection.name', '=', filters.collection)
            .andWhere('Tag_collection.type', '=', 'stack')
        }
        if (filters.tag) {
          builder.leftJoin(
            'note_tag AS note_tag_tag',
            'note_tag_tag.noteId',
            '=',
            'Note.id'
          )
          builder.leftJoin(
            'Tag AS Tag_tag',
            'note_tag_tag.tagId',
            '=',
            'Tag_tag.id'
          )
          builder.whereNull('Tag_tag.deleted')
          builder.where('Tag_tag.id', '=', filters.tag)
        }

        if (filters.flag) {
          builder.leftJoin(
            'note_tag AS note_tag_flag',
            'note_tag_flag.noteId',
            '=',
            'Note.id'
          )
          builder.leftJoin(
            'Tag AS Tag_flag',
            'note_tag_flag.tagId',
            '=',
            'Tag_flag.id'
          )
          builder.whereNull('Tag_flag.deleted')
          builder
            .where('Tag_flag.name', '=', flag)
            .andWhere('Tag_flag.type', '=', 'flag')
        }

        // orderBy
        if (filters.orderBy === 'created') {
          if (filters.reverse) {
            builder.orderBy('Note.published')
          } else {
            builder.orderBy('Note.published', 'desc')
          }
        }

        if (filters.orderBy === 'updated' || !filters.orderBy) {
          if (filters.reverse) {
            builder.orderBy('Note.updated')
          } else {
            builder.orderBy('Note.updated', 'desc')
          }
        }

        // paginate
        builder.limit(limit).offset(offset)
      })

    return readers[0]
  }
}

module.exports = { ReaderNotes }