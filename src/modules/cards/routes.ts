import { FastifyInstance } from 'fastify';
import { createCardSchema, getCardSchema, listAccountCardsSchema, updateCardSchema } from './schemas';
import { createCard, getCard, listAccountCards, updateCard } from './controller';

async function cardRoutes(fastify: FastifyInstance) {
  // Get card by ID
  fastify.get('/:id', {
    schema: {
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
                type: { type: 'string' },
                design: { type: 'string' },
                maskedCardNumber: { type: 'string' },
                expiryDate: { type: 'string' },
                status: { type: 'string' },
                account: { type: 'object' },
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
                type: { type: 'string' },
                design: { type: 'string' },
                maskedCardNumber: { type: 'string' },
                expiryDate: { type: 'string' },
                status: { type: 'string' },
                account: { type: 'object' },
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
                type: { type: 'string' },
                design: { type: 'string' },
                maskedCardNumber: { type: 'string' },
                expiryDate: { type: 'string' },
                status: { type: 'string' },
                account: { type: 'object' },
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
                  type: { type: 'string' },
                  design: { type: 'string' },
                  maskedCardNumber: { type: 'string' },
                  expiryDate: { type: 'string' },
                  status: { type: 'string' },
                  account: { type: 'object' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, listAccountCards);
}

export default cardRoutes;