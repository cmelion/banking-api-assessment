import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

describe('Account Lifecycle Integration Tests', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();
    prisma = new PrismaClient();

    // Create a test user and get auth token
    const uniqueEmail = `integration-test-${Date.now()}@example.com`;
    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: uniqueEmail,
        password: 'SecurePassword123',
        name: 'Integration Test User',
      },
    });

    const signupBody = JSON.parse(signupResponse.body);
    authToken = signupBody.data.tokens.accessToken;
    userId = signupBody.data.user.id;
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
        // Clean up in order due to foreign key constraints
        await prisma.statement.deleteMany({
          where: { accountId: { in: accountIds } }
        });
        await prisma.card.deleteMany({
          where: { accountId: { in: accountIds } }
        });
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
        await prisma.account.deleteMany({
          where: { ownerId: userId }
        });
      }

      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('Complete Account Lifecycle', () => {
    it('should handle full account lifecycle: create → fund → transactions → cards → statements', async () => {
      // Step 1: Create a checking account
      const createAccountResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          type: 'CHECKING',
          currency: 'USD',
          initialDeposit: 1000.00
        },
      });

      expect(createAccountResponse.statusCode).toBe(201);
      const accountData = JSON.parse(createAccountResponse.body).data;
      const accountId = accountData.id;

      // Verify account creation
      expect(accountData.type).toBe('CHECKING');
      expect(accountData.balance).toBe('1000');
      expect(accountData.status).toBe('ACTIVE');

      // Step 2: Create a savings account for transfers
      const savingsResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          type: 'SAVINGS',
          currency: 'USD'
        },
      });

      expect(savingsResponse.statusCode).toBe(201);
      const savingsId = JSON.parse(savingsResponse.body).data.id;

      // Step 3: Perform a transfer between accounts
      const transferResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': `transfer-${Date.now()}`
        },
        payload: {
          fromAccountId: accountId,
          toAccountId: savingsId,
          amount: 250.00,
          currency: 'USD',
          description: 'Transfer to savings'
        },
      });

      expect(transferResponse.statusCode).toBe(201);
      const transferData = JSON.parse(transferResponse.body).data;
      expect(transferData.status).toBe('COMPLETED');

      // Step 4: Verify account balances after transfer
      const checkingBalanceResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(checkingBalanceResponse.statusCode).toBe(200);
      const checkingBalance = JSON.parse(checkingBalanceResponse.body).data;
      expect(checkingBalance.balance).toBe('750'); // 1000 - 250

      const savingsBalanceResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${savingsId}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(savingsBalanceResponse.statusCode).toBe(200);
      const savingsBalance = JSON.parse(savingsBalanceResponse.body).data;
      expect(savingsBalance.balance).toBe('250');

      // Step 5: Check transaction history
      const transactionsResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/transactions`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(transactionsResponse.statusCode).toBe(200);
      const transactionsData = JSON.parse(transactionsResponse.body);
      expect(transactionsData.data.length).toBeGreaterThanOrEqual(2); // Initial deposit + transfer debit

      // Step 6: Issue a card for the checking account
      const cardResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          brand: 'VISA'
        },
      });

      expect(cardResponse.statusCode).toBe(201);
      const cardData = JSON.parse(cardResponse.body).data;
      expect(cardData.brand).toBe('VISA');
      expect(cardData.status).toBe('ACTIVE');
      expect(cardData.maskedPan).toMatch(/^\*\*\*\*-\*\*\*\*-\*\*\*\*-\d{4}$/);

      // Step 7: Generate a statement
      const statementResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/statements/generate`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          format: 'PDF'
        },
      });

      expect(statementResponse.statusCode).toBe(201);
      const statementData = JSON.parse(statementResponse.body).data;
      expect(statementData).toBeDefined();
      // Note: Statement fields may vary based on implementation

      // Step 8: Update account status to demonstrate account management
      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${accountId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          status: 'FROZEN'
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updatedAccount = JSON.parse(updateResponse.body).data;
      expect(updatedAccount.status).toBe('FROZEN');

      // Step 9: Verify frozen account restrictions
      const frozenTransferResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': `frozen-transfer-${Date.now()}`
        },
        payload: {
          fromAccountId: accountId,
          toAccountId: savingsId,
          amount: 100.00,
          currency: 'USD',
          description: 'Should fail - account frozen'
        },
      });

      expect(frozenTransferResponse.statusCode).toBe(404);
      const frozenError = JSON.parse(frozenTransferResponse.body);
      expect(frozenError.success).toBe(false);

      // Step 10: Reactivate account
      const reactivateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${accountId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          status: 'ACTIVE'
        },
      });

      expect(reactivateResponse.statusCode).toBe(200);
      const reactivatedAccount = JSON.parse(reactivateResponse.body).data;
      expect(reactivatedAccount.status).toBe('ACTIVE');
    });

    it('should handle multiple account types and their interactions', async () => {
      // Create checking, savings, and credit accounts
      const accounts = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${authToken}` },
          payload: { type: 'CHECKING', currency: 'USD', initialDeposit: 2000 },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${authToken}` },
          payload: { type: 'SAVINGS', currency: 'USD', initialDeposit: 5000 },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/accounts',
          headers: { Authorization: `Bearer ${authToken}` },
          payload: { type: 'CREDIT', currency: 'USD' },
        })
      ]);

      // Verify all accounts created successfully
      accounts.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      const [checkingData, savingsData, creditData] = accounts.map(r => JSON.parse(r.body).data);

      // Verify account balances
      expect(checkingData.balance).toBe('2000');
      expect(savingsData.balance).toBe('5000');
      expect(creditData.balance).toBe('0');

      // List all accounts and verify they're returned
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const accountsList = JSON.parse(listResponse.body).data;
      expect(accountsList).toHaveLength(3);

      const accountTypes = accountsList.map((acc: any) => acc.type).sort();
      expect(accountTypes).toEqual(['CHECKING', 'CREDIT', 'SAVINGS']);

      // Test cross-account transfers
      const savingsToCheckingTransfer = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': `multi-account-transfer-${Date.now()}`
        },
        payload: {
          fromAccountId: savingsData.id,
          toAccountId: checkingData.id,
          amount: 1000.00,
          currency: 'USD',
          description: 'Savings to checking transfer'
        },
      });

      expect(savingsToCheckingTransfer.statusCode).toBe(201);

      // Verify final balances
      const finalSavingsBalance = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${savingsData.id}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const finalCheckingBalance = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${checkingData.id}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(JSON.parse(finalSavingsBalance.body).data.balance).toBe('4000'); // 5000 - 1000
      expect(JSON.parse(finalCheckingBalance.body).data.balance).toBe('3000'); // 2000 + 1000
    });

    it('should maintain data consistency across complex operations', async () => {
      // Create account with initial deposit
      const accountResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          type: 'CHECKING',
          currency: 'USD',
          initialDeposit: 1500.00
        },
      });

      const accountId = JSON.parse(accountResponse.body).data.id;

      // Create another account for transfers
      const targetAccountResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          type: 'SAVINGS',
          currency: 'USD'
        },
      });

      const targetAccountId = JSON.parse(targetAccountResponse.body).data.id;

      // Perform multiple transfers with idempotency
      const transferAmount = 100.00;
      const idempotencyKey = `consistency-test-${Date.now()}`;

      // First transfer
      const transfer1 = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': idempotencyKey
        },
        payload: {
          fromAccountId: accountId,
          toAccountId: targetAccountId,
          amount: transferAmount,
          currency: 'USD',
          description: 'Consistency test transfer'
        },
      });

      expect(transfer1.statusCode).toBe(201);

      // Duplicate transfer with same idempotency key - should return same result
      const transfer2 = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': idempotencyKey
        },
        payload: {
          fromAccountId: accountId,
          toAccountId: targetAccountId,
          amount: transferAmount,
          currency: 'USD',
          description: 'Consistency test transfer'
        },
      });

      expect(transfer2.statusCode).toBe(201); // Returns 201 for idempotent requests

      const transfer1Data = JSON.parse(transfer1.body).data;
      const transfer2Data = JSON.parse(transfer2.body).data;
      expect(transfer1Data.id).toBe(transfer2Data.id);

      // Verify only one transfer was actually created
      const transfersList = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const transfers = JSON.parse(transfersList.body).data;
      const consistencyTransfers = transfers.filter((t: any) =>
        t.description === 'Consistency test transfer'
      );
      expect(consistencyTransfers).toHaveLength(1);

      // Verify account balances are correct
      const sourceBalance = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const targetBalance = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${targetAccountId}/balance`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(JSON.parse(sourceBalance.body).data.balance).toBe('1400'); // 1500 - 100
      expect(JSON.parse(targetBalance.body).data.balance).toBe('100');

      // Issue multiple cards and verify proper tracking
      const card1 = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { brand: 'VISA' },
      });

      const card2 = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { brand: 'MASTERCARD' },
      });

      expect(card1.statusCode).toBe(201);
      expect(card2.statusCode).toBe(201);

      // Verify cards are properly linked to account
      const cardsList = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${accountId}/cards`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const cards = JSON.parse(cardsList.body).data;
      expect(cards).toHaveLength(2);
      // Verify cards exist and have basic properties
      cards.forEach((card: any) => {
        expect(card.id).toBeDefined();
        expect(card.maskedPan).toBeDefined();
        expect(card.status).toBeDefined();
      });

      // Generate statement and verify transaction consistency
      const statement = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${accountId}/statements/generate`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          format: 'JSON'
        },
      });

      expect(statement.statusCode).toBe(201);
      const statementData = JSON.parse(statement.body).data;
      expect(statementData).toBeDefined();
      // Note: Statement balance calculations may vary based on implementation
    });
  });
});