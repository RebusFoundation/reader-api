const request = require('supertest')
const tap = require('tap')
const crypto = require('crypto')
const {
  getToken,
  createUser,
  destroyDB,
  createSource,
  createNoteContext,
  createNote,
  createTag,
  addNoteToCollection
} = require('../../utils/testUtils')
const { urlToId } = require('../../../utils/utils')
const _ = require('lodash')

const test = async app => {
  const token = getToken()
  const readerUrl = await createUser(app, token)
  const readerId = urlToId(readerUrl)

  const source = await createSource(app, token)
  const sourceId = urlToId(source.id)

  // source2
  await createSource(app, token)

  const outline = await createNoteContext(app, token, {
    name: 'my outline',
    type: 'outline'
  })

  const noteId1 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`
  const noteId2 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`
  const noteId3 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`
  const noteId4 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`
  const noteId5 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`
  const noteId6 = `${readerId}-${crypto.randomBytes(5).toString('hex')}`

  const originalNote1 = await createNote(app, token)
  const originalNote2 = await createNote(app, token)
  const originalNote3 = await createNote(app, token)
  const originalNote4 = await createNote(app, token)

  const tag1 = await createTag(app, token, { name: 'tag1' })
  const tag2 = await createTag(app, token, { name: 'tag2' })

  await addNoteToCollection(app, token, originalNote3.shortId, tag1.shortId)
  await addNoteToCollection(app, token, originalNote4.shortId, tag1.shortId)
  await addNoteToCollection(app, token, originalNote4.shortId, tag2.shortId)

  await tap.test('Add two new notes to an empty outline', async () => {
    const res = await request(app)
      .post(`/outlines/${outline.shortId}/notes`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
      .send(
        JSON.stringify([
          {
            shortId: noteId1,
            next: noteId2,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            },
            json: { property1: 'value1' }
          },
          {
            shortId: noteId2,
            previous: noteId1,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            },
            json: { property1: 'value2' }
          }
        ])
      )
    await tap.equal(res.status, 201)
    const body = res.body
    await tap.equal(res.body.length, 2)
    const note1 = _.find(body, { shortId: noteId1 })
    await tap.ok(note1.body)
    await tap.equal(note1.next, noteId2)
    await tap.notOk(note1.previous)
    const note2 = _.find(body, { shortId: noteId2 })
    await tap.ok(note2.body)
    await tap.equal(note2.previous, noteId1)
    await tap.notOk(note2.next)

    const resOutline = await request(app)
      .get(`/outlines/${outline.shortId}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    const notes = resOutline.body.notes
    await tap.equal(notes.length, 2)
    await tap.equal(notes[0].shortId, noteId1)
    await tap.equal(notes[0].next, noteId2)
    await tap.equal(notes[1].shortId, noteId2)
    await tap.equal(notes[1].previous, noteId1)
  })

  await tap.test('Add two existing notes to an outline', async () => {
    const res = await request(app)
      .post(`/outlines/${outline.shortId}/notes`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
      .send(
        JSON.stringify([
          {
            original: originalNote1.shortId,
            shortId: noteId3,
            next: noteId4,
            previous: noteId2,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            },
            json: { property1: 'value1' }
          },
          {
            original: originalNote2.shortId,
            shortId: noteId4,
            previous: noteId3,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            },
            json: { property1: 'value2' }
          }
        ])
      )
    await tap.equal(res.status, 201)
    const body = res.body
    await tap.equal(res.body.length, 2)
    const note3 = _.find(body, { shortId: noteId3 })
    await tap.ok(note3.body)
    await tap.equal(note3.next, noteId4)
    await tap.equal(note3.previous, noteId2)
    await tap.equal(note3.original, originalNote1.shortId)
    const note4 = _.find(body, { shortId: noteId4 })
    await tap.ok(note4.body)
    await tap.equal(note4.previous, noteId3)
    await tap.notOk(note4.next)
    await tap.equal(note4.original, originalNote2.shortId)

    const resOutline = await request(app)
      .get(`/outlines/${outline.shortId}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    const notes = resOutline.body.notes
    await tap.equal(notes.length, 4)
    await tap.equal(notes[0].shortId, noteId1)
    await tap.equal(notes[0].next, noteId2)
    await tap.equal(notes[1].shortId, noteId2)
    await tap.equal(notes[1].previous, noteId1)
    await tap.equal(notes[1].next, noteId3)
    await tap.equal(notes[2].shortId, noteId3)
    await tap.equal(notes[2].previous, noteId2)
    await tap.equal(notes[2].next, noteId4)
    await tap.equal(notes[3].shortId, noteId4)
    await tap.equal(notes[3].previous, noteId3)
  })

  await tap.test('Add two existing notes to an outline with tags', async () => {
    const res = await request(app)
      .post(`/outlines/${outline.shortId}/notes`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
      .send(
        JSON.stringify([
          {
            original: originalNote3.shortId,
            shortId: noteId5,
            next: noteId6,
            previous: noteId4,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            }
          },
          {
            original: originalNote4.shortId,
            shortId: noteId6,
            previous: noteId5,
            body: {
              content: 'this is the content of the note',
              motivation: 'test'
            },
            json: { property1: 'value2' }
          }
        ])
      )
    await tap.equal(res.status, 201)
    const body = res.body
    await tap.equal(res.body.length, 2)
    const note5 = _.find(body, { shortId: noteId5 })
    await tap.ok(note5.body)
    await tap.equal(note5.next, noteId6)
    await tap.equal(note5.previous, noteId4)
    // await tap.ok(note5.tags)
    // await tap.equal(note5.tags.length, 1)
    const note6 = _.find(body, { shortId: noteId6 })
    await tap.ok(note6.body)
    await tap.equal(note6.previous, noteId5)
    await tap.notOk(note6.next)
    // await tap.ok(note6.tags)
    // await tap.equal(note6.tags.length, 2)

    const resOutline = await request(app)
      .get(`/outlines/${outline.shortId}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    const notes = resOutline.body.notes
    await tap.equal(notes.length, 6)
    await tap.equal(notes[0].shortId, noteId1)
    await tap.equal(notes[0].next, noteId2)
    await tap.equal(notes[1].shortId, noteId2)
    await tap.equal(notes[1].previous, noteId1)
    await tap.equal(notes[1].next, noteId3)
    await tap.equal(notes[2].shortId, noteId3)
    await tap.equal(notes[2].previous, noteId2)
    await tap.equal(notes[2].next, noteId4)
    await tap.equal(notes[3].shortId, noteId4)
    await tap.equal(notes[3].previous, noteId3)
    await tap.equal(notes[3].next, noteId5)
    await tap.equal(notes[4].shortId, noteId5)
    await tap.equal(notes[4].previous, noteId4)
    await tap.equal(notes[4].next, noteId6)
    await tap.ok(notes[4].tags)
    await tap.equal(notes[4].tags.length, 1)
    await tap.equal(notes[5].shortId, noteId6)
    await tap.equal(notes[5].previous, noteId5)
    await tap.ok(notes[5].tags)
    await tap.equal(notes[5].tags.length, 2)
  })

  await destroyDB(app)
}

module.exports = test
