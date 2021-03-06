const request = require('supertest')
const tap = require('tap')
const {
  getToken,
  createUser,
  destroyDB,
  createSource
} = require('../../utils/testUtils')
const app = require('../../../server').app

const test = async () => {
  const token = getToken()
  await createUser(app, token)

  const createSourceSimplified = async object => {
    return await createSource(app, token, object)
  }

  await createSourceSimplified({
    name: 'Source A',
    author: 'John Smith',
    editor: 'Jane Doe'
  })

  await createSourceSimplified({
    name: 'new book 1',
    author: 'John Doe'
  })
  await createSourceSimplified({
    name: 'new book 2 - the sequel',
    author: `jo H. n'dOe`
  })
  await createSourceSimplified({
    name: 'new book 3',
    author: 'John Smith',
    editor: 'John doe'
  })

  // adding for other attribution types
  await createSourceSimplified({
    name: 'new book 3b',
    contributor: 'John Doe'
  })
  await createSourceSimplified({
    name: 'new book 3c',
    creator: 'John Doe'
  })
  await createSourceSimplified({
    name: 'new book 3d',
    illustrator: 'John Doe'
  })
  await createSourceSimplified({
    name: 'new book 3e',
    publisher: 'John Doe'
  })
  await createSourceSimplified({
    name: 'new book 3f',
    translator: 'John Doe'
  })

  await tap.test('Filter Library by attribution', async () => {
    const res = await request(app)
      .get(`/library?attribution=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
    await tap.equal(res.status, 200)
    await tap.ok(res.body)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 8)
    await tap.ok(Array.isArray(body.items))
    await tap.equal(body.items.length, 8)
    // documents should include:
    await tap.equal(body.items[0].name, 'new book 3f')
    await tap.equal(body.items[1].name, 'new book 3e')
    await tap.equal(body.items[2].name, 'new book 3d')
    await tap.equal(body.items[3].name, 'new book 3c')
    await tap.equal(body.items[4].name, 'new book 3b')
    await tap.equal(body.items[5].type, 'Book')
    await tap.type(body.items[5].id, 'string')
    await tap.type(body.items[5].name, 'string')
    await tap.equal(body.items[5].name, 'new book 3')
    await tap.equal(body.items[5].author[0].name, 'John Smith')
  })

  await tap.test(
    'Filter Library by attribution should work with partial matches',
    async () => {
      const res1 = await request(app)
        .get(`/library?attribution=John d`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res1.body.items.length, 8)
    }
  )

  await createSourceSimplified({
    name: 'new book 4 - the sequel',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 5',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 6',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 7',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 8 - the sequel',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 9',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en', 'km']
  })
  await createSourceSimplified({
    name: 'new book 10',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 11',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 12',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 13',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en']
  })
  await createSourceSimplified({
    name: 'new book 14',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['en', 'fr']
  })
  await createSourceSimplified({
    name: 'new book 15 - the sequel',
    author: 'Jane Smith',
    editor: 'John Doe',
    inLanguage: ['fr']
  })

  await tap.test('Filter by attribution with pagination', async () => {
    const res2 = await request(app)
      .get(`/library?attribution=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res2.body.items.length, 10)

    const res3 = await request(app)
      .get(`/library?attribution=John%20Doe&limit=11`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res3.body.items.length, 11)

    const res4 = await request(app)
      .get(`/library?attribution=John%20Doe&limit=11&page=2`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res4.body.items.length, 9)
  })

  await tap.test(
    'Filter Library by attribution with unknown author',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=XYZABC`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res.statusCode, 200)
      await tap.equal(res.body.items.length, 0)
    }
  )

  // ---------------------------------------- ATTRIBUTION + ROLE -----------------------------------

  await tap.test(
    'Filter Library by attribution and role - author',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=author`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 2)
    }
  )

  await tap.test(
    'Filter Library by attribution and role - editor',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=editor`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 10)
    }
  )

  await tap.test(
    'Filter Library by attribution and role - contributor',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=contributor`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 1)
      await tap.equal(res.body.items[0].name, 'new book 3b')
    }
  )

  await tap.test(
    'Filter Library by attribution and role - creator',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=creator`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 1)
      await tap.equal(res.body.items[0].name, 'new book 3c')
    }
  )

  await tap.test(
    'Filter Library by attribution and role - illustrator',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=illustrator`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 1)
      await tap.equal(res.body.items[0].name, 'new book 3d')
    }
  )

  await tap.test(
    'Filter Library by attribution and role - publisher',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=publisher`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 1)
      await tap.equal(res.body.items[0].name, 'new book 3e')
    }
  )

  await tap.test(
    'Filter Library by attribution and role - translator',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=translator`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)
      await tap.equal(res.body.items.length, 1)
      await tap.equal(res.body.items[0].name, 'new book 3f')
    }
  )

  await tap.test(
    'Filter Library by attribution and role with pagination',
    async () => {
      const res2 = await request(app)
        .get(`/library?attribution=John%20D&role=editor`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res2.body.items.length, 10)

      const res3 = await request(app)
        .get(`/library?attribution=John%20D&role=editor&page=2`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res3.body.items.length, 3)
    }
  )

  await tap.test(
    'Filter Library by attribution with invalid role returns empty library',
    async () => {
      const res = await request(app)
        .get(`/library?attribution=John%20D&role=autho`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')

      await tap.equal(res.statusCode, 200)
      await tap.equal(res.body.items.length, 0)
    }
  )

  // ------------------------------------------ AUTHOR ---------------------------------------

  await tap.test('Filter Library by author', async () => {
    const res = await request(app)
      .get(`/library?author=John%20Doe`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')
    await tap.equal(res.status, 200)
    await tap.ok(res.body)

    const body = res.body
    await tap.type(body, 'object')
    await tap.type(body.totalItems, 'number')
    await tap.equal(body.totalItems, 2)
    await tap.ok(Array.isArray(body.items))
    await tap.equal(body.items.length, 2)
    // documents should include:
    await tap.equal(body.items[0].type, 'Book')
    await tap.type(body.items[0].id, 'string')
    await tap.type(body.items[0].name, 'string')
    await tap.equal(body.items[0].name, 'new book 2 - the sequel')
    await tap.equal(body.items[0].author[0].name, `jo H. n'dOe`)
  })

  await tap.test('Filter Library by author with pagination', async () => {
    const res2 = await request(app)
      .get(`/library?author=JaneSmith`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res2.body.items.length, 10)

    const res3 = await request(app)
      .get(`/library?author=JaneSmith&limit=11`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res3.body.items.length, 11)

    const res4 = await request(app)
      .get(`/library?author=JaneSmith&limit=11&page=2`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type('application/ld+json')

    await tap.equal(res4.body.items.length, 1)
  })

  await tap.test(
    'Filter Library by author should not work with partial matches',
    async () => {
      const res = await request(app)
        .get(`/library?author=Doe`)
        .set('Host', 'reader-api.test')
        .set('Authorization', `Bearer ${token}`)
        .type('application/ld+json')
      await tap.equal(res.status, 200)
      await tap.ok(res.body)

      const body = res.body
      await tap.type(body, 'object')
      await tap.equal(body.items.length, 0)
    }
  )

  await destroyDB(app)
}

module.exports = test
