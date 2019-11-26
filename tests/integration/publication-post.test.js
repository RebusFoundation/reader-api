const request = require('supertest')
const tap = require('tap')
const { getToken, createUser, destroyDB } = require('../utils/utils')
const { urlToId } = require('../../utils/utils')
const urlparse = require('url').parse

const test = async app => {
  const token = getToken()
  const readerCompleteUrl = await createUser(app, token)
  const readerId = urlToId(readerCompleteUrl)
  const readerUrl = urlparse(readerCompleteUrl).path

  const now = new Date().toISOString()

  // TODO: add more properties when Pull Request is merged
  const publicationObject = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      { reader: 'https://rebus.foundation/ns/reader' }
    ],
    type: 'Book',
    name: 'Publication A',
    author: ['John Smith'],
    contributor: ['Sample Contributor'],
    creator: [{ name: 'Sample Creator' }],
    illustrator: [{ name: 'Sample Illustrator', type: 'Person' }],
    publisher: ['Sample Publisher'],
    translator: ['Sample Translator'],
    editor: 'Jane Doe',
    abstract: 'this is a description!!',
    numberOfPages: 250,
    encodingFormat: 'epub',
    inLanguage: 'en',
    datePublished: now,
    bookEdition: 'third',
    bookFormat: 'EBook',
    isbn: '1234',
    copyrightYear: 1977,
    genre: 'vampire romance',
    license: 'http://www.mylicense.com',
    links: [
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example link'
      }
    ],
    readingOrder: [
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example reading order object1'
      },
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example reading order object2'
      },
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example reading order object3'
      }
    ],
    resources: [
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example resource'
      }
    ],
    json: { property: 'value' }
  }

  await tap.test('Create a Simple Publication', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          name: 'Publication Simple',
          type: 'Book'
        })
      )

    await tap.equal(res.status, 201)

    const body = res.body
    await tap.equal(body.name, 'Publication Simple')
    await tap.equal(body.type, 'Book')
  })

  await tap.test('Create a Publication', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(JSON.stringify(publicationObject))

    await tap.equal(res.status, 201)

    const body = res.body

    await tap.equal(body.name, 'Publication A')
    await tap.equal(body.type, 'Book')
    await tap.equal(body.abstract, 'this is a description!!')
    await tap.equal(body.json.property, 'value')
    await tap.equal(body.numberOfPages, 250)
    await tap.equal(body.encodingFormat, 'epub')
    await tap.equal(body.inLanguage[0], 'en')
    await tap.equal(body.author[0].name, 'John Smith')
    await tap.equal(body.editor[0].name, 'Jane Doe')
    await tap.equal(body.links.length, 1)
    await tap.equal(body.readingOrder.length, 3)
    await tap.equal(body.resources.length, 1)
    await tap.equal(body.contributor[0].name, 'Sample Contributor')
    await tap.equal(body.creator[0].name, 'Sample Creator')
    await tap.equal(body.illustrator[0].name, 'Sample Illustrator')
    await tap.equal(body.publisher[0].name, 'Sample Publisher')
    await tap.equal(body.translator[0].name, 'Sample Translator')
    await tap.equal(body.bookEdition, 'third')
    await tap.equal(body.bookFormat, 'EBook')
    await tap.equal(body.isbn, '1234')
    await tap.equal(body.copyrightYear, 1977)
    await tap.equal(body.genre, 'vampire romance')
    await tap.equal(body.license, 'http://www.mylicense.com')
  })

  await tap.test('invalid properties should be ignored', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          type: 'Book',
          name: 'Publication B',
          invalidProp: 'blah blah'
        })
      )

    await tap.equal(res.status, 201)

    const body = res.body
    await tap.equal(body.name, 'Publication B')
    await tap.notOk(body.invalidProp)
  })

  await tap.test('created publications should be in the library', async () => {
    const res = await request(app)
      .get(`${readerUrl}/library`)
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
    await tap.equal(body.totalItems, 3)
    await tap.ok(Array.isArray(body.items))
    await tap.equal(body.items.length, 3)
    await tap.equal(body.items[0].name, 'Publication B')
    await tap.equal(body.items[1].name, 'Publication A')
    await tap.equal(body.items[2].name, 'Publication Simple')
  })

  await tap.test('trying to create a Publication without a name', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          type: 'Book',
          numberOfPages: 199
        })
      )

    await tap.equal(res.status, 400)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 400)
    await tap.equal(error.error, 'Bad Request')
    await tap.equal(error.details.type, 'Publication')
    await tap.equal(error.details.activity, 'Create Publication')
    await tap.type(error.details.validation, 'object')
    await tap.equal(error.details.validation.name[0].keyword, 'required')
    await tap.equal(
      error.details.validation.name[0].params.missingProperty,
      'name'
    )
  })

  await tap.test('trying to create a Publication without a type', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          name: 'Publication C',
          numberOfPages: 199
        })
      )

    await tap.equal(res.status, 400)

    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 400)
    await tap.equal(error.error, 'Bad Request')
    await tap.equal(error.details.type, 'Publication')
    await tap.equal(error.details.activity, 'Create Publication')
    await tap.type(error.details.validation, 'object')
    await tap.equal(error.details.validation.type[0].keyword, 'required')
    await tap.equal(
      error.details.validation.type[0].params.missingProperty,
      'type'
    )
  })

  await tap.test(
    'Try to create a Publication with an invalid json',
    async () => {
      const res = await request(app)
        .post(`/readers/${readerId}/publications`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
        .send(
          JSON.stringify({
            name: 'Publication C',
            type: 'Book',
            json: 'a string'
          })
        )

      await tap.equal(res.status, 400)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 400)
      await tap.equal(error.error, 'Bad Request')
      await tap.equal(error.details.type, 'Publication')
      await tap.equal(error.details.activity, 'Create Publication')
      await tap.type(error.details.validation, 'object')
      await tap.equal(error.details.validation.json[0].keyword, 'type')
      await tap.equal(error.details.validation.json[0].params.type, 'object')
    }
  )

  await tap.test(
    'Try to create a Publication with an invalid language code',
    async () => {
      const res = await request(app)
        .post(`/readers/${readerId}/publications`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
        .send(
          JSON.stringify({
            name: 'Publication C',
            type: 'Book',
            inLanguage: ['not a valid code', 'another invalid thing']
          })
        )

      await tap.equal(res.status, 400)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 400)
      await tap.equal(error.error, 'Bad Request')
      await tap.equal(error.details.type, 'Publication')
      await tap.equal(error.details.activity, 'Create Publication')
    }
  )

  await tap.test(
    'Try to create a Publication with an invalid attribution',
    async () => {
      const res = await request(app)
        .post(`/readers/${readerId}/publications`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
        .send(
          JSON.stringify({
            name: 'Publication C',
            type: 'Book',
            illustrator: 123
          })
        )

      await tap.equal(res.status, 400)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 400)
      await tap.equal(error.error, 'Bad Request')
      await tap.equal(error.details.type, 'Publication')
      await tap.equal(error.details.activity, 'Create Publication')
    }
  )

  await tap.test(
    'Try to create a Publication with an invalid attribution type',
    async () => {
      const res = await request(app)
        .post(`/readers/${readerId}/publications`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
        .send(
          JSON.stringify({
            name: 'Publication C',
            type: 'Book',
            creator: [{ name: 'John Smith', type: 'invalid' }]
          })
        )
      await tap.equal(res.status, 400)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 400)
      await tap.equal(error.error, 'Bad Request')
      await tap.equal(error.details.type, 'Publication')
      await tap.equal(error.details.activity, 'Create Publication')
    }
  )

  await tap.test(
    'Try to create a Publication with an invalid attribution object',
    async () => {
      const res = await request(app)
        .post(`/readers/${readerId}/publications`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type(
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        )
        .send(
          JSON.stringify({
            name: 'Publication C',
            type: 'Book',
            creator: [{ prop: 'value' }]
          })
        )
      await tap.equal(res.status, 400)
      const error = JSON.parse(res.text)
      await tap.equal(error.statusCode, 400)
      await tap.equal(error.error, 'Bad Request')
      await tap.equal(error.details.type, 'Publication')
      await tap.equal(error.details.activity, 'Create Publication')
    }
  )

  await tap.test('Try to create a Publication without a body', async () => {
    const res = await request(app)
      .post(`/readers/${readerId}/publications`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.status, 400)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 400)
    await tap.equal(error.error, 'Bad Request')
    await tap.equal(error.details.type, 'Publication')
    await tap.equal(error.details.activity, 'Create Publication')
  })

  await destroyDB(app)
}

module.exports = test
