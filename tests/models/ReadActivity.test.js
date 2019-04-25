const tap = require('tap')
const { destroyDB } = require('../integration/utils')
const { Activity } = require('../../models/Activity')
const { ReadActivity } = require('../../models/ReadActivity')
const { Reader } = require('../../models/Reader')
const { Publication } = require('../../models/Publication')
const crypto = require('crypto')
const { urlToId } = require('../../routes/utils')

const test = async app => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const reader = {
    name: 'J. Random Reader'
  }
  const random = crypto.randomBytes(13).toString('hex')

  const createdReader = await Reader.createReader(`auth0|foo${random}`, reader)

  const simplePublication = {
    type: 'reader:Publication',
    name: 'Publication A',
    readingOrder: [
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Link',
        href: 'http://example.org/abc',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example link'
      },
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Link',
        href: 'http://example.org/abc2',
        hreflang: 'en',
        mediaType: 'text/html',
        name: 'An example link2'
      }
    ]
  }

  const publication = await Publication.createPublication(
    createdReader,
    simplePublication
  )

  const selectorJsonObject = {
    selector: { property: 'value' },
    json: { anotherProperty: 88 }
  }

  const selectorObject = {
    selector: { property: 'someValue' }
  }

  let id

  await tap.test('Create ReadActivity with selector and json', async () => {
    let readActivity = await ReadActivity.createReadActivity(
      createdReader.id,
      publication.id,
      selectorJsonObject
    )

    await tap.ok(readActivity)
    await tap.equal(readActivity.readerId, createdReader.id)
    await tap.equal(readActivity.publicationId, publication.id)
    await tap.equal(readActivity.selector.property, 'value')
    await tap.equal(readActivity.json.anotherProperty, 88)
  })

  await tap.test('Create ReadActivity with selector only', async () => {
    let readActivity = await ReadActivity.createReadActivity(
      createdReader.id,
      publication.id,
      selectorObject
    )

    await tap.ok(readActivity)
    await tap.equal(readActivity.readerId, createdReader.id)
    await tap.equal(readActivity.publicationId, publication.id)
    await tap.equal(readActivity.selector.property, 'someValue')
    await tap.equal(readActivity.json, null)
  })

  await tap.test('Create ReadActivity with non-existent readerId', async () => {
    let readActivity = await ReadActivity.createReadActivity(
      createdReader.id + 'RandomString',
      publication.id,
      selectorObject
    )

    await tap.ok(typeof readActivity, Error)
    await tap.equal(readActivity.message, 'no reader')
  })

  await tap.test(
    'Create ReadActivity with non-existent publicationId',
    async () => {
      let readActivity = await ReadActivity.createReadActivity(
        createdReader.id,
        publication.id + 'AnotherRandomString',
        selectorObject
      )

      await tap.ok(typeof readActivity, Error)
      await tap.equal(readActivity.message, 'no publication')
    }
  )

  await tap.test('Get latests ReadActivity of a publication', async () => {
    const newReader = {
      name: 'Latest Reader'
    }
    const random = crypto.randomBytes(13).toString('hex')
    const latestReader = await Reader.createReader(
      `auth0|foo${random}`,
      newReader
    )

    const lastReadActivity = await ReadActivity.createReadActivity(
      latestReader.id,
      publication.id,
      selectorJsonObject
    )

    console.log('lastReadActivity readerId: ' + lastReadActivity.readerId)

    let readActivity = await ReadActivity.getLatestReadActivity(publication.id)

    console.log('is it an array ' + readActivity[0].readerId)

    console.log('readActivity readerId ' + readActivity.readerId)

    await tap.ok(readActivity)
    await tap.equal(readActivity.readerId, lastReadActivity.readerId)
  })

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
