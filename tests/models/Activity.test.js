const tap = require('tap')
const { destroyDB } = require('../integration/utils')
const { Activity } = require('../../models/Activity')
const { Reader } = require('../../models/Reader')
const parseurl = require('url').parse

const test = async app => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const newActivity = Object.assign(new Activity(), {
    type: 'Activity',
    json: {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        { reader: 'https://rebus.foundation/ns/reader' }
      ],
      type: 'Create',
      object: {
        type: 'reader:Publication',
        id: 'https://reader-api.test/publication-m1vGaFVCQTzVBkdLFaxbSm'
      },
      actor: {
        type: 'Person',
        id: 'https://reader-api.test/reader-nS5zw1btwDYT5S6DdvL9yj'
      },
      summaryMap: { en: 'someone created' }
    },
    documentId: null,
    publicationId: 'a2091266-624b-4c46-9066-ce1c642b1898',
    noteId: null,
    published: '2018-12-18T14:56:53.173Z',
    updated: '2018-12-18 14:56:53',
    publication: {
      id: 'a2091266-624b-4c46-9066-ce1c642b1898',
      description: null,
      json: {
        attachment: [],
        type: 'reader:Publication',
        name: 'Publication A',
        attributedTo: [{ type: 'Person', name: 'Sample Author' }]
      },
      readerId: 'b10debec-bfee-438f-a394-25e75457ff62',
      published: '2018-12-18T14:56:53.149Z',
      updated: '2018-12-18 14:56:53'
    },
    document: null,
    note: null
  })

  const reader = Object.assign(new Reader(), {
    id: '123456789abcdef',
    json: { name: 'J. Random Reader', userId: 'auth0|foo1545149868964' },
    userId: 'auth0|foo1545149868964',
    published: '2018-12-18T16:17:49.077Z',
    updated: '2018-12-18 16:17:49'
  })

  const createdReader = await Reader.createReader(
    'auth0|foo1545149868964',
    reader
  )

  newActivity.reader = createdReader
  newActivity.readerId = createdReader.id

  let id

  await tap.test('Create Activity', async () => {
    let response = await Activity.createActivity(newActivity)
    await tap.ok(response)
    await tap.type(response, 'object')
    await tap.equal(response.type, 'Activity')
    id = parseurl(response.url).path.substr(10)
  })

  await tap.test('Get activity by short id', async () => {
    const activity = await Activity.byShortId(id)
    await tap.type(activity, 'object')
    await tap.equal(activity.type, 'Activity')
  })

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
