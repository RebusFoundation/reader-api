const request = require('supertest')
const tap = require('tap')
const urlparse = require('url').parse
const { getToken, createUser, destroyDB } = require('./utils')
const app = require('../../server').app

const test = async () => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const token = getToken()
  const userCompleteUrl = await createUser(app, token)
  const userUrl = urlparse(userCompleteUrl).path

  await tap.test('Get empty library', async () => {
    const res = await request(app)
      .get(`${userUrl}/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.status, 200)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.id, 'string')
    // should @context be an object or a string?
    await tap.type(body['@context'], 'string')
    await tap.equal(body.type, 'Collection')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 0)
    await tap.ok(Array.isArray(body.items))
  })

  await tap.test('Add publication and get library', async () => {
    await request(app)
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

    const res = await request(app)
      .get(`${userUrl}/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.statusCode, 200)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.id, 'string')
    // should @context be an object or a string?
    await tap.type(body['@context'], 'string')
    await tap.equal(body.type, 'Collection')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 1)
    await tap.ok(Array.isArray(body.items))
    // documents should include:
    await tap.equal(body.items[0].type, 'Publication')
    await tap.type(body.items[0].id, 'string')
    await tap.type(body.items[0].name, 'string')
    await tap.equal(body.items[0].name, 'Publication A')
    await tap.equal(body.items[0].author[0].name, 'John Smith')
    await tap.equal(body.items[0].editor[0].name, 'Jane Doe')
    // documents should NOT include:
    await tap.notOk(body.items[0].resources)
    await tap.notOk(body.items[0].readingOrder)
    await tap.notOk(body.items[0].links)
    await tap.notOk(body.items[0].json)
  })

  // await tap.test('filter library by collection', async () => {
  //   // add more publications
  //   // publication B
  //   const pubBres = await request(app)
  //     .post(`${userUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' }
  //         ],
  //         type: 'Create',
  //         object: {
  //           type: 'reader:Publication',
  //           name: 'Publication B',
  //           attributedTo: [
  //             {
  //               type: 'Person',
  //               name: 'Sample Author'
  //             }
  //           ],
  //           totalItems: 1,
  //           attachment: [
  //             {
  //               type: 'Document',
  //               name: 'Chapter',
  //               content: 'Sample document content 2',
  //               position: 0
  //             }
  //           ]
  //         }
  //       })
  //     )

  //   const pubActivityUrl = pubBres.get('Location')
  //   const pubActivityObject = await getActivityFromUrl(
  //     app,
  //     pubActivityUrl,
  //     token
  //   )
  //   const publication = pubActivityObject.object

  //   // publication C
  //   await request(app)
  //     .post(`${userUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' }
  //         ],
  //         type: 'Create',
  //         object: {
  //           type: 'reader:Publication',
  //           name: 'Publication C',
  //           attributedTo: [
  //             {
  //               type: 'Person',
  //               name: 'Sample Author'
  //             }
  //           ],
  //           totalItems: 1,
  //           attachment: [
  //             {
  //               type: 'Document',
  //               name: 'Chapter',
  //               content: 'Sample document content',
  //               position: 0
  //             }
  //           ]
  //         }
  //       })
  //     )

  //   // create a stack
  //   const stackRes = await request(app)
  //     .post(`${userUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' }
  //         ],
  //         type: 'Create',
  //         object: {
  //           type: 'reader:Stack',
  //           name: 'mystack'
  //         }
  //       })
  //     )

  //   const stackActivityUrl = stackRes.get('Location')
  //   const stackActivityObject = await getActivityFromUrl(
  //     app,
  //     stackActivityUrl,
  //     token
  //   )
  //   const stack = stackActivityObject.object

  //   // assign mystack to publication B
  //   await request(app)
  //     .post(`${userUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' }
  //         ],
  //         type: 'Add',
  //         object: { id: stack.id, type: stack.type },
  //         target: { id: publication.id }
  //       })
  //     )

  //   // get library with filter for collection
  //   const res = await request(app)
  //     .get(`${userUrl}/library?stack=mystack`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //   await tap.equal(res.statusCode, 200)

  //   const body = res.body
  //   await tap.type(body, 'object')
  //   await tap.equal(body.totalItems, 1)
  //   await tap.ok(Array.isArray(body.items))
  //   // documents should include:
  //   await tap.equal(body.items[0].name, 'Publication B')
  // })

  // await tap.test(
  //   'Try to get library for user that does not exist',
  //   async () => {
  //     const res = await request(app)
  //       .get(`${userUrl}abc/library`)
  //       .set('Host', 'reader-api.test')
  //       .set('Authorization', `Bearer ${token}`)
  //       .type(
  //         'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //       )
  //     await tap.equal(res.status, 404)
  //   }
  // )

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
