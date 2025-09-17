import { FastifyInstance } from 'fastify';
import { createCardSchema, getCardSchema, listAccountCardsSchema, updateCardSchema } from './schemas';
import { createCard, getCard, listAccountCards, updateCard } from './controller';

async function cardRoutes(fastify: FastifyInstance) {
  // Get card by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get card details by ID',
      tags: ['Cards'],
      params: getCardSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                maskedPan: { type: 'string' },
                brand: { type: 'string' },
                last4: { type: 'string' },
                expMonth: { type: 'number' },
                expYear: { type: 'number' },
                status: { type: 'string' },
                account: {
                  type: 'object',
                  properties: {
                    accountNumber: { type: 'string' },
                    type: { type: 'string' },
                    currency: { type: 'string' }
                  }
                },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getCard);

  // Update card
  fastify.patch('/:id', {
    schema: {
      description: 'Update card information',
      tags: ['Cards'],
      params: getCardSchema,
      body: updateCardSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                maskedPan: { type: 'string' },
                brand: { type: 'string' },
                last4: { type: 'string' },
                expMonth: { type: 'number' },
                expYear: { type: 'number' },
                status: { type: 'string' },
                account: {
                  type: 'object',
                  properties: {
                    accountNumber: { type: 'string' },
                    type: { type: 'string' },
                    currency: { type: 'string' }
                  }
                },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, updateCard);
}

// Register account-specific card routes at the accounts level
export async function accountCardRoutes(fastify: FastifyInstance) {
  // Create card for account
  fastify.post('/:accountId/cards', {
    schema: {
      description: 'Issue a new card for an account',
      tags: ['Cards'],
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      body: createCardSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                maskedPan: { type: 'string' },
                brand: { type: 'string' },
                last4: { type: 'string' },
                expMonth: { type: 'number' },
                expYear: { type: 'number' },
                status: { type: 'string' },
                account: {
                  type: 'object',
                  properties: {
                    accountNumber: { type: 'string' },
                    type: { type: 'string' },
                    currency: { type: 'string' }
                  }
                },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, createCard);

  // List account cards
  fastify.get('/:accountId/cards', {
    schema: {
      description: 'List cards for an account',
      tags: ['Cards'],
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      querystring: listAccountCardsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  maskedPan: { type: 'string' },
                  brand: { type: 'string' },
                  last4: { type: 'string' },
                  expMonth: { type: 'number' },
                  expYear: { type: 'number' },
                  status: { type: 'string' },
                  account: {
                  type: 'object',
                  properties: {
                    accountNumber: { type: 'string' },
                    type: { type: 'string' },
                    currency: { type: 'string' }
                  }
                },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' }
                  }
                }
              }
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, listAccountCards);
}

export default cardRoutes;