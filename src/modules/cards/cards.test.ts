import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

describe('Cards Module', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;
  let accountId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let otherAccountId: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
    prisma = new PrismaClient();

    // Create primary test user
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: uniqueEmail,
        password: 'SecurePassword123',
        name: 'Card Test User',
      },
    });

    const signupBody = JSON.parse(signupResponse.body);
    authToken = signupBody.data.tokens.accessToken;
    userId = signupBody.data.user.id;

    // Create test account for primary user
    const accountResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        type: 'CHECKING',
        currency: 'USD',
        initialDeposit: 1000,
      },
    });

    const accountBody = JSON.parse(accountResponse.body);
    accountId = accountBody.data.id;

    // Create second test user for authorization tests
    const otherEmail = `other-${Date.now()}@example.com`;
    const otherSignupResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: otherEmail,
        password: 'SecurePassword123',
        name: 'Other Test User',
      },
    });

    const otherSignupBody = JSON.parse(otherSignupResponse.body);
    otherUserToken = otherSignupBody.data.tokens.accessToken;
    otherUserId = otherSignupBody.data.user.id;

    // Create test account for other user
    const otherAccountResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: `Bearer ${otherUserToken}` },
      payload: {
        type: 'SAVINGS',
        currency: 'USD',
        initialDeposit: 500,
      },
    });

    const otherAccountBody = JSON.parse(otherAccountResponse.body);
    otherAccountId = otherAccountBody.data.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (userId) {
      const accounts = await prisma.account.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
      const accountIds = accounts.map(a => a.id);

      if (accountIds.length > 0) {
        // Clean up cards first
        await prisma.card.deleteMany({
          where: { accountId: { in: accountIds } }
        });

        // Clean up transactions and transfers
        await prisma.transfer.deleteMany({
          where: {
            OR: [
              { fromAccountId: { in: accountIds } },
              { toAccountId: { in: accountIds } }
            ]
          }
        });

        await prisma.transaction.deleteMany({
          where: { accountId: { in: accountIds } }
        });
      }

      await prisma.account.deleteMany({ where: { ownerId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }

    if (otherUserId) {
      const otherAccounts = await prisma.account.findMany({
        where: { ownerId: otherUserId },
        select: { id: true }
      });
      const otherAccountIds = otherAccounts.map(a => a.id);

      if (otherAccountIds.length > 0) {
        await prisma.card.deleteMany({
          where: { accountId: { in: otherAccountIds } }
        });

        await prisma.transfer.deleteMany({
          where: {
            OR: [
              { fromAccountId: { in: otherAccountIds } },
              { toAccountId: { in: otherAccountIds } }
            ]
          }
        });

        await prisma.transaction.deleteMany({
          where: { accountId: { in: otherAccountIds } }
        });
      }

      await prisma.account.deleteMany({ where: { ownerId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } });
    }

    await prisma.$disconnect();
    await app.close();
  });

  describe('Card Issuance - POST /api/v1/accounts/:accountId/cards', () => {
    it('should create a new card for active account with proper PCI compliance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();

      // PCI Compliance checks - card number should be masked
      expect(body.data.maskedPan).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
      expect(body.data.last4).toMatch(/^\d{4}$/);
      expect(body.data.brand).toBeDefined();
      expect(['VISA', 'MASTERCARD']).toContain(body.data.brand);

      // Card should not contain any raw PAN data
      expect(body.data.cardNumber).toBeUndefined();
      expect(body.data.pan).toBeUndefined();
      expect(body.data.fullNumber).toBeUndefined();

      // Expiry date should be 3 years from now
      expect(body.data.expMonth).toBeGreaterThan(0);
      expect(body.data.expMonth).toBeLessThanOrEqual(12);
      expect(body.data.expYear).toBeGreaterThanOrEqual(new Date().getFullYear() + 2);
      expect(body.data.expYear).toBeLessThanOrEqual(new Date().getFullYear() + 4);

      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.account).toBeDefined();
      expect(body.data.account.accountNumber).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
    });

    it('should return 404 for non-existent account', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/non-existent-account/cards',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Account not found');
    });

    it('should return 404 when trying to create card for other users account', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${otherAccountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should enforce card limit per account (max 3 cards)', async () => {
      // Create 3 cards
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/accounts/${accountId}/cards`,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          payload: {},
        });
        expect(response.statusCode).toBe(201);
      }

      // Try to create 4th card
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Maximum number of cards reached');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create card with proper brand detection for Visa-like numbers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Since our mock generates cards starting with 4, it should be VISA
      expect(body.data.brand).toBe('VISA');
      expect(body.data.maskedPan).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
    });
  });

  describe('List Account Cards - GET /api/v1/accounts/:accountId/cards', () => {
    beforeEach(async () => {
      // Create some test cards
      await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });

      await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });
    });

    it('should list all cards for account with proper masking', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);

      body.data.forEach((card: any) => {
        // PCI compliance checks
        expect(card.maskedPan).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
        expect(card.last4).toMatch(/^\d{4}$/);
        expect(card.brand).toBeDefined();
        expect(card.status).toBeDefined();
        expect(card.expMonth).toBeDefined();
        expect(card.expYear).toBeDefined();
        expect(card.createdAt).toBeDefined();
        expect(card.account).toBeDefined();

        // Should not contain raw card data
        expect(card.cardNumber).toBeUndefined();
        expect(card.pan).toBeUndefined();
        expect(card.fullNumber).toBeUndefined();
      });

      expect(body.meta.pagination).toBeDefined();
      expect(body.meta.pagination.total).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards?page=1&limit=1`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta.pagination.page).toBe(1);
      expect(body.meta.pagination.limit).toBe(1);
      expect(body.meta.pagination.total).toBe(2);
      expect(body.meta.pagination.hasNext).toBe(true);
    });

    it('should filter by card status', async () => {
      // Update one card to BLOCKED
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const listBody = JSON.parse(listResponse.body);
      const cardId = listBody.data[0].id;

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: 'BLOCKED' },
      });

      // Filter for ACTIVE cards only
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards?status=ACTIVE`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('ACTIVE');
    });

    it('should return empty array for account with no cards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${otherAccountId}/cards`,
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.meta.pagination.total).toBe(0);
    });

    it('should return 404 for non-existent account', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts/non-existent/cards',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow access to other users account cards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${otherAccountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Get Card Details - GET /api/v1/cards/:id', () => {
    let cardId: string;

    beforeEach(async () => {
      // Create a test card
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });
      const body = JSON.parse(response.body);
      cardId = body.data.id;
    });

    it('should get card details with proper masking', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(cardId);

      // PCI compliance checks
      expect(body.data.maskedPan).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
      expect(body.data.last4).toMatch(/^\d{4}$/);
      expect(body.data.brand).toBeDefined();
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.account).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.updatedAt).toBeDefined();

      // Should not contain raw card data
      expect(body.data.cardNumber).toBeUndefined();
      expect(body.data.pan).toBeUndefined();
      expect(body.data.fullNumber).toBeUndefined();
    });

    it('should return 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/non-existent-card',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Card not found');
    });

    it('should not allow access to other users cards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Update Card Status - PATCH /api/v1/cards/:id', () => {
    let cardId: string;

    beforeEach(async () => {
      // Create a test card
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });
      const body = JSON.parse(response.body);
      cardId = body.data.id;
    });

    it('should update card status to INACTIVE', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
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
      expect(body.data.id).toBe(cardId);
      expect(body.data.updatedAt).toBeDefined();

      // Should still maintain PCI compliance
      expect(body.data.maskedPan).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
    });

    it('should update card status to BLOCKED', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'BLOCKED',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data.status).toBe('BLOCKED');
    });

    it('should reactivate card from INACTIVE to ACTIVE', async () => {
      // First deactivate
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: 'INACTIVE' },
      });

      // Then reactivate
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'ACTIVE',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('ACTIVE');
    });

    it('should reject invalid status values', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'INVALID_STATUS',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 404 when trying to update other users card', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
        },
        payload: {
          status: 'BLOCKED',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/cards/non-existent-card',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'BLOCKED',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject updates to expired cards', async () => {
      // First manually set card to expired in database
      await prisma.card.update({
        where: { id: cardId },
        data: { status: 'EXPIRED' },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {
          status: 'ACTIVE',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Cannot update expired card');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        payload: { status: 'BLOCKED' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Authorization and Security Tests', () => {
    let cardId: string;

    beforeEach(async () => {
      // Create a test card
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });
      const body = JSON.parse(response.body);
      cardId = body.data.id;
    });

    it('should enforce proper authorization on all card endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: `/api/v1/cards/${cardId}` },
        { method: 'PATCH', url: `/api/v1/cards/${cardId}`, payload: { status: 'BLOCKED' } },
        { method: 'GET', url: `/api/v1/accounts/${accountId}/cards` },
        { method: 'POST', url: `/api/v1/accounts/${accountId}/cards`, payload: {} },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: { Authorization: `Bearer ${otherUserToken}` },
          payload: endpoint.payload,
        });

        expect([403, 404]).toContain(response.statusCode); // Either forbidden or not found (depending on authorization strategy)
      }
    });

    it('should never expose raw PAN in any response', async () => {
      // Test all endpoints that return card data
      const cardCreateResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });

      const cardGetResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const cardsListResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const cardUpdateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: 'INACTIVE' },
      });

      const responses = [
        JSON.parse(cardCreateResponse.body),
        JSON.parse(cardGetResponse.body),
        JSON.parse(cardsListResponse.body),
        JSON.parse(cardUpdateResponse.body),
      ];

      responses.forEach(response => {
        const responseString = JSON.stringify(response);

        // Should not contain patterns that look like full card numbers
        expect(responseString).not.toMatch(/\b\d{16}\b/); // 16 digit numbers
        expect(responseString).not.toMatch(/\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/); // Spaced format
        expect(responseString).not.toMatch(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/); // Dash format without masking

        // Should not contain obvious PAN field names
        expect(responseString).not.toMatch(/"cardNumber"/);
        expect(responseString).not.toMatch(/"pan"/);
        expect(responseString).not.toMatch(/"primaryAccountNumber"/);
        expect(responseString).not.toMatch(/"fullNumber"/);
      });
    });

    it('should maintain consistent masking format across all endpoints', async () => {
      const cardGetResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const cardsListResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const getBody = JSON.parse(cardGetResponse.body);
      const listBody = JSON.parse(cardsListResponse.body);

      const cardFromGet = getBody.data;
      const cardFromList = listBody.data.find((c: any) => c.id === cardId);

      // Masking should be consistent
      expect(cardFromGet.maskedPan).toBe(cardFromList.maskedPan);
      expect(cardFromGet.last4).toBe(cardFromList.last4);
      expect(cardFromGet.brand).toBe(cardFromList.brand);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle inactive account for card creation', async () => {
      // Set account to inactive
      await prisma.account.update({
        where: { id: accountId },
        data: { status: 'INACTIVE' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Account not found or not active');
    });

    it('should validate query parameters for listing cards', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards?page=0&limit=0`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle malformed card ID in requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/invalid-id-format',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should enforce card limit only for non-expired cards', async () => {
      // Create 3 cards
      const cardIds = [];
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/accounts/${accountId}/cards`,
          headers: { Authorization: `Bearer ${authToken}` },
          payload: {},
        });
        const body = JSON.parse(response.body);
        cardIds.push(body.data.id);
      }

      // Expire one card
      await prisma.card.update({
        where: { id: cardIds[0] },
        data: { status: 'EXPIRED' },
      });

      // Should be able to create another card since one is expired
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
    });

    it('should generate unique card numbers for multiple cards', async () => {
      const cardNumbers = new Set();

      // Create multiple cards and verify uniqueness
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/accounts/${accountId}/cards`,
          headers: { Authorization: `Bearer ${authToken}` },
          payload: {},
        });

        const body = JSON.parse(response.body);
        const last4 = body.data.last4;

        expect(cardNumbers.has(last4)).toBe(false);
        cardNumbers.add(last4);
      }
    });

    it('should handle concurrent card creation requests properly', async () => {
      // Create multiple requests simultaneously
      const promises = Array.from({ length: 3 }, () =>
        app.inject({
          method: 'POST',
          url: `/api/v1/accounts/${accountId}/cards`,
          headers: { Authorization: `Bearer ${authToken}` },
          payload: {},
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed since we're within the limit
      responses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      // Verify we have exactly 3 cards
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data).toHaveLength(3);
    });
  });

  describe('Business Logic Validation', () => {
    it('should set proper expiry date for new cards (3 years from now)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });

      const body = JSON.parse(response.body);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      expect(body.data.expYear).toBe(currentYear + 3);
      expect(body.data.expMonth).toBe(currentMonth);
    });

    it('should assign correct brand based on card number prefix', async () => {
      // Since our mock service generates numbers starting with 4 (Visa-like)
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });

      const body = JSON.parse(response.body);
      expect(body.data.brand).toBe('VISA');
    });

    it('should include account information in card responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {},
      });

      const body = JSON.parse(response.body);
      expect(body.data.account).toBeDefined();
      expect(body.data.account.accountNumber).toBeDefined();
      expect(body.data.account.type).toBeDefined();
      expect(body.data.account.currency).toBeDefined();
    });
  });
});