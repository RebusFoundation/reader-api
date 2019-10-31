const redis = require('redis')
const { urlToId } = require('./utils')

let libraryCacheGet = () => undefined
let libraryCacheUpdate = () => undefined
let quitCache

if (process.env.REDIS_PASSWORD) {
  const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  })

  const { promisify } = require('util')
  const getAsync = promisify(client.get).bind(client)
  const setASync = promisify(client.set).bind(client)

  libraryCacheUpdate = async readerId => {
    readerId = urlToId(readerId)
    return await setASync(
      `${readerId}-library`,
      new Date().getTime(),
      'EX',
      3600
    )
  }

  libraryCacheGet = async (readerId, check) => {
    if (!check) return undefined // so we can skip when the 'if-modified-since' header is not used'
    readerId = urlToId(readerId)
    return await getAsync(`${readerId}-library`)
  }

  quitCache = () => {
    client.quit()
  }
}

module.exports = { libraryCacheUpdate, libraryCacheGet, quitCache }
