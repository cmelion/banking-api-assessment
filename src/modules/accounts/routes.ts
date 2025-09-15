import { FastifyInstance } from 'fastify';
import { createAccountSchema, getAccountSchema, listAccountsSchema, updateAccountSchema } from './schemas';
import { createAccount, getAccount, listAccounts, updateAccount, getAccountBalance } from './controller';
import { accountTransactionRoutes } from '../transactions/routes';
import { accountCardRoutes } from '../cards/routes';
import { accountStatementRoutes } from '../statements/routes';

async function accountRoutes(fastify: FastifyInstance) {
  // Create account
  fastify.post('/', {
    schema: {
      description: 'Create a new bank account',
      tags: ['Accounts'],
      body: createAccountSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                accountNumber: { type: 'string' },
                type: { type: 'string' },
                currency: { type: 'string' },
                balance: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, createAccount);

  // List accounts
  fastify.get('/', {
    schema: {
      description: 'List user accounts with pagination',
      tags: ['Accounts'],
      querystring: listAccountsSchema,
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
                  accountNumber: { type: 'string' },
                  type: { type: 'string' },
                  currency: { type: 'string' },
                  balance: { type: 'string' },
                  status: { type: 'string' },
                  transactionCount: { type: 'number' },
                  cardCount: { type: 'number' },
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
  }, listAccounts);

  // Get account by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get account details by ID',
      tags: ['Accounts'],
      params: getAccountSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                accountNumber: { type: 'string' },
                type: { type: 'string' },
                currency: { type: 'string' },
                balance: { type: 'string' },
                status: { type: 'string' },
                owner: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getAccount);

  // Update account
  fastify.patch('/:id', {
    schema: {
      description: 'Update account information',
      tags: ['Accounts'],
      params: getAccountSchema,
      body: updateAccountSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                accountNumber: { type: 'string' },
                type: { type: 'string' },
                currency: { type: 'string' },
                balance: { type: 'string' },
                status: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, updateAccount);

  // Get account balance
  fastify.get('/:id/balance', {
    schema: {
      description: 'Get current account balance',
      tags: ['Accounts'],
      params: getAccountSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                balance: { type: 'string' },
                currency: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getAccountBalance);

  // Register account transaction routes
  await fastify.register(accountTransactionRoutes);

  // Register account card routes
  await fastify.register(accountCardRoutes);

  // Register account statement routes
  await fastify.register(accountStatementRoutes);
}

export default accountRoutes;