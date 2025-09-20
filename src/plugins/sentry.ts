import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { env } from '../config';

export default fp(async function sentryPlugin(fastify: FastifyInstance) {
  const sentryDsn = env.SENTRY_DSN;
  const sentryEnvironment = env.SENTRY_ENVIRONMENT || env.NODE_ENV;
  const sentryEnabled = env.SENTRY_ENABLED === 'true';

  if (!sentryEnabled || !sentryDsn) {
    fastify.log.info('Sentry error tracking is disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: sentryEnvironment,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        nodeProfilingIntegration(),
      ],
      beforeSend(event, hint) {
        // Sanitize sensitive data
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
            const params = new URLSearchParams(event.request.query_string);
            ['token', 'password', 'secret', 'api_key'].forEach(key => {
              if (params.has(key)) {
                params.set(key, '[REDACTED]');
              }
            });
            event.request.query_string = params.toString();
          }
        }

        // Sanitize user data
        if (event.user) {
          delete event.user.ip_address;
          if (event.user.email) {
            event.user.email = '[REDACTED]';
          }
        }

        return event;
      },
    });

    fastify.log.info(`Sentry error tracking initialized for environment: ${sentryEnvironment}`);

    // Add request context to Sentry
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      Sentry.setContext('request', {
        id: request.id,
        method: request.method,
        url: request.url,
        correlationId: request.headers['x-correlation-id'] as string,
      });

      // Set user context if authenticated
      if ((request as any).user) {
        const user = (request as any).user;
        Sentry.setUser({
          id: user.id,
          username: user.username,
        });
      }
    });

    // Capture errors
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: FastifyError) => {
      // Don't report client errors (4xx) unless they're 500s
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        Sentry.withScope((scope) => {
          scope.setTag('statusCode', statusCode);
          scope.setContext('request', {
            id: request.id,
            method: request.method,
            url: request.url,
            params: request.params,
            query: request.query,
            correlationId: request.headers['x-correlation-id'] as string,
          });

          // Add user context
          if ((request as any).user) {
            const user = (request as any).user;
            scope.setUser({
              id: user.id,
              username: user.username,
            });
          }

          // Capture the error
          Sentry.captureException(error, {
            tags: {
              source: 'fastify-error-hook',
            },
          });
        });
      }
    });

    // Clear context after response
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      Sentry.setContext('request', null);
      Sentry.setUser(null);
    });

    // Graceful shutdown
    fastify.addHook('onClose', async () => {
      await Sentry.close(2000);
    });

    // Decorate fastify with Sentry for manual error capture
    fastify.decorate('sentry', Sentry);

  } catch (error) {
    fastify.log.error(error, 'Failed to initialize Sentry');
    // Don't fail the application if Sentry initialization fails
  }
}, {
  name: 'sentry',
  dependencies: ['logging'], // Ensure logging is set up first
});

// Module augmentation for TypeScript
declare module 'fastify' {
  interface FastifyInstance {
    sentry: typeof Sentry;
  }
}