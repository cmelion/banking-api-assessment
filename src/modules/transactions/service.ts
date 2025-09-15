import { Prisma } from '@prisma/client';
import { prisma } from '../../db/connection';
import { ListAccountTransactionsRequest, GetAccountTransactionSummaryRequest } from './schemas';
import { NotFoundError } from '../../lib/errors';
import { PaginationMeta } from '../../lib/types';

export class TransactionService {
  async getTransactionById(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { ownerId: userId },
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            type: true,
            currency: true,
          },
        },
        transfer: {
          select: {
            id: true,
            status: true,
            fromAccountId: true,
            toAccountId: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  async getAccountTransactions(accountId: string, userId: string, params: ListAccountTransactionsRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { page = 1, limit = 25, type, startDate, endDate, search } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      accountId,
    };

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { counterparty: { contains: search } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          transfer: {
            select: {
              id: true,
              status: true,
              fromAccountId: true,
              toAccountId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.transaction.count({ where }),
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

    return { transactions, meta };
  }

  async getAccountTransactionSummary(accountId: string, userId: string, params: GetAccountTransactionSummaryRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { days = 30 } = params;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const where: Prisma.TransactionWhereInput = {
      accountId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [
      totalTransactions,
      totalDebits,
      totalCredits,
      debitCount,
      creditCount,
      largestDebit,
      largestCredit,
    ] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'DEBIT' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: { ...where, type: 'DEBIT' } }),
      prisma.transaction.count({ where: { ...where, type: 'CREDIT' } }),
      prisma.transaction.findFirst({
        where: { ...where, type: 'DEBIT' },
        orderBy: { amount: 'desc' },
        select: { amount: true },
      }),
      prisma.transaction.findFirst({
        where: { ...where, type: 'CREDIT' },
        orderBy: { amount: 'desc' },
        select: { amount: true },
      }),
    ]);

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
      },
      summary: {
        totalTransactions,
        totalDebits: totalDebits._sum.amount?.toString() || '0',
        totalCredits: totalCredits._sum.amount?.toString() || '0',
        netChange: (totalCredits._sum.amount || new Prisma.Decimal(0))
          .minus(totalDebits._sum.amount || new Prisma.Decimal(0))
          .toString(),
        debitCount,
        creditCount,
        averageDebitAmount: debitCount > 0
          ? (totalDebits._sum.amount || new Prisma.Decimal(0)).dividedBy(debitCount).toString()
          : '0',
        averageCreditAmount: creditCount > 0
          ? (totalCredits._sum.amount || new Prisma.Decimal(0)).dividedBy(creditCount).toString()
          : '0',
        largestDebit: largestDebit?.amount?.toString() || '0',
        largestCredit: largestCredit?.amount?.toString() || '0',
      },
    };
  }
}