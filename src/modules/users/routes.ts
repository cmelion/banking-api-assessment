import { FastifyInstance } from 'fastify';
import { UserController } from './controller';
import { updateUserSchema, userParamsSchema, paginationQuerySchema } from './schemas';

const userController = new UserController();

async function userRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get('/me', {
    schema: {
      description: 'Get current user profile',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                accounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      accountNumber: { type: 'string' },
                      type: { type: 'string' },
                      currency: { type: 'string' },
                      balance: { type: 'number' },
                      status: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: userController.getCurrentUser,
  });

  // Update current user profile
  fastify.patch('/me', {
    schema: {
      description: 'Update current user profile',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
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
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: userController.updateCurrentUser,
  });

  // Get all users (admin only)
  fastify.get('/', {
    schema: {
      description: 'Get all users (admin only)',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
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
                  email: { type: 'string' },
                  name: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' },
                  _count: {
                    type: 'object',
                    properties: {
                      accounts: { type: 'number' },
                    },
                  },
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
    },
    handler: userController.getAllUsers,
  });

  // Get user by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get user by ID',
      tags: ['Users'],
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
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
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                accounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      accountNumber: { type: 'string' },
                      type: { type: 'string' },
                      currency: { type: 'string' },
                      balance: { type: 'number' },
                      status: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: userController.getUserById,
  });
}

export default userRoutes;