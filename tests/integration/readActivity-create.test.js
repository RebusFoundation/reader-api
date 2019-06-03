const request = require('supertest')
const tap = require('tap')
const urlparse = require('url').parse
const {
  getToken,
  createUser,
  destroyDB,
  getActivityFromUrl,
  createPublication
} = require('../utils/utils')
const { Document } = require('../../models/Document')
const { Reader } = require('../../models/Reader')
const { ReadActivity } = require('../../models/ReadActivity')
const { urlToId } = require('../../utils/utils')

const test = async app => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const token = getToken()
  const readerId = await createUser(app, token)
  const readerUrl = urlparse(readerId).path

  // Create Reader object
  const person = {
    name: 'J. Random Reader'
  }
  const reader1 = await Reader.createReader(readerId, person)

  // Create Publication
  const resActivity = await createPublication(app, token, readerUrl)

  const activityUrl2 = resActivity.get('Location')
  const activityObject = await getActivityFromUrl(app, activityUrl2, token)
  const publicationUrl = activityObject.object.id

  const resPublication = await request(app)
    .get(urlparse(publicationUrl).path)
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)
    .type(
      'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    )

  // Create Document
  const documentObject = {
    mediaType: 'txt',
    url: 'http://google-bucket/somewhere/file1234.txt',
    documentPath: '/inside/the/book.txt',
    json: { property1: 'value1' }
  }

  const document = await Document.createDocument(
    reader1,
    resPublication.body.id,
    documentObject
  )

  await tap.test('Create Read activity with only a selector', async () => {
    const readActivity = await request(app)
      .post(`${readerUrl}/activity`)
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
          type: 'Read',
          context: publicationUrl,
          'oa:hasSelector': {
            type: 'XPathSelector',
            value: '/html/body/p[2]/table/tr[2]/td[3]/span'
          }
        })
      )

    // Get the latests ReadActivity
    const latestAct = await ReadActivity.getLatestReadActivity(
      urlToId(publicationUrl)
    )
    await tap.equal(readActivity.statusCode, 201)
    await tap.type(readActivity.get('Location'), 'string')
    await tap.equal(latestAct.id, readActivity.get('Location'))
    await tap.equal(latestAct.readerId, reader1.authId)
    await tap.equal(latestAct.publicationId, publicationUrl)
  })

  await tap.test('Create a ReadActivity with json', async () => {
    const readActivity = await request(app)
      .post(`${readerUrl}/activity`)
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
          type: 'Read',
          context: publicationUrl,
          'oa:hasSelector': {
            type: 'XPathSelector',
            value: '/html/body/p[2]/table/tr[2]/td[3]/span'
          },
          json: { property: 'value' }
        })
      )

    // Get the latests ReadActivity
    const latestAct = await ReadActivity.getLatestReadActivity(
      urlToId(publicationUrl)
    )

    await tap.equal(readActivity.statusCode, 201)
    await tap.equal(latestAct.json.property, 'value')
  })

  await tap.test('Create a ReadActivity with invalid pubId', async () => {
    const res = await request(app)
      .post(`${readerUrl}/activity`)
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
          type: 'Read',
          context: publicationUrl + 'abc',
          'oa:hasSelector': {
            type: 'XPathSelector',
            value: '/html/body/p[2]/table/tr[2]/td[3]/span'
          },
          json: { property: 'value' }
        })
      )

    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Publication')
    await tap.type(error.details.id, 'string')
    await tap.equal(error.details.activity, 'Read')
  })

  await tap.test('Create a ReadActivity with invalid readerId', async () => {
    const res = await request(app)
      .post(`${readerUrl}abc/activity`)
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
          type: 'Read',
          context: publicationUrl,
          'oa:hasSelector': {
            type: 'XPathSelector',
            value: '/html/body/p[2]/table/tr[2]/td[3]/span'
          },
          json: { property: 'value' }
        })
      )

    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Reader')
    await tap.type(error.details.id, 'string')
  })

  await destroyDB(app)
  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
}

module.exports = test
