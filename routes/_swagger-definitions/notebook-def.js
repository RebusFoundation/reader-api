/**
 * @swagger
 * definition:
 *   notebook-input:
 *     properties:
 *       name:
 *         type: string
 *       description:
 *         type: string
 *       status:
 *         type: string
 *         enum: ['active', 'archived']
 *         default: 'active'
 *       settings:
 *         type: object
 *     required:
 *       - name
 *       - status
 *
 *   notebook-ref:
 *     allOf:
 *       - $ref: '#/definitions/notebook-input'
 *     properties:
 *       id:
 *         type: string
 *         format: url
 *         readOnly: true
 *       readerId:
 *         type: string
 *         format: url
 *         readOnly: true
 *       tags:
 *         type: array
 *         items:
 *           $ref: '#/definitions/tag'
 *         readOnly: true
 *         description: tags assigned to this notebook
 *       published:
 *         type: string
 *         format: date-time
 *         readOnly: true
 *       updated:
 *         type: string
 *         format: date-time
 *         readOnly: true
 *   required:
 *     - id
 *     - published
 *     - readerId
 *
 *   notebook:
 *     allOf:
 *       - $ref: '#/definitions/notebook-ref'
 *     properties:
 *       notebookTags:
 *         type: array
 *         items:
 *           $ref: '#/definitions/tag'
 *         readOnly: true
 *         description: tags that belong to the notebook
 *       sources:
 *         type: array
 *         items:
 *           $ref: '#/definitions/source'
 *         readOnly: true
 *         description: sources assigned to the notebook
 *       notes:
 *         type: array
 *         items:
 *           $ref: '#/definitions/note'
 *         readOnly: true
 *         description: notes assigned to the notebook
 *       noteContexts:
 *         type: array
 *         items:
 *           $ref: '#/definitions/noteContext'
 *         readOnly: true
 *         description: noteContexts that belong to this notebook
 *
 *   notebook-list:
 *     properties:
 *       page:
 *         type: integer
 *       pageSize:
 *         type: integer
 *       totalItems:
 *         type: integer
 *       items:
 *         type: array
 *         items:
 *           $ref: '#/definitions/notebook-ref'
 *
 */
