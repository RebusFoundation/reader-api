const libraryTests = require('./library.test')
const createPublicationTests = require('./createPublications.test')
const readerProfileTests = require('./getReaderProfile.test')
const createDocumentTests = require('./createDocuments.test')
const createNotesTests = require('./createNotes.test')
const getDocumentWithNotesTests = require('./getDocumentWithNotes.test')
const createTagsTests = require('./createTags.test')
const addPubToCollectionTests = require('./addPubToCollection.test')

const app = require('../../server').app

require('dotenv').config()

const allTests = async () => {
  if (process.env.POSTGRE_INSTANCE) {
    await app.initialize(true)
    await app.knex.migrate.rollback()
    if (process.env.POSTGRE_DB === 'travis_ci_test') {
      await app.knex.migrate.latest()
    }
  }

  await libraryTests(app)
  await readerProfileTests(app)
  await createPublicationTests(app)
  await createDocumentTests(app)
  await createNotesTests(app)
  await getDocumentWithNotesTests(app)
  await createTagsTests(app)
  await addPubToCollectionTests(app)

  if (process.env.POSTGRE_INSTANCE) {
    await app.knex.migrate.rollback()
    await app.terminate()
  }
}

allTests()
