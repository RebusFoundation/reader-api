const express = require('express')
const router = express.Router()
const passport = require('passport')
const { Activity } = require('../models/Activity')
const debug = require('debug')('hobb:routes:activity')
// app.use('/', require('./routes/activity'))
const utils = require('./utils')

/**
 * @swagger
 * definition:
 *   activity:
 *     properties:
 *       id:
 *         type: string
 *         format: url
 *       '@context':
 *         type: array
 *       type:
 *         type: string
 *         enum: ['Create', 'Add', 'Remove', 'Delete', 'Update']
 *       object:
 *         type: object
 *         properties:
 *           type:
 *             type: string
 *             enum: ['reader:Publication', 'Document', 'Note', 'reader:Stack']
 *           id:
 *             type: string
 *             format: url
 *       actor:
 *         type: object
 *         properties:
 *           type:
 *             type: string
 *             enum: ['Person']
 *           id:
 *             type: string
 *             format: url
 *       summaryMap:
 *         type: object
 *         properties:
 *           en:
 *             type: string
 *       published:
 *         type: string
 *         format: date-time
 *       updated:
 *         type: string
 *         format: date-time
 *       attributedTo:
 *         type: array
 *
 */

module.exports = function (app) {
  app.use('/', router)

  /**
   * @swagger
   * /activity-{id}:
   *   get:
   *     tags:
   *       - activities
   *     description: GET /activity-:id
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: the short id of the activity
   *     security:
   *       - Bearer: []
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: An Activity object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/definitions/activity'
   *       404:
   *         description: 'No Activity with ID {id}'
   *       403:
   *         description: 'Access to activity {id} disallowed'
   */
  router.get(
    '/activity-:id',
    passport.authenticate('jwt', { session: false }),
    function (req, res, next) {
      const id = req.params.id
      Activity.byId(id)
        .then(activity => {
          if (!activity) {
            res.status(404).send(`No activity with ID ${id}`)
          } else if (!utils.checkReader(req, activity.reader)) {
            res.status(403).send(`Access to activity ${id} disallowed`)
          } else {
            debug(activity)
            res.setHeader(
              'Content-Type',
              'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
            )
            res.end(
              JSON.stringify(
                Object.assign(activity.toJSON(), {
                  '@context': [
                    'https://www.w3.org/ns/activitystreams',
                    { reader: 'https://rebus.foundation/ns/reader' }
                  ]
                })
              )
            )
          }
        })
        .catch(next)
    }
  )
}
