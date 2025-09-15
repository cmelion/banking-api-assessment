import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';

describe('Auth Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user and return tokens', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: uniqueEmail,
          password: 'SecurePassword123',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(uniqueEmail);
      expect(body.data.user.name).toBe('Test User');
      expect(body.data.tokens).toBeDefined();
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
    });

    it('should return error for duplicate email', async () => {
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;

      // First signup
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: duplicateEmail,
          password: 'SecurePassword123',
          name: 'First User',
        },
      });

      // Second signup with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: duplicateEmail,
          password: 'SecurePassword123',
          name: 'Second User',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return error for invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'test@example.com',
          password: '123', // Too short
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginEmail = `login-${Date.now()}@example.com`;

      // First create a user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: loginEmail,
          password: 'SecurePassword123',
          name: 'Login User',
        },
      });

      // Then login
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: loginEmail,
          password: 'SecurePassword123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.tokens).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});