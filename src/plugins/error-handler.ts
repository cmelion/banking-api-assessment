import { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { isBaseError } from '../lib/errors';
import { features } from '../config';
import { ApiResponse } from '../lib/types';

async function errorHandlerPlugin(fastify: FastifyInstance) {
  // Global error handler
  fastify.setErrorHandler(async (error: FastifyError, request, reply) => {
    const correlationId = (request as any).correlationId;

    // Log the error
    request.log.error({
      correlationId,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
      },
    }, 'Request error handled');

    // Handle custom application errors
    if (isBaseError(error)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(features.detailedErrors && error.details && { details: error.details }),
        },
      };

      reply.code(error.statusCode);
      return response;
    }

    // Handle Fastify validation errors
    if (error.validation) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          ...(features.detailedErrors && { details: error.validation }),
        },
      };

      reply.code(400);
      return response;
    }

    // Handle JWT errors
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      };

      reply.code(401);
      return response;
    }

    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid access token',
        },
      };

      reply.code(401);
      return response;
    }

    // Handle other HTTP errors
    if (error.statusCode) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: error.message || 'An error occurred',
          ...(features.detailedErrors && { details: error }),
        },
      };

      reply.code(error.statusCode);
      return response;
    }

    // Handle unexpected errors
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: features.detailedErrors ? error.message : 'An unexpected error occurred',
        ...(features.detailedErrors && { details: error.stack }),
      },
    };

    reply.code(500);
    return response;
  });

  // Not found handler
  fastify.setNotFoundHandler(async (request, reply) => {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    };

    reply.code(404);
    return response;
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});