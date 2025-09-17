import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from '../app';
import { FastifyInstance } from 'fastify';

// Mock database health check
vi.mock('../db/connection', () => ({
  checkDatabaseHealth: vi.fn(),
}));

describe('Health Plugin', () => {
  let app: FastifyInstance;
  let mockCheckDatabaseHealth: any;
  let originalUptime: any;
  let originalMemoryUsage: any;

  beforeEach(async () => {
    const { checkDatabaseHealth } = await import('../db/connection');
    mockCheckDatabaseHealth = checkDatabaseHealth as any;

    app = await createApp();
    await app.ready();

    // Mock process methods
    originalUptime = process.uptime;
    originalMemoryUsage = process.memoryUsage;
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
    process.uptime = originalUptime;
    process.memoryUsage = originalMemoryUsage;
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('memory');
      expect(body.memory).toHaveProperty('heapUsed');
      expect(body.memory).toHaveProperty('heapTotal');
    });
  });

  describe('GET /ready', () => {
    it('should return ready status when all checks pass', async () => {
      mockCheckDatabaseHealth.mockResolvedValue(true);
      process.uptime = vi.fn().mockReturnValue(10); // > 2 seconds
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB < 1GB
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('ready');
      expect(body.checks.database).toBe(true);
      expect(body.checks.memory).toBe(true);
      expect(body.checks.uptime).toBe(true);
    });

    it('should return not ready when database check fails', async () => {
      mockCheckDatabaseHealth.mockResolvedValue(false);
      process.uptime = vi.fn().mockReturnValue(10);
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('not_ready');
      expect(body.checks.database).toBe(false);
    });

    it('should return not ready when database check throws error', async () => {
      mockCheckDatabaseHealth.mockRejectedValue(new Error('Database connection failed'));
      process.uptime = vi.fn().mockReturnValue(10);
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('not_ready');
      expect(body.checks.database).toBe(false);
    });

    it('should return not ready when memory usage is too high', async () => {
      mockCheckDatabaseHealth.mockResolvedValue(true);
      process.uptime = vi.fn().mockReturnValue(10);
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 2 * 1024 * 1024 * 1024, // 2GB > 1GB threshold
        heapTotal: 3 * 1024 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 2.5 * 1024 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('not_ready');
      expect(body.checks.memory).toBe(false);
    });

    it('should return not ready when uptime is too low', async () => {
      mockCheckDatabaseHealth.mockResolvedValue(true);
      process.uptime = vi.fn().mockReturnValue(1); // < 2 seconds threshold
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('not_ready');
      expect(body.checks.uptime).toBe(false);
    });
  });
});