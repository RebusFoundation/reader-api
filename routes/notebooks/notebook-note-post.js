const express = require('express')
const router = express.Router()
const passport = require('passport')
const { Reader } = require('../../models/Reader')
const jwtAuth = passport.authenticate('jwt', { session: false })
const { Note } = require('../../models/Note')
const boom = require('@hapi/boom')
const _ = require('lodash')
const { ValidationError } = require('objection')
const { checkOwnership, urlToId } = require('../../utils/utils')
const debug = require('debug')('ink:routes:notebook-note-post')
const { Note_Tag } = require('../../models/Note_Tag')
const { Tag } = require('../../models/Tag')
const { notesCacheUpdate, notebooksCacheUpdate } = require('../../utils/cache')

module.exports = function (app) {
  /**
   * @swagger
   * /notebooks/{notebookId}/notes:
   *   post:
   *     tags:
   *       - notebook-note
   *     description: Create a note and assign it to a Notebook
   *     security:
   *       - Bearer: []
   *     parameters:
   *       - in: path
   *         name: notebookId
   *         schema:
   *           type: string
   *         required: true
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/definitions/note'
   *     responses:
   *       201:
   *         description: Successfully created Note and assigned it to Notebook
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/definitions/note'
   *       400:
   *         description: Validation error
   *       401:
   *         description: 'No Authentication'
   *       403:
   *         description: 'Access to reader {id} disallowed'
   *       404:
   *         description: Notebook or Source not found
   */
  app.use('/', router)
  router
    .route('/notebooks/:notebookId/notes')
    .post(jwtAuth, function (req, res, next) {
      const notebookId = req.params.notebookId
      debug('notebookId', notebookId)
      debug('request body: ', req.body)
      Reader.byAuthId(req.user)
        .then(async reader => {
          if (!reader || reader.deleted) {
            return next(
              boom.notFound(`No reader found with this token`, {
                requestUrl: req.originalUrl,
                requestBody: req.body
              })
            )
          }

          if (!checkOwnership(reader.id, notebookId)) {
            return next(
              boom.forbidden(`Access to Notebook ${notebookId} disallowed`, {
                requestUrl: req.originalUrl
              })
            )
          }

          const body = req.body
          if (typeof body !== 'object' || _.isEmpty(body)) {
            return next(
              boom.badRequest('Body must be a JSON object', {
                requestUrl: req.originalUrl,
                requestBody: req.body
              })
            )
          }

          let createdNote
          try {
            createdNote = await Note.createNoteInNotebook(
              reader,
              notebookId,
              body
            )

            let tags
            if (body.tags) {
              let newTags = body.tags.filter(tag => {
                return !tag.id
              })
              if (newTags) {
                newTags = await Tag.createMultipleTags(
                  createdNote.readerId,
                  newTags
                )
              }
              tags = body.tags.filter(tag => !!tag.id).concat(newTags)
              let tagIds = tags.map(tag => tag.id)
              await Note_Tag.addMultipleTagsToNote(
                urlToId(createdNote.id),
                tagIds
              )
            }

            debug('created Note', createdNote)
          } catch (err) {
            if (err instanceof ValidationError) {
              return next(
                boom.badRequest(
                  `Validation Error on Create Note: ${err.message}`,
                  {
                    requestUrl: req.originalUrl,
                    requestBody: req.body,
                    validation: err.data
                  }
                )
              )
            } else if (err.message === 'no source') {
              return next(
                boom.notFound(
                  `Create Note Error: No Source found with id: ${
                    body.sourceId
                  }`,
                  {
                    requestUrl: req.originalUrl,
                    requestBody: req.body
                  }
                )
              )
            } else if (err.message === 'no notebook') {
              return next(
                boom.notFound(
                  `Create Note Error: No Notebook found with id: ${notebookId}`,
                  {
                    requestUrl: req.originalUrl,
                    requestBody: req.body
                  }
                )
              )
            } else {
              return next(
                boom.badRequest(err.message, {
                  requestUrl: req.originalUrl,
                  requestBody: req.body
                })
              )
            }
          }
          await notesCacheUpdate(reader.authId)
          await notebooksCacheUpdate(reader.authId)
          res.setHeader('Content-Type', 'application/ld+json')
          res.setHeader('Location', createdNote.id)
          res.status(201).end(JSON.stringify(createdNote.toJSON()))
        })
        .catch(err => {
          next(err)
        })
    })
}
