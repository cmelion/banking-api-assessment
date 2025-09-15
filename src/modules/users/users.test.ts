import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';

describe('Users Endpoints', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testEmail: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();

    // Create a user and get auth token
    testEmail = `testuser-${Date.now()}@example.com`;
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: testEmail,
        password: 'SecurePassword123',
        name: 'Test User',
      },
    });

    if (signupResponse.statusCode !== 201) {
      throw new Error(`Signup failed: ${signupResponse.body}`);
    }

    const signupBody = JSON.parse(signupResponse.body);
    authToken = signupBody.data.tokens.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(testEmail);
      expect(body.data.name).toBe('Test User');
      expect(body.data.accounts).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update user profile', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
    });
  });
});