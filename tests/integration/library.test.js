const request = require('supertest')
const tap = require('tap')
const urlparse = require('url').parse
const {
  getToken,
  createUser,
  destroyDB,
  getActivityFromUrl
} = require('./utils')
const app = require('../../server').app

const test = async () => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const token = getToken()
  const userCompleteUrl = await createUser(app, token)
  const userUrl = urlparse(userCompleteUrl).path

  const createPublication = async (
    title,
    author = ['John Smith'],
    editor = 'Jane Doe'
  ) => {
    return await request(app)
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
            name: title,
            author: author,
            editor: editor,
            description: 'this is a description!!',
            keywords: 'one, two',
            links: [{ property: 'value' }],
            readingOrder: [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
            resources: [{ property: 'value' }],
            json: { property: 'value' }
          }
        })
      )
  }

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
            keywords: 'one, two',
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
    await tap.equal(body.items[0].keywords, 'one, two')
    // documents should NOT include:
    await tap.notOk(body.items[0].resources)
    await tap.notOk(body.items[0].readingOrder)
    await tap.notOk(body.items[0].links)
    await tap.notOk(body.items[0].json)
  })

  await tap.test('filter library by collection', async () => {
    // add more publications
    // publication 2
    const pubBres = await createPublication('Publication 2')

    const pubActivityUrl = pubBres.get('Location')
    const pubActivityObject = await getActivityFromUrl(
      app,
      pubActivityUrl,
      token
    )
    const publication = pubActivityObject.object

    // publication 3
    await createPublication('Publication 3')

    // create a stack
    const stackRes = await request(app)
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
            type: 'reader:Stack',
            name: 'mystack'
          }
        })
      )

    const stackActivityUrl = stackRes.get('Location')
    const stackActivityObject = await getActivityFromUrl(
      app,
      stackActivityUrl,
      token
    )

    const stack = stackActivityObject.object
    // assign mystack to publication B
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
          type: 'Add',
          object: { id: stack.id, type: 'reader:Stack' },
          target: { id: publication.id, type: 'Publication' }
        })
      )

    // get library with filter for collection
    const res = await request(app)
      .get(`${userUrl}/library?stack=mystack`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.statusCode, 200)

    const body = res.body
    await tap.type(body, 'object')
    await tap.equal(body.totalItems, 1)
    await tap.ok(Array.isArray(body.items))
    // documents should include:
    await tap.equal(body.items[0].name, 'Publication 2')
  })

  await tap.test('paginate library', async () => {
    // add more publications
    await createPublication('Publication 4')
    await createPublication('Publication 5')
    await createPublication('Publication 6')
    await createPublication('Publication 7')
    await createPublication('Publication 8')
    await createPublication('Publication 9')
    await createPublication('Publication 10')
    await createPublication('Publication 11')
    await createPublication('Publication 12')
    await createPublication('Publication 13')

    // get library with pagination
    const res = await request(app)
      .get(`${userUrl}/library?limit=10`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.statusCode, 200)

    const body = res.body
    await tap.type(body, 'object')
    await tap.equal(body.totalItems, 10)
    await tap.ok(Array.isArray(body.items))
    // documents should include:
    await tap.equal(body.items.length, 10)
    await tap.equal(body.items[0].name, 'Publication 13')
    await tap.equal(body.items[9].name, 'Publication 4')
    await tap.equal(body.page, 1)
    await tap.equal(body.pageSize, 10)

    // get page 2
    const res2 = await request(app)
      .get(`${userUrl}/library?page=2&limit=10`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res2.statusCode, 200)

    const body2 = res2.body
    await tap.type(body2, 'object')
    await tap.equal(body2.totalItems, 3)
    await tap.ok(Array.isArray(body2.items))
    // documents should include:
    await tap.equal(body2.items.length, 3)
    await tap.equal(body2.items[0].name, 'Publication 3')
    await tap.equal(body2.items[2].name, 'Publication A')
    await tap.equal(body2.page, 2)
    await tap.equal(body2.pageSize, 10)

    // testing limit
    const res3 = await request(app)
      .get(`${userUrl}/library?page=2&limit=0`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res3.body.totalItems, 10)

    // testing default
    const res4 = await request(app)
      .get(`${userUrl}/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res4.body.totalItems, 10)
  })

  await tap.test('filter library by title', async () => {
    await createPublication('superbook')
    await createPublication('Super great book!')

    const res = await request(app)
      .get(`${userUrl}/library?title=super`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.status, 200)
    await tap.ok(res.body)
    await tap.equal(res.body.totalItems, 2)
    await tap.ok(res.body.items)
    await tap.equal(res.body.items[0].name, 'Super great book!')

    // should work with limit
    const res2 = await request(app)
      .get(`${userUrl}/library?title=publication`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res2.body.totalItems, 10)

    const res3 = await request(app)
      .get(`${userUrl}/library?title=publication&limit=11`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res3.body.totalItems, 11)

    // should return 0 items if none found
    const res4 = await request(app)
      .get(`${userUrl}/library?title=ansoiwereow`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res4.body.totalItems, 0)
  })

  await tap.test('filter library by attribution', async () => {
    await createPublication('new book 1', 'John Doe')
    await createPublication('new book 2', `jo H. n'dOe`)
    await createPublication('new book 3', 'John Smith', 'John doe')

    const res = await request(app)
      .get(`${userUrl}/library?attribution=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.status, 200)
    await tap.ok(res.body)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.id, 'string')
    // should @context be an object or a string?
    await tap.type(body['@context'], 'string')
    await tap.equal(body.type, 'Collection')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 3)
    await tap.ok(Array.isArray(body.items))
    // documents should include:
    await tap.equal(body.items[0].type, 'Publication')
    await tap.type(body.items[0].id, 'string')
    await tap.type(body.items[0].name, 'string')
    await tap.equal(body.items[0].name, 'new book 3')
    await tap.equal(body.items[0].author[0].name, 'John Smith')
    // documents should NOT include:
    await tap.notOk(body.items[0].resources)
    await tap.notOk(body.items[0].readingOrder)
    await tap.notOk(body.items[0].links)
    await tap.notOk(body.items[0].json)

    // should work with partial match
    const res1 = await request(app)
      .get(`${userUrl}/library?attribution=John d`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res1.body.items.length, 3)

    // should work with limit
    await createPublication('new book 4', 'Jane Smith', 'John Doe')
    await createPublication('new book 5', 'Jane Smith', 'John Doe')
    await createPublication('new book 6', 'Jane Smith', 'John Doe')
    await createPublication('new book 7', 'Jane Smith', 'John Doe')
    await createPublication('new book 8', 'Jane Smith', 'John Doe')
    await createPublication('new book 9', 'Jane Smith', 'John Doe')
    await createPublication('new book 10', 'Jane Smith', 'John Doe')
    await createPublication('new book 11', 'Jane Smith', 'John Doe')
    await createPublication('new book 12', 'Jane Smith', 'John Doe')
    await createPublication('new book 13', 'Jane Smith', 'John Doe')
    await createPublication('new book 14', 'Jane Smith', 'John Doe')
    await createPublication('new book 15', 'Jane Smith', 'John Doe')

    const res2 = await request(app)
      .get(`${userUrl}/library?attribution=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res2.body.items.length, 10)

    const res3 = await request(app)
      .get(`${userUrl}/library?attribution=John%20Doe&limit=11`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res3.body.items.length, 11)

    const res4 = await request(app)
      .get(`${userUrl}/library?attribution=John%20Doe&limit=11&page=2`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res4.body.items.length, 4)
  })

  await tap.test('filter library by attribution with role', async () => {
    const res = await request(app)
      .get(`${userUrl}/library?attribution=John%20D&role=author`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.status, 200)
    await tap.ok(res.body)
    await tap.equal(res.body.items.length, 2)

    // should work with editor and with pagination
    const res2 = await request(app)
      .get(`${userUrl}/library?attribution=John%20D&role=editor`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res2.body.items.length, 10)

    const res3 = await request(app)
      .get(`${userUrl}/library?attribution=John%20D&role=editor&page=2`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res3.body.items.length, 3)
  })

  await tap.test('filter library by author', async () => {
    const res = await request(app)
      .get(`${userUrl}/library?author=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.status, 200)
    await tap.ok(res.body)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.id, 'string')
    // should @context be an object or a string?
    await tap.type(body['@context'], 'string')
    await tap.equal(body.type, 'Collection')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 2)
    await tap.ok(Array.isArray(body.items))
    // documents should include:
    await tap.equal(body.items[0].type, 'Publication')
    await tap.type(body.items[0].id, 'string')
    await tap.type(body.items[0].name, 'string')
    await tap.equal(body.items[0].name, 'new book 2')
    await tap.equal(body.items[0].author[0].name, `jo H. n'dOe`)
    // documents should NOT include:
    await tap.notOk(body.items[0].resources)
    await tap.notOk(body.items[0].readingOrder)
    await tap.notOk(body.items[0].links)
    await tap.notOk(body.items[0].json)

    // should work with limit
    const res2 = await request(app)
      .get(`${userUrl}/library?author=JaneSmith`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res2.body.items.length, 10)

    const res3 = await request(app)
      .get(`${userUrl}/library?author=JaneSmith&limit=11`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res3.body.items.length, 11)

    const res4 = await request(app)
      .get(`${userUrl}/library?author=JaneSmith&limit=11&page=2`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res4.body.items.length, 1)
  })

  await tap.test(
    'Try to get library for user that does not exist',
    async () => {
      const res = await request(app)
        .get(`${userUrl}abc/library`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
      await tap.equal(res.status, 404)
    }
  )

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
