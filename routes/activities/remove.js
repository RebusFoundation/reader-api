const { createActivityObject } = require('./utils')
const { Publication_Tag } = require('../../models/Publications_Tags')
const { Activity } = require('../../models/Activity')

const handleRemove = async (req, res, reader) => {
  const body = req.body
  switch (body.object.type) {
    case 'reader:Stack':
      let resultStack

      // Determine where the Tag is removed from
      if (body.target.type === 'publication') {
        resultStack = await Publication_Tag.removeTagFromPub(
          body.target.id,
          body.object.id
        )
      } else if (body.target.type === 'note') {
        console.log('Removing a note')

        console.log('note id ' + body.target.id)
        console.log('tag id: ' + body.object.id)
        resultStack = await Note_Tag.removeTagFromNote(
          body.target.id,
          body.object.id
        )

        console.log('resutl stack')
        console.log(resultStack)
      }

      if (resultStack instanceof Error) {
        switch (resultStack.message) {
          case 'no publication':
            res.status(404).send(`no publication provided`)
            break

          case 'no tag':
            res.status(404).send(`no tag provided`)
            break

          case 'no note':
            res.status(404).send(`no note provided`)
            break

          case 'not found':
            res
              .status(404)
              .send(
                `no relationship found between tag ${
                  body.object.id
                } and publication ${body.target.id}`
              )
            break

          default:
            res
              .status(400)
              .send(
                `remove tag from ` + body.target.type + ` error: ${err.message}`
              )
            break
        }
        break
      }

      const activityObjStack = createActivityObject(body, resultStack, reader)
      Activity.createActivity(activityObjStack)
        .then(activity => {
          res.status(201)
          res.set('Location', activity.url)
          res.end()
        })
        .catch(err => {
          res.status(400).send(`create activity error: ${err.message}`)
        })
      break

    default:
      res.status(400).send(`cannot remove ${body.object.type}`)
      break
  }
}

module.exports = { handleRemove }
