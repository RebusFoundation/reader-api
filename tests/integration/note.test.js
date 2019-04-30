const request = require('supertest')
const tap = require('tap')
const urlparse = require('url').parse
const {
  getToken,
  createUser,
  destroyDB,
  getActivityFromUrl
} = require('./utils')
const { Document } = require('../../models/Document')
const { urlToId } = require('../../routes/utils')

const test = async app => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const token = getToken()
  const userId = await createUser(app, token)
  const userUrl = urlparse(userId).path
  let noteUrl
  let activityUrl

  const resActivity = await request(app)
    .post(`${userUrl}/activity`)
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)
    .type(
      'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    )
    .send(
      JSON.stringify({
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          { reader: 'https://rebus.foundation/ns/reader' }
        ],
        type: 'Create',
        object: {
          type: 'Publication',
          name: 'Publication A',
          author: ['John Smith'],
          editor: 'Jane Doe',
          description: 'this is a description!!',
          links: [{ property: 'value' }],
          readingOrder: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
          resources: [{ property: 'value' }],
          json: { property: 'value' }
        }
      })
    )

  const pubActivityUrl = resActivity.get('Location')
  const pubActivityObject = await getActivityFromUrl(app, pubActivityUrl, token)
  const publicationUrl = pubActivityObject.object.id

  const resPublication = await request(app)
    .get(urlparse(publicationUrl).path)
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)
    .type(
      'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    )

  // creating a document - this will not be exposed to the users. It will be done as part of the upload
  const createdDocument = await Document.createDocument(
    { id: urlToId(userId) },
    urlToId(resPublication.body.id),
    {
      documentPath: '/path/1',
      mediaType: 'text/html',
      url: 'http://something/123'
    }
  )

  const documentUrl = `${publicationUrl}${createdDocument.documentPath}`

  await tap.test('Create Note', async () => {
    const res = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Create',
          object: {
            type: 'Note',
            content: 'This is the content of note A.',
            'oa:hasSelector': {},
            context: publicationUrl,
            inReplyTo: documentUrl,
            noteType: 'test'
          }
        })
      )
    await tap.equal(res.status, 201)
    await tap.type(res.get('Location'), 'string')
    activityUrl = res.get('Location')
  })

  // TODO: migrate
  // await tap.test(
  //   'Try to create Note with invalid Publication context',
  //   async () => {
  //     const res = await request(app)
  //       .post(`${userUrl}/activity`)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )
  //       .send(
  //         JSON.stringify({
  //           '@context': [
  //             'https://www.w3.org/ns/activitystreams',
  //             { reader: 'https://rebus.foundation/ns/reader' }
  //           ],
  //           type: 'Create',
  //           object: {
  //             type: 'Note',
  //             content: 'This is the content of note A.',
  //             'oa:hasSelector': {},
  //             context: publicationUrl + '123',
  //             inReplyTo: documentUrl
  //           }
  //         })
  //       )

  //     await tap.equal(res.status, 404)
  //   }
  // )

  // TODO: migrate
  // await tap.test(
  //   'Try to create Note with invalid inReplyTo Document',
  //   async () => {
  //     const res = await request(app)
  //       .post(`${userUrl}/activity`)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )
  //       .send(
  //         JSON.stringify({
  //           '@context': [
  //             'https://www.w3.org/ns/activitystreams',
  //             { reader: 'https://rebus.foundation/ns/reader' }
  //           ],
  //           type: 'Create',
  //           object: {
  //             type: 'Note',
  //             content: 'This is the content of note A.',
  //             'oa:hasSelector': {},
  //             context: publicationUrl,
  //             inReplyTo: documentUrl + '123'
  //           }
  //         })
  //       )

  //     await tap.equal(res.status, 404)
  //   }
  // )

  await tap.test('Get note', async () => {
    const activityObject = await getActivityFromUrl(app, activityUrl, token)
    noteUrl = activityObject.object.id

    const res = await request(app)
      .get(urlparse(noteUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.statusCode, 200)

    const body = res.body
    await tap.type(body, 'object')
    await tap.equal(body.type, 'Note')
    await tap.type(body.id, 'string')
    await tap.type(body.inReplyTo, 'string')
    await tap.type(body.context, 'string')
    await tap.type(body['oa:hasSelector'], 'object')
    await tap.type(body['@context'], 'object')
    await tap.ok(Array.isArray(body['@context']))
  })

  await tap.test('Get Note that does not exist', async () => {
    const res = await request(app)
      .get(urlparse(noteUrl).path + 'abc')
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.statusCode, 404)
  })

  await tap.test('Get Publication with reference to Notes', async () => {
    const res = await request(app)
      .get(urlparse(publicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.statusCode, 200)

    const body = res.body
    await tap.ok(Array.isArray(body.replies))
    await tap.equal(body.replies.length, 1)
    await tap.type(body.replies[0], 'string')
  })

  // await tap.test(
  //   'Publication should include notes from different documents',
  //   async () => {
  //     // create another document for this publication
  //     const documentRes = await request(app)
  //       .post(`${userUrl}/activity`)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )
  //       .send(
  //         JSON.stringify({
  //           '@context': [
  //             'https://www.w3.org/ns/activitystreams',
  //             { reader: 'https://rebus.foundation/ns/reader' }
  //           ],
  //           type: 'Create',
  //           object: {
  //             type: 'Document',
  //             name: 'Document B',
  //             content: 'This is the content of document B.',
  //             context: publicationUrl
  //           }
  //         })
  //       )

  //     const pubActivityUrl2 = documentRes.get('Location')
  //     const ActivityObject2 = await getActivityFromUrl(
  //       app,
  //       pubActivityUrl2,
  //       token
  //     )
  //     const secondDocUrl = ActivityObject2.object.id
  //     // create a note for that document
  //     await request(app)
  //       .post(`${userUrl}/activity`)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )
  //       .send(
  //         JSON.stringify({
  //           '@context': [
  //             'https://www.w3.org/ns/activitystreams',
  //             { reader: 'https://rebus.foundation/ns/reader' }
  //           ],
  //           type: 'Create',
  //           object: {
  //             type: 'Note',
  //             content: 'This is the content of note A.',
  //             'oa:hasSelector': {},
  //             context: publicationUrl,
  //             inReplyTo: secondDocUrl
  //           }
  //         })
  //       )

  //     const res = await request(app)
  //       .get(urlparse(publicationUrl).path)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )

  //     await tap.equal(res.statusCode, 200)

  //     const body = res.body
  //     await tap.ok(Array.isArray(body.replies))
  //     await tap.equal(body.replies.length, 2)
  //     await tap.type(body.replies[1], 'string')
  //   }
  // )

  await tap.test('Update a Note', async () => {
    const res = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Update',
          object: {
            type: 'Note',
            id: noteUrl,
            content: 'new content!!'
          }
        })
      )

    await tap.equal(res.statusCode, 201)
    await tap.type(res.get('Location'), 'string')
    activityUrl = res.get('Location')

    const activityObject = await getActivityFromUrl(app, activityUrl, token)
    noteUrl = activityObject.object.id

    const resnote = await request(app)
      .get(urlparse(noteUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(resnote.statusCode, 200)

    const body = resnote.body
    await tap.type(body, 'object')
    await tap.equal(body.type, 'Note')
    await tap.type(body.id, 'string')
    await tap.type(body.content, 'string')
    await tap.equal(body.content, 'new content!!')
    await tap.notEqual(body.published, body.updated)
    // check that old properties are still there
    await tap.type(body.inReplyTo, 'string')
    await tap.type(body.context, 'string')
    await tap.type(body['oa:hasSelector'], 'object')
    await tap.type(body['@context'], 'object')
    await tap.ok(Array.isArray(body['@context']))
  })

  await tap.test('Try to update a Note that does not exist', async () => {
    const res = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Update',
          object: {
            type: 'Note',
            id: noteUrl + 'abc',
            content: 'new content!!'
          }
        })
      )
    await tap.equal(res.statusCode, 404)
  })

  await tap.test('Delete a Note', async () => {
    // before: there are two notes on this publication
    const pubresbefore = await request(app)
      .get(urlparse(publicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(pubresbefore.body.replies.length, 1) // should be 2 if previous test is re-enabled

    const res = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Note',
            id: noteUrl
          }
        })
      )

    await tap.equal(res.statusCode, 201)

    // note should no longer exist
    const getres = await request(app)
      .get(urlparse(noteUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(getres.statusCode, 404)

    // note should no longer be attached to publication
    const pubres = await request(app)
      .get(urlparse(publicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(pubres.statusCode, 200)

    const body = pubres.body
    await tap.ok(Array.isArray(body.replies))
    await tap.equal(body.replies.length, 0)
  })

  await tap.test('Try to delete a Note that does not exist', async () => {
    // already deleted
    const res = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Note',
            id: noteUrl
          }
        })
      )

    await tap.equal(res.statusCode, 404)

    const res1 = await request(app)
      .post(`${userUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Note',
            id: noteUrl + '123'
          }
        })
      )

    await tap.equal(res1.statusCode, 404)
  })

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
