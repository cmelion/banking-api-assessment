import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';
// logConfig imported but used for future log configuration

async function loggingPlugin(fastify: FastifyInstance) {
  // Skip logging hooks during tests
  const isTest = process.env.NODE_ENV === 'test';

  // Add correlation ID to all requests
  fastify.addHook('onRequest', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] as string || randomUUID();
    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);

    // Add to request context
    (request as any).correlationId = correlationId;
  });

  if (!isTest) {
    // Log all requests
    fastify.addHook('onRequest', async (request, _reply) => {
      request.log.info({
        correlationId: (request as any).correlationId,
        userId: (request as any).user?.userId,
      }, 'Request received');
    });

    // Log all responses
    fastify.addHook('onResponse', async (request, reply) => {
      request.log.info({
        correlationId: (request as any).correlationId,
        userId: (request as any).user?.userId,
        responseTime: reply.elapsedTime,
        statusCode: reply.statusCode,
      }, 'Request completed');
    });
  }

  // Always log errors (even in tests)
  fastify.addHook('onError', async (request, reply, error) => {
    if (!isTest) {
      request.log.error({
        correlationId: (request as any).correlationId,
        userId: (request as any).user?.userId,
        error: {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        },
      }, 'Request error');
    }
  });
}

export default fp(loggingPlugin, {
  name: 'logging',
});