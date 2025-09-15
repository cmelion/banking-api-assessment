import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { checkDatabaseHealth } from '../db/connection';

async function healthPlugin(fastify: FastifyInstance) {
  // Liveness probe - basic health check
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  // Readiness probe - comprehensive health check
  fastify.get('/ready', async (request, reply) => {
    const checks = {
      database: false,
      memory: true,
      uptime: true,
    };

    // Check database connectivity
    try {
      checks.database = await checkDatabaseHealth();
    } catch (error) {
      fastify.log.error('Database health check failed:', error as any);
      checks.database = false;
    }

    // Check memory usage (warn if > 1GB)
    const memUsage = process.memoryUsage();
    checks.memory = memUsage.heapUsed < 1024 * 1024 * 1024;

    // Check uptime (warn if < 2 seconds, might be restarting)
    checks.uptime = process.uptime() > 2;

    const isHealthy = Object.values(checks).every(check => check);

    const response = {
      status: isHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      memory: memUsage,
    };

    reply.code(isHealthy ? 200 : 503);
    return response;
  });
}

export default fp(healthPlugin, {
  name: 'health',
});