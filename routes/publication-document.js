const express = require('express')
const router = express.Router()
const passport = require('passport')
const { Publication } = require('../models/Publication')
const utils = require('../utils/utils')
const { Document } = require('../models/Document')

/**
 * @swagger
 * /publication-{id}/{path}:
 *   get:
 *     tags:
 *       - publications
 *     description: GET /publication-:id/:path
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: the short id of the publication
 *       - in: path
 *         name: path
 *         schema:
 *           type: string
 *         required: true
 *         description: the relative path to the document within the publication
 *     security:
 *       - Bearer: []
 *     reponses:
 *       302: redirected to document
 *       403: Access to publication {id} disallowed
 *       404: Publication or Document not found
 */
module.exports = function (app) {
  app.use('/', router)
  router.get(
    '/publication-:id/:path(([^/]+)*)',
    passport.authenticate('jwt', { session: false }),
    function (req, res, next) {
      const id = req.params.id
      Publication.byId(id)
        .then(publication => {
          if (!publication || publication.deleted) {
            res.status(404).send(`No publication with ID ${id}`)
          } else if (!utils.checkReader(req, publication.reader)) {
            res.status(403).send(`Access to publication ${id} disallowed`)
          } else {
            return Document.byPath(id, req.params.path)
          }
        })
        .then(document => {
          if (!document) {
            res
              .status(404)
              .send(`No document found with path ${req.params.path}`)
          }
          res.redirect(document.url)
        })
        .catch(next)
    }
  )
}