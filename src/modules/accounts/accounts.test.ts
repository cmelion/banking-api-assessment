import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

describe('Account Endpoints', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
    prisma = new PrismaClient();

    // Create a test user and get auth token
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: uniqueEmail,
        password: 'SecurePassword123',
        name: 'Account Test User',
      },
    });

    const signupBody = JSON.parse(signupResponse.body);
    authToken = signupBody.data.tokens.accessToken;
    userId = signupBody.data.user.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (userId) {
      const accounts = await prisma.account.findMany({ where: { ownerId: userId }, select: { id: true }});
      const accountIds = accounts.map(a => a.id);

      if (accountIds.length > 0) {
        // Clean up transfers first
        await prisma.transfer.deleteMany({
          where: {
            OR: [
              { fromAccountId: { in: accountIds } },
              { toAccountId: { in: accountIds } }
            ]
          }
        });

        // Clean up transactions
        await prisma.transaction.deleteMany({
          where: {
            accountId: { in: accountIds }
          }
        });
      }

      await prisma.account.deleteMany({ where: { ownerId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /api/v1/accounts', () => {
    it('should create a new account for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          type: 'CHECKING',
          currency: 'USD',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.type).toBe('CHECKING');
      expect(body.data.currency).toBe('USD');
      expect(body.data.balance).toBe('0');
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.accountNumber).toBeDefined();
      expect(body.data.accountNumber).toMatch(/^\d{13}$/);
    });

    it('should create account with initial balance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          type: 'SAVINGS',
          currency: 'USD',
          initialDeposit: 1000.50,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.balance).toBe('1000.5');
      expect(body.data.type).toBe('SAVINGS');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        payload: {
          type: 'CHECKING',
          currency: 'USD',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          currency: 'USD',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should validate account type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          type: 'INVALID_TYPE',
          currency: 'USD',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/v1/accounts', () => {
    it('should list all user accounts', async () => {
      // Create multiple accounts
      await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { type: 'CHECKING', currency: 'USD' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { type: 'SAVINGS', currency: 'USD' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].type).toBeDefined();
      expect(body.data[1].type).toBeDefined();
    });

    it('should return empty array for user with no accounts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/accounts/:id', () => {
    it('should get account details by id', async () => {
      // Create an account
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { type: 'CHECKING', currency: 'USD' },
      });

      const createBody = JSON.parse(createResponse.body);
      const accountId = createBody.data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(accountId);
      expect(body.data.type).toBe('CHECKING');
      expect(body.data.type).toBe('CHECKING');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts/non-existent-id',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should not allow access to other users accounts', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`;
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: otherEmail,
          password: 'Password123',
          name: 'Other User',
        },
      });

      const otherUserBody = JSON.parse(otherUserResponse.body);
      const otherToken = otherUserBody.data.tokens.accessToken;

      // Create account for other user
      const otherAccountResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${otherToken}` },
        payload: { type: 'CHECKING', currency: 'USD' },
      });

      const otherAccountBody = JSON.parse(otherAccountResponse.body);
      const otherAccountId = otherAccountBody.data.id;

      // Try to access other user's account
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${otherAccountId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(403);

      // Clean up other user
      await prisma.account.delete({ where: { id: otherAccountId } });
      await prisma.user.delete({ where: { id: otherUserBody.data.user.id } });
    });
  });

  describe('PATCH /api/v1/accounts/:id', () => {
    it('should update account status to FROZEN', async () => {
      // Create an account
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { type: 'CHECKING', currency: 'USD' },
      });

      const createBody = JSON.parse(createResponse.body);
      const accountId = createBody.data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${accountId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'FROZEN',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('FROZEN');
    });

    it('should update account status to INACTIVE', async () => {
      // Create an account
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { type: 'SAVINGS', currency: 'USD' },
      });

      const createBody = JSON.parse(createResponse.body);
      const accountId = createBody.data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${accountId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'INACTIVE',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('INACTIVE');
    });

    it('should not allow updating other users accounts', async () => {
      // Create another user
      const otherEmail = `other2-${Date.now()}@example.com`;
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: otherEmail,
          password: 'Password123',
          name: 'Other User 2',
        },
      });

      const otherUserBody = JSON.parse(otherUserResponse.body);
      const otherToken = otherUserBody.data.tokens.accessToken;

      // Create account for other user
      const otherAccountResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${otherToken}` },
        payload: { type: 'CHECKING', currency: 'USD' },
      });

      const otherAccountBody = JSON.parse(otherAccountResponse.body);
      const otherAccountId = otherAccountBody.data.id;

      // Try to update other user's account
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${otherAccountId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'CLOSED',
        },
      });

      expect(response.statusCode).toBe(403);

      // Clean up other user
      await prisma.account.delete({ where: { id: otherAccountId } });
      await prisma.user.delete({ where: { id: otherUserBody.data.user.id } });
    });
  });

  describe('GET /api/v1/accounts/:id/balance', () => {
    it('should get account balance', async () => {
      // Create an account with initial balance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          type: 'CHECKING',
          currency: 'USD',
          initialDeposit: 500.00
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const accountId = createBody.data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/balance`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.balance).toBe('500');
      expect(body.data.currency).toBe('USD');
      expect(body.data.accountId).toBe(accountId);
    });
  });
});