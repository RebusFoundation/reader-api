const request = require('supertest')
const tap = require('tap')
const {
  getToken,
  destroyDB,
  createNotebook,
  createNoteContext,
  createCollaborator,
  createReader,
  addNoteToContext
} = require('../../utils/testUtils')

const test = async app => {
  // owner, collab1, collab2
  const token = getToken()
  await createReader(app, token)
  const token2 = getToken()
  const collab1 = await createReader(app, token2) // will be pending
  const token3 = getToken()
  const collab2 = await createReader(app, token3) // will be accepted

  const notebook = await createNotebook(app, token, {
    name: 'notebook1',
    status: 'archived',
    description: 'test',
    settings: {
      property: 'value'
    }
  })

  await createCollaborator(app, token, notebook.shortId, {
    readerId: collab1.shortId,
    status: 'pending',
    permission: { read: true }
  })

  await createCollaborator(app, token, notebook.shortId, {
    readerId: collab2.shortId,
    status: 'accepted',
    permission: { read: true }
  })

  // add sources to the notebook
  const context1 = await createNoteContext(app, token, {
    type: 'test',
    notebookId: notebook.shortId
  })

  const outline1 = await createNoteContext(app, token, {
    type: 'outline',
    notebookId: notebook.shortId
  })

  await tap.test(
    'Accepted collaborator should be able to get a noteContext in the notebook',
    async () => {
      const res = await request(app)
        .get(`/noteContexts/${context1.shortId}`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token3}`)
        .type('application/ld+json')

      await tap.equal(res.status, 200)
      const body = res.body
      await tap.equal(body.type, 'test')
    }
  )

  await tap.test(
    'Accepted collaborator should be able to get an outline in the notebook',
    async () => {
      const res = await request(app)
        .get(`/outlines/${outline1.shortId}`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token3}`)
        .type('application/ld+json')

      await tap.equal(res.status, 200)
      const body = res.body
      await tap.equal(body.type, 'outline')
    }
  )

  const note1 = await addNoteToContext(app, token, context1.shortId, {
    body: { motivation: 'test', content: 'abc' }
  })

  await tap.test(
    'Accepted collaborator should be able to get a note within a noteContext',
    async () => {
      const res = await request(app)
        .get(`/notes/${note1.shortId}`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token3}`)
        .type('application/ld+json')

      await tap.equal(res.status, 200)
      const body = res.body
      await tap.equal(body.body[0].content, 'abc')
    }
  )

  const note2 = await addNoteToContext(app, token, outline1.shortId, {
    body: { motivation: 'test', content: 'def' }
  })

  await tap.test(
    'Accepted collaborator should be able to get a note within an outline',
    async () => {
      const res = await request(app)
        .get(`/notes/${note2.shortId}`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token3}`)
        .type('application/ld+json')

      await tap.equal(res.status, 200)
      const body = res.body
      await tap.equal(body.body[0].content, 'def')
    }
  )

  await destroyDB(app)
}

module.exports = test
