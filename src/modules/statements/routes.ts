import { FastifyInstance } from 'fastify';
import { generateStatementSchema, getStatementSchema, listAccountStatementsSchema } from './schemas';
import { generateStatement, getStatement, listAccountStatements } from './controller';

async function statementRoutes(fastify: FastifyInstance) {
  // Get statement by ID
  fastify.get('/:id', {
    schema: {
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
                reference: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                format: { type: 'string' },
                status: { type: 'string' },
                data: { type: 'object' },
                account: { type: 'object' },
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
                reference: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                format: { type: 'string' },
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
  }, generateStatement);

  // List account statements
  fastify.get('/:accountId/statements', {
    schema: {
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
                  reference: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string' },
                  format: { type: 'string' },
                  status: { type: 'string' },
                  account: { type: 'object' },
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
  }, listAccountStatements);
}

export default statementRoutes;