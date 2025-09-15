import { Prisma } from '@prisma/client';
import { prisma } from '../../db/connection';
import { CreateTransferRequest, ListTransfersRequest } from './schemas';
import { BusinessError, ValidationError, NotFoundError } from '../../lib/errors';
import { PaginationMeta } from '../../lib/types';

export class TransferService {
  async createTransfer(userId: string, request: CreateTransferRequest, idempotencyKey?: string) {
    const { fromAccountId, toAccountId, amount, currency = 'USD', description } = request;

    // Validate accounts exist and belong to user or are accessible
    const fromAccount = await prisma.account.findFirst({
      where: { id: fromAccountId, ownerId: userId, status: 'ACTIVE' },
    });

    if (!fromAccount) {
      throw new NotFoundError('Source account not found or not accessible');
    }

    const toAccount = await prisma.account.findFirst({
      where: { id: toAccountId, status: 'ACTIVE' },
    });

    if (!toAccount) {
      throw new NotFoundError('Destination account not found or not active');
    }

    if (fromAccountId === toAccountId) {
      throw new ValidationError('Cannot transfer to the same account');
    }

    if (fromAccount.currency !== currency) {
      throw new ValidationError('Transfer currency must match source account currency');
    }

    // Check sufficient funds
    if (fromAccount.balance.lessThan(amount)) {
      throw new BusinessError('Insufficient funds');
    }

    // Check for duplicate transfer if idempotency key provided
    if (idempotencyKey) {
      const existingTransfer = await prisma.transfer.findUnique({
        where: { idempotencyKey },
      });

      if (existingTransfer) {
        return existingTransfer;
      }
    }

    // Create transfer with database transaction
    return await prisma.$transaction(async (tx) => {
      // Create transfer record
      const newTransfer = await tx.transfer.create({
        data: {
          fromAccountId,
          toAccountId,
          amount: new Prisma.Decimal(amount),
          currency,
          description,
          status: 'PENDING',
          idempotencyKey,
        },
      });

      // Create debit transaction for source account
      await tx.transaction.create({
        data: {
          accountId: fromAccountId,
          type: 'DEBIT',
          amount: new Prisma.Decimal(amount),
          currency,
          description: description || `Transfer to ${toAccount.accountNumber}`,
          transferId: newTransfer.id,
          balanceAfter: fromAccount.balance.minus(amount),
        },
      });

      // Create credit transaction for destination account
      await tx.transaction.create({
        data: {
          accountId: toAccountId,
          type: 'CREDIT',
          amount: new Prisma.Decimal(amount),
          currency,
          description: description || `Transfer from ${fromAccount.accountNumber}`,
          transferId: newTransfer.id,
          balanceAfter: toAccount.balance.plus(amount),
        },
      });

      // Update account balances
      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      });

      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });

      // Mark transfer as completed
      return tx.transfer.update({
        where: { id: newTransfer.id },
        data: { status: 'COMPLETED' },
        include: {
          fromAccount: { select: { accountNumber: true, type: true } },
          toAccount: { select: { accountNumber: true, type: true } },
        },
      });
    });
  }

  async getTransferById(id: string, userId: string) {
    const transfer = await prisma.transfer.findFirst({
      where: {
        id,
        OR: [
          { fromAccount: { ownerId: userId } },
          { toAccount: { ownerId: userId } },
        ],
      },
      include: {
        fromAccount: { select: { accountNumber: true, type: true, ownerId: true } },
        toAccount: { select: { accountNumber: true, type: true, ownerId: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    return transfer;
  }

  async listTransfers(userId: string, params: ListTransfersRequest) {
    const { page = 1, limit = 25, status, direction = 'all', startDate, endDate } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.TransferWhereInput = {
      OR: [
        { fromAccount: { ownerId: userId } },
        { toAccount: { ownerId: userId } },
      ],
    };

    if (status) {
      where.status = status;
    }

    if (direction !== 'all') {
      if (direction === 'outgoing') {
        where.fromAccount = { ownerId: userId };
      } else if (direction === 'incoming') {
        where.toAccount = { ownerId: userId };
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: {
          fromAccount: { select: { accountNumber: true, type: true, ownerId: true } },
          toAccount: { select: { accountNumber: true, type: true, ownerId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.transfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return { transfers, meta };
  }

  async cancelTransfer(id: string, userId: string) {
    const transfer = await this.getTransferById(id, userId);

    if (transfer.status !== 'PENDING') {
      throw new BusinessError('Only pending transfers can be cancelled');
    }

    // Only allow cancellation if user owns the source account
    if (transfer.fromAccount?.ownerId !== userId) {
      throw new BusinessError('Only the source account owner can cancel the transfer');
    }

    return await prisma.transfer.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        fromAccount: { select: { accountNumber: true, type: true } },
        toAccount: { select: { accountNumber: true, type: true } },
      },
    });
  }
}