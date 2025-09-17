import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  PRISMA_DATABASE_URL: z.string().min(1, 'PRISMA_DATABASE_URL is required'),

  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // API Configuration
  API_VERSION: z.string().default('v1'),
  CORS_ORIGIN: z.string().default('*'),
});

// Validate environment variables
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error('❌ Invalid environment variables:');
  envValidation.error.issues.forEach(issue => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const config = envValidation.data;

// Database configuration
export const dbConfig = {
  url: config.PRISMA_DATABASE_URL,
  // Add connection pool settings if needed
};

// JWT configuration
export const jwtConfig = {
  secret: config.JWT_SECRET,
  accessTokenExpiresIn: config.JWT_EXPIRES_IN,
  refreshTokenExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
};

// Server configuration
export const serverConfig = {
  port: config.PORT,
  host: '0.0.0.0',
  corsOrigin: config.CORS_ORIGIN,
};

// Logging configuration
export const logConfig = {
  level: config.LOG_LEVEL,
  redact: {
    paths: ['password', 'passwordHash', 'token', 'authorization'],
    censor: '[REDACTED]',
  },
};

// API configuration
export const apiConfig = {
  version: config.API_VERSION,
  prefix: `/api/${config.API_VERSION}`,
};

// Feature flags
export const features = {
  swaggerDocs: config.NODE_ENV === 'development',
  detailedErrors: config.NODE_ENV === 'development',
};

export default config;