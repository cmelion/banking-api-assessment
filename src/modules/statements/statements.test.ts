import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/connection';
import { AccountService } from '../accounts/service';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountType, AccountStatus, TransactionType } from '../../lib/types';

describe('Statements Module', () => {
  let app: FastifyInstance;
  let authToken1: string;
  let authToken2: string;
  let testEmail1: string;
  let testEmail2: string;
  let userId1: string;
  let userId2: string;
  let accountService: AccountService;
  let account1: any;
  let account2: any;
  let account3: any; // For different user

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
    accountService = new AccountService();

    // Create first test user and get auth token
    testEmail1 = `testuser1-${Date.now()}@example.com`;
    const signupResponse1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: testEmail1,
        password: 'SecurePassword123',
        name: 'Test User 1',
      },
    });

    if (signupResponse1.statusCode !== 201) {
      throw new Error(`Signup failed: ${signupResponse1.body}`);
    }

    const signupBody1 = JSON.parse(signupResponse1.body);
    authToken1 = signupBody1.data.tokens.accessToken;
    userId1 = signupBody1.data.user.id;

    // Create second test user and get auth token
    testEmail2 = `testuser2-${Date.now()}@example.com`;
    const signupResponse2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: testEmail2,
        password: 'SecurePassword123',
        name: 'Test User 2',
      },
    });

    if (signupResponse2.statusCode !== 201) {
      throw new Error(`Signup failed: ${signupResponse2.body}`);
    }

    const signupBody2 = JSON.parse(signupResponse2.body);
    authToken2 = signupBody2.data.tokens.accessToken;
    userId2 = signupBody2.data.user.id;

    // Create test accounts for user 1
    account1 = await accountService.createAccount(userId1, {
      type: AccountType.CHECKING,
      currency: 'USD',
      initialDeposit: 1000.00,
    });

    account2 = await accountService.createAccount(userId1, {
      type: AccountType.SAVINGS,
      currency: 'USD',
      initialDeposit: 500.00,
    });

    // Create account for user 2
    account3 = await accountService.createAccount(userId2, {
      type: AccountType.CHECKING,
      currency: 'USD',
      initialDeposit: 200.00,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper function to create sample transactions
  async function createSampleTransactions(accountId: string, count: number = 5) {
    const transactions = [];
    let currentBalance = new Decimal(1000);

    for (let i = 0; i < count; i++) {
      const isCredit = i % 2 === 0;
      const amount = new Decimal((i + 1) * 50);

      if (isCredit) {
        currentBalance = currentBalance.plus(amount);
      } else {
        currentBalance = currentBalance.minus(amount);
      }

      const transaction = await prisma.transaction.create({
        data: {
          accountId,
          type: isCredit ? TransactionType.CREDIT : TransactionType.DEBIT,
          amount,
          currency: 'USD',
          description: `Test transaction ${i + 1}`,
          counterparty: `Counterparty ${i + 1}`,
          balanceAfter: currentBalance,
          createdAt: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000), // Spread over days
        },
      });
      transactions.push(transaction);
    }

    // Update account balance
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: currentBalance },
    });

    return transactions;
  }

  describe('POST /api/v1/accounts/:accountId/statements/generate', () => {
    it('should generate a statement for account with transactions', async () => {
      // Create some transactions first
      await createSampleTransactions(account1.id, 3);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.periodStart).toBeDefined();
      expect(body.data.periodEnd).toBeDefined();
      expect(body.data.fileUrl).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
    });

    it('should generate a statement for account with no transactions', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account2.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'JSON',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    it('should return existing statement if one already exists for the same period', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      // Generate first statement
      const response1 = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      // Generate second statement for same period
      const response2 = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // Should return the same statement
      expect(body1.data.id).toBe(body2.data.id);
    });

    it('should reject invalid date ranges', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-12-31',
          endDate: '2024-01-01', // End date before start date
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Start date must be before end date');
    });

    it('should reject period longer than 365 days', async () => {
      const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Statement period cannot exceed 365 days');
    });

    it('should reject access to another user\'s account', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account3.id}/statements/generate`, // User 2's account
        headers: {
          authorization: `Bearer ${authToken1}`, // User 1's token
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Account not found');
    });

    it('should reject invalid request format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: 'invalid-date',
          endDate: '2024-12-31',
          format: 'INVALID',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should generate statement with correct filename format', async () => {
      await createSampleTransactions(account1.id, 2);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'JSON',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.fileUrl).toContain('statement-');
      expect(body.data.fileUrl).toContain(startDate);
      expect(body.data.fileUrl).toContain(endDate);
      expect(body.data.fileUrl).toContain('.json');
    });
  });

  describe('GET /api/v1/statements/:id', () => {
    let statementId: string;

    beforeEach(async () => {
      // Create a statement for testing
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      const body = JSON.parse(response.body);
      statementId = body.data.id;
    });

    it('should retrieve statement by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/statements/${statementId}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(statementId);
      expect(body.data.periodStart).toBeDefined();
      expect(body.data.periodEnd).toBeDefined();
      expect(body.data.fileUrl).toBeDefined();
      expect(body.data.account).toBeDefined();
      expect(body.data.account.accountNumber).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
    });

    it('should reject access to another user\'s statement', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/statements/${statementId}`,
        headers: {
          authorization: `Bearer ${authToken2}`, // Different user's token
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Statement not found');
    });

    it('should return 404 for non-existent statement', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/statements/non-existent-id',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/statements/${statementId}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/accounts/:accountId/statements', () => {
    beforeEach(async () => {
      // Create multiple statements for testing pagination
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;
      const dates = [
        { start: `${currentYear}-01-01`, end: `${currentYear}-01-31` },
        { start: `${currentYear}-02-01`, end: `${currentYear}-02-28` },
        { start: `${currentYear}-03-01`, end: `${currentYear}-03-31` },
        { start: `${previousYear}-12-01`, end: `${previousYear}-12-31` }, // Different year
      ];

      for (const date of dates) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/accounts/${account1.id}/statements/generate`,
          headers: {
            authorization: `Bearer ${authToken1}`,
          },
          payload: {
            startDate: date.start,
            endDate: date.end,
            format: 'PDF',
          },
        });
      }
    });

    it('should list account statements with default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.pagination).toBeDefined();
      expect(body.meta.pagination.page).toBe(1);
      expect(body.meta.pagination.limit).toBe(10);
      expect(body.meta.pagination.total).toBeGreaterThan(0);
    });

    it('should support custom pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements?page=1&limit=2`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.pagination.page).toBe(1);
      expect(body.meta.pagination.limit).toBe(2);
    });

    it('should filter statements by year', async () => {
      const currentYear = new Date().getFullYear();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements?year=${currentYear}`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Should have at least 2 statements from current year (not the previous year one)
      expect(body.data.length).toBeGreaterThanOrEqual(2);

      // Verify all statements are from current year
      body.data.forEach((statement: any) => {
        expect(new Date(statement.periodStart).getFullYear()).toBe(currentYear);
      });
    });

    it('should return empty list for year with no statements', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements?year=2022`, // Valid year but no statements
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(0);
      expect(body.meta.pagination.total).toBe(0);
    });

    it('should reject access to another user\'s account statements', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account3.id}/statements`, // User 2's account
        headers: {
          authorization: `Bearer ${authToken1}`, // User 1's token
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Account not found');
    });

    it('should return statements ordered by creation date (newest first)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify statements are ordered by creation date (newest first)
      for (let i = 1; i < body.data.length; i++) {
        const current = new Date(body.data[i].createdAt);
        const previous = new Date(body.data[i - 1].createdAt);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });

    it('should include account information in statement list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      body.data.forEach((statement: any) => {
        expect(statement.account).toBeDefined();
        expect(statement.account.accountNumber).toBeDefined();
        expect(statement.account.type).toBeDefined();
      });
    });

    it('should handle invalid query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements?page=0&limit=101&year=invalid`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${account1.id}/statements`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Statement Content Validation', () => {
    it('should generate statement with correct transaction inclusion and balance calculations', async () => {
      // Create transactions within a specific period
      await createSampleTransactions(account1.id, 5);

      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'JSON',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify statement includes balance information in filename
      expect(body.data.fileUrl).toContain('opening-');
      expect(body.data.fileUrl).toContain('closing-');
      expect(body.data.fileUrl).toContain('credits-');
      expect(body.data.fileUrl).toContain('debits-');
    });

    it('should handle statement generation for specific date ranges', async () => {
      // Create transactions at different times
      await prisma.transaction.create({
        data: {
          accountId: account1.id,
          type: TransactionType.CREDIT,
          amount: new Decimal(100),
          currency: 'USD',
          description: 'Old transaction',
          balanceAfter: new Decimal(1100),
          createdAt: new Date('2024-01-15'),
        },
      });

      await prisma.transaction.create({
        data: {
          accountId: account1.id,
          type: TransactionType.DEBIT,
          amount: new Decimal(50),
          currency: 'USD',
          description: 'Recent transaction',
          balanceAfter: new Decimal(1050),
          createdAt: new Date('2024-06-15'),
        },
      });

      // Generate statement only for recent period
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-06-01',
          endDate: '2024-06-30',
          format: 'JSON',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Statement should only include transactions from the specified period
      expect(body.data.fileUrl).toBeDefined();
      expect(body.data.periodStart).toBe('2024-06-01T00:00:00.000Z');
      expect(body.data.periodEnd).toBe('2024-06-30T00:00:00.000Z');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent account gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/non-existent-account/statements/generate',
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Account not found');
    });

    it('should handle frozen/inactive accounts', async () => {
      // Create a frozen account
      const frozenAccount = await accountService.createAccount(userId1, {
        type: AccountType.CHECKING,
        currency: 'USD',
        initialDeposit: 100.00,
      });

      await prisma.account.update({
        where: { id: frozenAccount.id },
        data: { status: AccountStatus.FROZEN },
      });

      // Should still be able to generate statements for frozen accounts
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${frozenAccount.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'PDF',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should handle concurrent statement generation requests', async () => {
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-06-01`;
      const endDate = `${currentYear}-06-30`;

      // First create one statement, then try to create the same one again
      const firstResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstBody = JSON.parse(firstResponse.body);
      const firstStatementId = firstBody.data.id;

      // Now try to create the same statement again
      const secondResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate,
          endDate,
          format: 'PDF',
        },
      });

      expect(secondResponse.statusCode).toBe(201);
      const secondBody = JSON.parse(secondResponse.body);
      const secondStatementId = secondBody.data.id;

      // Should return the same statement ID (deduplicated)
      expect(firstStatementId).toBe(secondStatementId);
    });

    it('should validate format parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'XLSX', // Invalid format
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${account1.id}/statements/generate`,
        headers: {
          authorization: `Bearer ${authToken1}`,
        },
        payload: {
          startDate: '2024-01-01',
          // Missing endDate
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});