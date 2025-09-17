import { FastifyInstance } from 'fastify';
import { createTransferSchema, getTransferSchema, listTransfersSchema, cancelTransferSchema } from './schemas';
import { createTransfer, getTransfer, listTransfers, cancelTransfer } from './controller';

async function transferRoutes(fastify: FastifyInstance) {
  // Create transfer
  fastify.post('/', {
    schema: {
      description: 'Create a money transfer between accounts',
      tags: ['Transfers'],
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
      description: 'List transfers for the authenticated user',
      tags: ['Transfers'],
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
                    hasPrev: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, listTransfers);

  // Get transfer by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get transfer details by ID',
      tags: ['Transfers'],
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
      description: 'Cancel a pending transfer',
      tags: ['Transfers'],
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