import { FastifyInstance } from 'fastify';
import { generateStatementSchema, getStatementSchema, listAccountStatementsSchema } from './schemas';
import { generateStatement, getStatement, listAccountStatements } from './controller';

async function statementRoutes(fastify: FastifyInstance) {
  // Get statement by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get statement details by ID',
      tags: ['Statements'],
      params: getStatementSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                periodStart: { type: 'string' },
                periodEnd: { type: 'string' },
                fileUrl: { type: 'string' },
                account: {
                  type: 'object',
                  properties: {
                    accountNumber: { type: 'string' },
                    type: { type: 'string' },
                    currency: { type: 'string' },
                  },
                },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, getStatement);
}

// Register account-specific statement routes at the accounts level
export async function accountStatementRoutes(fastify: FastifyInstance) {
  // Generate statement for account
  fastify.post('/:accountId/statements/generate', {
    schema: {
      description: 'Generate a new statement for an account',
      tags: ['Statements'],
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      body: generateStatementSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                periodStart: { type: 'string' },
                periodEnd: { type: 'string' },
                fileUrl: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  }, generateStatement);

  // List account statements
  fastify.get('/:accountId/statements', {
    schema: {
      description: 'List statements for an account',
      tags: ['Statements'],
      params: { type: 'object', properties: { accountId: { type: 'string' } } },
      querystring: listAccountStatementsSchema,
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
                  periodStart: { type: 'string' },
                  periodEnd: { type: 'string' },
                  fileUrl: { type: 'string' },
                  account: {
                    type: 'object',
                    properties: {
                      accountNumber: { type: 'string' },
                      type: { type: 'string' },
                    },
                  },
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
  }, listAccountStatements);
}

export default statementRoutes;