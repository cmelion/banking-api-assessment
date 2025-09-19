import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/connection';
import { AccountService } from '../accounts/service';
import { AccountType, AccountStatus } from '../../lib/types';

describe('Transfers Module', () => {
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
  let frozenAccount: any;

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
        firstName: 'Test',
        lastName: 'User1',
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
        firstName: 'Test',
        lastName: 'User2',
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

    // Create a frozen account for testing
    frozenAccount = await accountService.createAccount(userId1, {
      type: AccountType.CHECKING,
      currency: 'USD',
      initialDeposit: 100.00,
    });

    // Freeze the account
    await prisma.account.update({
      where: { id: frozenAccount.id },
      data: { status: AccountStatus.FROZEN },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/transfers', () => {
    it('should create a successful transfer between accounts', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 100.00,
        currency: 'USD',
        description: 'Test transfer',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.fromAccountId).toBe(account1.id);
      expect(body.data.toAccountId).toBe(account2.id);
      expect(body.data.amount).toBe('100');
      expect(body.data.currency).toBe('USD');
      expect(body.data.description).toBe('Test transfer');
      expect(body.data.status).toBe('COMPLETED');

      // Verify account balances
      const updatedAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      const updatedAccount2 = await prisma.account.findUnique({
        where: { id: account2.id },
      });

      expect(updatedAccount1?.balance.toNumber()).toBe(900.00);
      expect(updatedAccount2?.balance.toNumber()).toBe(600.00);

      // Verify transactions were created
      const transactions = await prisma.transaction.findMany({
        where: {
          transferId: body.data.id,
        },
      });

      expect(transactions).toHaveLength(2);
      expect(transactions.some(t => t.type === 'DEBIT' && t.accountId === account1.id)).toBe(true);
      expect(transactions.some(t => t.type === 'CREDIT' && t.accountId === account2.id)).toBe(true);
    });

    it('should handle idempotency key correctly for duplicate requests', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 50.00,
        currency: 'USD',
        description: 'Idempotent transfer',
      };

      const idempotencyKey = `test-${Date.now()}`;

      // First request
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
          'Idempotency-Key': idempotencyKey,
        },
        payload: transferData,
      });

      expect(response1.statusCode).toBe(201);
      const body1 = JSON.parse(response1.body);
      const transferId = body1.data.id;

      // Second request with same idempotency key
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
          'Idempotency-Key': idempotencyKey,
        },
        payload: transferData,
      });

      expect(response2.statusCode).toBe(201);
      const body2 = JSON.parse(response2.body);

      // Should return the same transfer
      expect(body2.data.id).toBe(transferId);

      // Verify only one transfer was created
      const transfers = await prisma.transfer.findMany({
        where: { idempotencyKey },
      });
      expect(transfers).toHaveLength(1);

      // Verify balances changed only once
      const updatedAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      expect(updatedAccount1?.balance.toNumber()).toBe(950.00);
    });

    it('should reject transfer with insufficient funds', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 2000.00, // More than account1 balance
        currency: 'USD',
        description: 'Insufficient funds test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Insufficient funds');

      // Verify balances remain unchanged
      const unchangedAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      expect(unchangedAccount1?.balance.toNumber()).toBe(1000.00);
    });

    it('should reject transfer from non-existent account', async () => {
      const transferData = {
        fromAccountId: 'non-existent-account',
        toAccountId: account2.id,
        amount: 100.00,
        currency: 'USD',
        description: 'Non-existent account test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Source account not found');
    });

    it('should reject transfer to non-existent account', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: 'non-existent-account',
        amount: 100.00,
        currency: 'USD',
        description: 'Non-existent account test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Destination account not found');
    });

    it('should reject transfer from account not owned by user', async () => {
      const transferData = {
        fromAccountId: account3.id, // Owned by user 2
        toAccountId: account1.id,
        amount: 100.00,
        currency: 'USD',
        description: 'Wrong owner test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`, // User 1 token
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Source account not found or not accessible');
    });

    it('should reject transfer from frozen account', async () => {
      const transferData = {
        fromAccountId: frozenAccount.id,
        toAccountId: account2.id,
        amount: 50.00,
        currency: 'USD',
        description: 'Frozen account test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Source account not found or not accessible');
    });

    it('should reject transfer to same account', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account1.id,
        amount: 100.00,
        currency: 'USD',
        description: 'Same account test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Cannot transfer to the same account');
    });

    it('should reject transfer with currency mismatch', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 100.00,
        currency: 'EUR', // Different from account currency (USD)
        description: 'Currency mismatch test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Transfer currency must match source account currency');
    });

    it('should reject transfer without authentication', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 100.00,
        currency: 'USD',
        description: 'Unauthenticated test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        payload: transferData,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate transfer amount is positive', async () => {
      const transferData = {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: -100.00, // Negative amount
        currency: 'USD',
        description: 'Negative amount test',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate required fields', async () => {
      const transferData = {
        // Missing fromAccountId
        toAccountId: account2.id,
        amount: 100.00,
        currency: 'USD',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: transferData,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/transfers/:id', () => {
    let transferId: string;

    beforeEach(async () => {
      // Create a test transfer
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: account2.id,
          amount: 100.00,
          currency: 'USD',
          description: 'Test transfer for get',
        },
      });

      const body = JSON.parse(response.body);
      transferId = body.data.id;
    });

    it('should get transfer details for account owner', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/transfers/${transferId}`,
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(transferId);
      expect(body.data.fromAccountId).toBe(account1.id);
      expect(body.data.toAccountId).toBe(account2.id);
      expect(body.data.amount).toBe('100');
      expect(body.data.status).toBe('COMPLETED');
    });

    it('should reject access from unauthorized user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/transfers/${transferId}`,
        headers: {
          Authorization: `Bearer ${authToken2}`, // Different user
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent transfer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers/non-existent-id',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/transfers', () => {
    beforeEach(async () => {
      // Create multiple test transfers
      await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: account2.id,
          amount: 100.00,
          currency: 'USD',
          description: 'First transfer',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account2.id,
          toAccountId: account1.id,
          amount: 50.00,
          currency: 'USD',
          description: 'Second transfer',
        },
      });

      // Transfer involving user 2's account (outgoing from user1's perspective)
      await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: account3.id,
          amount: 25.00,
          currency: 'USD',
          description: 'Transfer to user 2',
        },
      });

      // Transfer from user 2's account to user 1's account (incoming from user1's perspective)
      await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken2}`,
        },
        payload: {
          fromAccountId: account3.id,
          toAccountId: account1.id,
          amount: 10.00,
          currency: 'USD',
          description: 'Transfer from user 2',
        },
      });
    });

    it('should list transfers for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers?page=1&limit=25',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.pagination).toBeDefined();

      // Check transfer direction is correctly calculated
      // Transfers should be classified as outgoing (from user's accounts) or incoming (to user's accounts)
      const outgoingTransfers = body.data.filter((t: any) => t.direction === 'outgoing');
      const incomingTransfers = body.data.filter((t: any) => t.direction === 'incoming');

      expect(outgoingTransfers.length).toBeGreaterThan(0);
      expect(incomingTransfers.length).toBeGreaterThan(0);
    });

    it('should filter transfers by direction', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers?direction=outgoing',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.every((t: any) => t.direction === 'outgoing')).toBe(true);
    });

    it('should filter transfers by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers?status=COMPLETED',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.every((t: any) => t.status === 'COMPLETED')).toBe(true);
    });

    it('should handle pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers?page=1&limit=1',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.meta.pagination.page).toBe(1);
      expect(body.meta.pagination.limit).toBe(1);
    });
  });

  describe('PATCH /api/v1/transfers/:id/cancel', () => {
    let pendingTransferId: string;

    beforeEach(async () => {
      // Create a transfer and manually set it to PENDING for cancellation test
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: account2.id,
          amount: 100.00,
          currency: 'USD',
          description: 'Transfer to cancel',
        },
      });

      const body = JSON.parse(response.body);
      pendingTransferId = body.data.id;

      // Set transfer to PENDING status for cancellation test
      await prisma.transfer.update({
        where: { id: pendingTransferId },
        data: { status: 'PENDING' },
      });
    });

    it('should cancel pending transfer', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/transfers/${pendingTransferId}/cancel`,
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(pendingTransferId);
      expect(body.data.status).toBe('CANCELLED');
      expect(body.data.cancelledAt).toBeDefined();
    });

    it('should reject cancellation by non-owner', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/transfers/${pendingTransferId}/cancel`,
        headers: {
          Authorization: `Bearer ${authToken2}`, // Different user
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject cancellation of completed transfer', async () => {
      // Set transfer to COMPLETED
      await prisma.transfer.update({
        where: { id: pendingTransferId },
        data: { status: 'COMPLETED' },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/transfers/${pendingTransferId}/cancel`,
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Only pending transfers can be cancelled');
    });
  });

  describe('Atomic Transaction Handling', () => {
    it('should maintain consistency if transfer fails', async () => {
      // Get initial balances
      const initialAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      const initialAccount2 = await prisma.account.findUnique({
        where: { id: account2.id },
      });

      // Try to transfer to a non-existent account (should fail)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: 'non-existent-account',
          amount: 100.00,
          currency: 'USD',
          description: 'Failed transfer test',
        },
      });

      expect(response.statusCode).toBe(404);

      // Verify balances remain unchanged
      const finalAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      const finalAccount2 = await prisma.account.findUnique({
        where: { id: account2.id },
      });

      expect(finalAccount1?.balance.toNumber()).toBe(initialAccount1?.balance.toNumber());
      expect(finalAccount2?.balance.toNumber()).toBe(initialAccount2?.balance.toNumber());

      // Verify no partial transaction records were created
      const transactions = await prisma.transaction.findMany({
        where: {
          description: 'Failed transfer test',
        },
      });
      expect(transactions).toHaveLength(0);
    });

    it('should create both debit and credit transactions atomically', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: {
          Authorization: `Bearer ${authToken1}`,
        },
        payload: {
          fromAccountId: account1.id,
          toAccountId: account2.id,
          amount: 100.00,
          currency: 'USD',
          description: 'Atomic transaction test',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify both transactions exist with correct balance calculations
      const transactions = await prisma.transaction.findMany({
        where: {
          transferId: body.data.id,
        },
        include: {
          account: true,
        },
      });

      expect(transactions).toHaveLength(2);

      const debitTransaction = transactions.find(t => t.type === 'DEBIT');
      const creditTransaction = transactions.find(t => t.type === 'CREDIT');

      expect(debitTransaction).toBeDefined();
      expect(creditTransaction).toBeDefined();

      // Verify balance calculations
      expect(debitTransaction?.balanceAfter.toNumber()).toBe(900.00);
      expect(creditTransaction?.balanceAfter.toNumber()).toBe(600.00);

      // Verify actual account balances match transaction balanceAfter
      const updatedAccount1 = await prisma.account.findUnique({
        where: { id: account1.id },
      });
      const updatedAccount2 = await prisma.account.findUnique({
        where: { id: account2.id },
      });

      expect(updatedAccount1?.balance.toNumber()).toBe(debitTransaction?.balanceAfter.toNumber());
      expect(updatedAccount2?.balance.toNumber()).toBe(creditTransaction?.balanceAfter.toNumber());
    });
  });
});