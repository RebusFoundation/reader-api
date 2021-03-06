const request = require('supertest')
const tap = require('tap')
const {
  getToken,
  createUser,
  destroyDB,
  createSource,
  createNote,
  createTag,
  addNoteToCollection,
  addSourceToCollection
} = require('../../utils/testUtils')
const { urlToId } = require('../../../utils/utils')
const { Reader } = require('../../../models/Reader')

const test = async app => {
  const token = getToken()
  const readerCompleteUrl = await createUser(app, token)
  const readerId = urlToId(readerCompleteUrl)

  // Create Reader object
  const person = {
    name: 'J. Random Reader'
  }
  await Reader.createReader(readerId, person)

  const source = await createSource(app, token)

  // create Note for reader 1
  const note = await createNote(app, token, {
    sourceId: source.id,
    body: { motivation: 'test' }
  })

  const noteUrl = note.id

  // create Tag
  const stack = await createTag(app, token, {
    type: 'stack',
    name: 'mystack',
    json: { property: 'value' }
  })

  await tap.test(
    'Try to delete a Tag with a tagId that does not exist',
    async () => {
      const res = await request(app)
        .delete(`/tags/${stack.id}123`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res.statusCode, 404)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 404)
      await tap.equal(
        error.message,
        `Delete Tag Error: No Tag found with id ${stack.id}123`
      )
      await tap.equal(error.details.requestUrl, `/tags/${stack.id}123`)
    }
  )

  await tap.test('Delete a Tag', async () => {
    // Get the library before the modifications
    const libraryBefore = await request(app)
      .get(`/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(libraryBefore.body.tags.length, 14) // 9 flags + 4 colours + our tag

    // get the tags list before
    const tagsBefore = await request(app)
      .get(`/tags`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(tagsBefore.body.length, 14) // 9 flags + 4 colours + our tag

    // Add a tag to the note and source
    await addNoteToCollection(app, token, urlToId(noteUrl), urlToId(stack.id))
    await addSourceToCollection(
      app,
      token,
      urlToId(source.id),
      urlToId(stack.id)
    )

    // Note and Source have the tag
    const resNote = await request(app)
      .get(`/notes/${urlToId(noteUrl)}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(resNote.body.tags.length, 1)
    await tap.equal(resNote.body.tags[0].id, stack.id)

    const resSource = await request(app)
      .get(`/sources/${urlToId(source.id)}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(resSource.body.tags.length, 1)
    await tap.equal(resSource.body.tags[0].id, stack.id)

    // Delete the tag
    const res = await request(app)
      .delete(`/tags/${stack.id}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res.statusCode, 204)

    // Get the library after the modifications
    const libraryAfter = await request(app)
      .get(`/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(libraryAfter.body.tags.length, 13) // 9 flags + 4 colours
    await tap.equal(libraryAfter.body.items[0].tags.length, 0)

    // get the tags list after
    const tagsAfter = await request(app)
      .get(`/tags`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(tagsAfter.body.length, 13) // 9 flags + 4 colours

    // Note and Source should no longer have the tag
    const resNoteAfter = await request(app)
      .get(`/notes/${urlToId(noteUrl)}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(resNoteAfter.body.tags.length, 0)

    const resSourceAfter = await request(app)
      .get(`/sources/${urlToId(source.id)}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(resSourceAfter.body.tags.length, 0)
  })

  await tap.test(
    'Getting library by deleted collection should return nothing',
    async () => {
      res = await request(app)
        .get(`/library?stack=mystack`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res.body.items.length, 0)
    }
  )

  await tap.test(
    'Getting readerNotes by deleted collection should return nothing',
    async () => {
      res = await request(app)
        .get(`/notes?stack=mystack`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res.body.items.length, 0)
    }
  )

  await tap.test('Try to delete a Tag that was already deleted', async () => {
    const res = await request(app)
      .delete(`/tags/${stack.id}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(
      error.message,
      `Delete Tag Error: No Tag found with id ${stack.id}`
    )
    await tap.equal(error.details.requestUrl, `/tags/${stack.id}`)
  })

  await tap.test('Try to update a Tag that was already deleted', async () => {
    const res = await request(app)
      .put(`/tags/${stack.id}`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
      .send(JSON.stringify(Object.assign(stack, { name: 'new name' })))

    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(
      error.message,
      `Put Tag Error: No Tag found with id ${stack.id}`
    )
    await tap.equal(error.details.requestUrl, `/tags/${stack.id}`)
  })

  await destroyDB(app)
}

module.exports = test
