import { FastifyInstance } from 'fastify';
import { createTransferSchema, getTransferSchema, listTransfersSchema, cancelTransferSchema } from './schemas';
import { createTransfer, getTransfer, listTransfers, cancelTransfer } from './controller';

async function transferRoutes(fastify: FastifyInstance) {
  // Create transfer
  fastify.post('/', {
    schema: {
      body: createTransferSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fromAccountId: { type: 'string' },
                toAccountId: { type: 'string' },
                amount: { type: 'string' },
                currency: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
                fromAccount: { type: 'object' },
                toAccount: { type: 'object' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, createTransfer);

  // List transfers
  fastify.get('/', {
    schema: {
      querystring: listTransfersSchema,
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
                  fromAccountId: { type: 'string' },
                  toAccountId: { type: 'string' },
                  amount: { type: 'string' },
                  currency: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string' },
                  direction: { type: 'string' },
                  fromAccount: { type: 'object' },
                  toAccount: { type: 'object' },
                  createdAt: { type: 'string' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, listTransfers);

  // Get transfer by ID
  fastify.get('/:id', {
    schema: {
      params: getTransferSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fromAccountId: { type: 'string' },
                toAccountId: { type: 'string' },
                amount: { type: 'string' },
                currency: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
                fromAccount: { type: 'object' },
                toAccount: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getTransfer);

  // Cancel transfer
  fastify.patch('/:id/cancel', {
    schema: {
      params: cancelTransferSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                cancelledAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, cancelTransfer);
}

export default transferRoutes;