import { FastifyInstance } from 'fastify';
import { getTransactionSchema } from './schemas';
import { getAccountTransactions, getTransaction, getAccountTransactionSummary } from './controller';

async function transactionRoutes(fastify: FastifyInstance) {
  // Get transaction by ID
  fastify.get('/:id', {
    schema: {
      params: getTransactionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                accountId: { type: 'string' },
                type: { type: 'string' },
                amount: { type: 'string' },
                currency: { type: 'string' },
                description: { type: 'string', nullable: true },
                counterparty: { type: 'string', nullable: true },
                balanceAfter: { type: 'string' },
                createdAt: { type: 'string' },
                account: { type: 'object' },
                transfer: { type: 'object', nullable: true },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getTransaction);
}

// Register account-specific transaction routes at the accounts level
export async function accountTransactionRoutes(fastify: FastifyInstance) {
  // Get account transactions
  fastify.get('/:accountId/transactions', {
    schema: {
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          type: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          search: { type: 'string', minLength: 1 },
        },
      },
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
                  amount: { type: 'string' },
                  currency: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  counterparty: { type: 'string', nullable: true },
                  balanceAfter: { type: 'string' },
                  createdAt: { type: 'string' },
                  transfer: { type: 'object', nullable: true },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getAccountTransactions);

  // Get account transaction summary
  fastify.get('/:accountId/transactions/summary', {
    schema: {
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                period: { type: 'object' },
                summary: { type: 'object' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getAccountTransactionSummary);
}

export default transactionRoutes;