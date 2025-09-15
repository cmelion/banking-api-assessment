import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Global database instance
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// Singleton pattern for Prisma client
if (config.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // Use global variable in development to prevent hot reload issues
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

// Graceful disconnect
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export { prisma };
export default prisma;