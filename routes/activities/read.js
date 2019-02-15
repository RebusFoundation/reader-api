const { createActivityObject } = require('./utils')
const { Activity } = require('../../models/Activity')
const { Document } = require('../../models/Document')
const parseurl = require('url').parse

const handleRead = async (req, res, reader) => {
  const body = req.body
  switch (body.object.type) {
    case 'Document':
      const resultDoc = await Document.byShortId(
        parseurl(body.object.id).path.substr(10)
      )
      const activityObjStack = createActivityObject(body, resultDoc, reader)
      Activity.createActivity(activityObjStack)
        .then(activity => {
          res.status(201)
          res.set('Location', activity.url)
          res.end()
        })
        .catch(err => {
          res.status(400).send(`read error: ${err.message}`)
        })
      break

    default:
      res.status(400).send(`cannot read ${body.object.type}`)
      break
  }
}

module.exports = { handleRead }
