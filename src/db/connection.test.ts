import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
  })),
}));

describe('Database Connection', () => {
  let mockConsoleError: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = process.env.NODE_ENV;
    vi.clearAllMocks();
    vi.resetModules();
    // Clear global prisma instance
    (global as any).__prisma = undefined;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    (global as any).__prisma = undefined;
  });

  it('should create production client with minimal logging', async () => {
    process.env.NODE_ENV = 'production';

    const { prisma } = await import('./connection');

    expect(PrismaClient).toHaveBeenCalledWith({
      log: ['error', 'warn'],
    });
    expect(prisma).toBeDefined();
  });

  it('should create test client with error logging only', async () => {
    process.env.NODE_ENV = 'test';

    const { prisma } = await import('./connection');

    expect(PrismaClient).toHaveBeenCalledWith({
      log: ['error'],
    });
    expect(prisma).toBeDefined();
  });

  it('should create development client with full logging', async () => {
    process.env.NODE_ENV = 'development';

    const { prisma } = await import('./connection');

    expect(PrismaClient).toHaveBeenCalledWith({
      log: ['query', 'info', 'warn', 'error'],
    });
    expect(prisma).toBeDefined();
  });

  it('should reuse global instance in test environment', async () => {
    process.env.NODE_ENV = 'test';

    // Import twice to test singleton behavior
    const { prisma: prisma1 } = await import('./connection');
    vi.resetModules();
    const { prisma: prisma2 } = await import('./connection');

    expect(prisma1).toBe(prisma2);
  });

  it('should reuse global instance in development environment', async () => {
    process.env.NODE_ENV = 'development';

    // Import twice to test singleton behavior
    const { prisma: prisma1 } = await import('./connection');
    vi.resetModules();
    const { prisma: prisma2 } = await import('./connection');

    expect(prisma1).toBe(prisma2);
  });

  it('should disconnect database successfully', async () => {
    const mockDisconnect = vi.fn();
    (PrismaClient as any).mockImplementation(() => ({
      $disconnect: mockDisconnect,
      $queryRaw: vi.fn(),
    }));

    const { disconnectDatabase } = await import('./connection');

    await disconnectDatabase();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should return true for successful health check', async () => {
    const mockQueryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    (PrismaClient as any).mockImplementation(() => ({
      $disconnect: vi.fn(),
      $queryRaw: mockQueryRaw,
    }));

    const { checkDatabaseHealth } = await import('./connection');

    const result = await checkDatabaseHealth();

    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledWith(['SELECT 1']);
  });

  it('should return false for failed health check and log error', async () => {
    const mockError = new Error('Database connection failed');
    const mockQueryRaw = vi.fn().mockRejectedValue(mockError);
    (PrismaClient as any).mockImplementation(() => ({
      $disconnect: vi.fn(),
      $queryRaw: mockQueryRaw,
    }));

    const { checkDatabaseHealth } = await import('./connection');

    const result = await checkDatabaseHealth();

    expect(result).toBe(false);
    expect(mockConsoleError).toHaveBeenCalledWith('Database health check failed:', mockError);
  });
});