import Fastify, { FastifyInstance } from 'fastify';
import { serverConfig, apiConfig, features } from './config';

// Plugins
import loggingPlugin from './plugins/logging';
import healthPlugin from './plugins/health';
import errorHandlerPlugin from './plugins/error-handler';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: true,
    disableRequestLogging: true, // We handle this in our logging plugin
  });

  // Register core plugins
  await app.register(loggingPlugin);
  await app.register(errorHandlerPlugin);

  // Register CORS
  await app.register(import('@fastify/cors'), {
    origin: serverConfig.corsOrigin === '*' ? true : serverConfig.corsOrigin.split(','),
    credentials: true,
  });

  // Register sensible defaults
  await app.register(import('@fastify/sensible'));

  // Register JWT support
  await app.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET as string,
  });

  // Add JWT verification decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Register health checks (before auth)
  await app.register(healthPlugin);

  // Register Swagger documentation (development only)
  if (features.swaggerDocs) {
    await app.register(import('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Banking API',
          description: 'Production-ready banking REST service',
          version: '1.0.0',
        },
        host: `localhost:${serverConfig.port}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'Authentication', description: 'User authentication and authorization' },
          { name: 'Users', description: 'User profile and management' },
          { name: 'Accounts', description: 'Bank account management and operations' },
          { name: 'Transactions', description: 'Transaction history and details' },
          { name: 'Transfers', description: 'Money transfers between accounts' },
          { name: 'Cards', description: 'Credit and debit card management' },
          { name: 'Statements', description: 'Account statement generation and access' },
        ],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Enter JWT token with Bearer prefix',
          },
        },
      },
    });

    await app.register(import('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  // API route registration
  await app.register(async function (fastify) {
    // Auth routes (no auth required)
    await fastify.register(
      async function (fastify) {
        const { default: authRoutes } = await import('./modules/auth/routes');
        await fastify.register(authRoutes);
      },
      { prefix: `${apiConfig.prefix}/auth` }
    );

    // Protected routes (auth required)
    await fastify.register(
      async function (fastify) {
        // JWT authentication middleware
        await fastify.addHook('onRequest', async (request, reply) => {
          try {
            await request.jwtVerify();
          } catch (err) {
            reply.send(err);
          }
        });

        // User routes
        await fastify.register(
          async function (fastify) {
            const { default: userRoutes } = await import('./modules/users/routes');
            await fastify.register(userRoutes);
          },
          { prefix: `${apiConfig.prefix}/users` }
        );

        // Account routes
        await fastify.register(
          async function (fastify) {
            const { default: accountRoutes } = await import('./modules/accounts/routes');
            await fastify.register(accountRoutes);
          },
          { prefix: `${apiConfig.prefix}/accounts` }
        );

        // Transaction routes
        await fastify.register(
          async function (fastify) {
            const { default: transactionRoutes } = await import('./modules/transactions/routes');
            await fastify.register(transactionRoutes);
          },
          { prefix: `${apiConfig.prefix}/transactions` }
        );

        // Transfer routes
        await fastify.register(
          async function (fastify) {
            const { default: transferRoutes } = await import('./modules/transfers/routes');
            await fastify.register(transferRoutes);
          },
          { prefix: `${apiConfig.prefix}/transfers` }
        );

        // Card routes
        await fastify.register(
          async function (fastify) {
            const { default: cardRoutes } = await import('./modules/cards/routes');
            await fastify.register(cardRoutes);
          },
          { prefix: `${apiConfig.prefix}/cards` }
        );

        // Statement routes
        await fastify.register(
          async function (fastify) {
            const { default: statementRoutes } = await import('./modules/statements/routes');
            await fastify.register(statementRoutes);
          },
          { prefix: `${apiConfig.prefix}/statements` }
        );
      }
    );
  });

  return app;
}

export default createApp;