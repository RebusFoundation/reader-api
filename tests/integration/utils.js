const jwt = require('jsonwebtoken')
const request = require('supertest')
const fs = require('fs')
const urlparse = require('url').parse
const knexCleaner = require('knex-cleaner')
const { urlToId } = require('../../routes/utils')

const getToken = () => {
  const options = {
    subject: `foo${Date.now()}`,
    expiresIn: '24h',
    issuer: process.env.ISSUER
  }

  return jwt.sign({}, process.env.SECRETORKEY, options)
}

const createUser = async (app, token) => {
  await request(app)
    .post('/readers')
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)
    .send(
      JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        name: 'J. Random Reader'
      })
    )

  const res = await request(app)
    .get('/whoami')
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)

  return res.body.id
}

const destroyDB = async app => {
  if (!process.env.POSTGRE_INSTANCE && process.env.NODE_ENV === 'test') {
    await fs.unlinkSync('./test.sqlite3')
  } else if (process.env.NODE_ENV === 'test') {
    await knexCleaner.clean(app.knex)
  }
}

const getActivityFromUrl = async (app, url, token) => {
  const res = await request(app)
    .get(urlparse(url).path)
    .set('Host', 'reader-api.test')
    .set('Authorization', `Bearer ${token}`)
    .type(
      'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    )

  return res.body
}

module.exports = { getToken, createUser, destroyDB, getActivityFromUrl }
