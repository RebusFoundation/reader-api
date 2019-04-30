const parseurl = require('url').parse

const checkReader = (req, reader) => {
  return req.user === reader.authId
}

const urlToId = url => {
  if (!url) return undefined
  if (!url.startsWith('http')) return url
  let path = parseurl(url).path
  if (path.endsWith('/')) path = path.substring(0, path.length - 1)
  return path.substring(path.indexOf('-') + 1)
}

module.exports = { checkReader, urlToId }
