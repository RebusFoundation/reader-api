const express = require('express')
const router = express.Router()
const passport = require('passport')
const { Reader } = require('../models/Reader')
const { getId } = require('../utils/get-id.js')
// const debug = require('debug')('hobb:routes:outbox')
const jwtAuth = passport.authenticate('jwt', { session: false })

const utils = require('../utils/utils')
/**
 * @swagger
 * definition:
 *   outbox:
 *     properties:
 *       id:
 *         type: string
 *         format: url
 *       type:
 *         type: string
 *         enum: ['OrderedCollection']
 *       summaryMap:
 *         type: object
 *         properties:
 *           en:
 *             type: string
 *       '@context':
 *         type: array
 *       totalItems:
 *         type: integer
 *       orderedItems:
 *         type: array
 *         items:
 *           $ref: '#/definitions/activity'
 *
 */

module.exports = function (app) {
  app.use('/', router)
  router

    /**
     * @swagger
     * /reader-{readerId}/activity:
     *   get:
     *     tags:
     *       - readers
     *     description: GET /reader-:readerId/activity
     *     parameters:
     *       - in: path
     *         name: readerId
     *         schema:
     *           type: string
     *         required: true
     *         description: the reader id of the reader
     *     security:
     *       - Bearer: []
     *     produces:
     *       - application/json
     *     responses:
     *       200:
     *         description: An outbox with the activity objects for a reader
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/definitions/outbox'
     *       404:
     *         description: 'No Reader with ID {readerId}'
     *       403:
     *         description: 'Access to reader {readerId} disallowed'
     */
    .route('/reader-:readerId/activity')
    .get(jwtAuth, function (req, res, next) {
      const id = req.params.readerId
      Reader.byId(id, '[outbox]')
        .then(reader => {
          if (!reader) {
            res.status(404).send(`No reader with ID ${id}`)
          } else if (!utils.checkReader(req, reader)) {
            res.status(403).send(`Access to reader ${id} disallowed`)
          } else {
            res.setHeader(
              'Content-Type',
              'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
            )
            res.end(
              JSON.stringify({
                '@context': 'https://www.w3.org/ns/activitystreams',
                summaryMap: {
                  en: `Outbox for reader with id ${id}`
                },
                type: 'OrderedCollection',
                id: getId(`/reader-${id}/activity`),
                totalItems: reader.outbox.length,
                orderedItems: reader.outbox.map(item => item.toJSON())
              })
            )
          }
        })
        .catch(err => {
          next(err)
        })
    })
}
