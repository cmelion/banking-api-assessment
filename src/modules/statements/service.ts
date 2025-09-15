import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../db/connection';
import { GenerateStatementRequest, ListAccountStatementsRequest } from './schemas';
import { BusinessError, NotFoundError } from '../../lib/errors';
import { PaginationMeta } from '../../lib/types';

export class StatementService {
  async generateStatement(accountId: string, userId: string, request: GenerateStatementRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { startDate, endDate } = request;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range
    if (start >= end) {
      throw new BusinessError('Start date must be before end date');
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      throw new BusinessError('Statement period cannot exceed 365 days');
    }

    // Check if statement already exists for this period
    const existingStatement = await prisma.statement.findFirst({
      where: {
        accountId,
        periodStart: start,
        periodEnd: end,
      },
    });

    if (existingStatement) {
      return existingStatement;
    }

    // Get transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        transfer: {
          select: {
            id: true,
            fromAccountId: true,
            toAccountId: true,
          },
        },
      },
    });

    // Calculate statement summary
    const totalDebits = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    const totalCredits = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    const openingBalance = transactions.length > 0
      ? transactions[0].balanceAfter.minus(
          transactions[0].type === 'CREDIT' ? transactions[0].amount : transactions[0].amount.negated()
        )
      : account.balance;

    const closingBalance = transactions.length > 0
      ? transactions[transactions.length - 1].balanceAfter
      : account.balance;

    // Generate statement filename with comprehensive summary information
    const fileName = `statement-${account.accountNumber}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}-opening-${openingBalance.toString()}-closing-${closingBalance.toString()}-credits-${totalCredits.toString()}-debits-${totalDebits.toString()}.json`;

    // In a real implementation, this would generate actual PDF/CSV files with:
    // - Opening balance: ${openingBalance}
    // - Closing balance: ${closingBalance}
    // - Total credits: ${totalCredits}
    // - Total debits: ${totalDebits}
    // - All transaction details for the period

    return await prisma.statement.create({
      data: {
        accountId,
        periodStart: start,
        periodEnd: end,
        fileUrl: `/statements/${fileName}`,
      },
      include: {
        account: {
          select: {
            accountNumber: true,
            type: true,
            currency: true,
          },
        },
      },
    });
  }

  async getStatementById(id: string, userId: string) {
    const statement = await prisma.statement.findFirst({
      where: {
        id,
        account: { ownerId: userId },
      },
      include: {
        account: {
          select: {
            accountNumber: true,
            type: true,
            currency: true,
          },
        },
      },
    });

    if (!statement) {
      throw new NotFoundError('Statement not found');
    }

    return statement;
  }

  async listAccountStatements(accountId: string, userId: string, params: ListAccountStatementsRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { page = 1, limit = 10, year } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.StatementWhereInput = {
      accountId,
    };

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      where.periodStart = {
        gte: startOfYear,
        lt: endOfYear,
      };
    }

    const [statements, total] = await Promise.all([
      prisma.statement.findMany({
        where,
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          fileUrl: true,
          createdAt: true,
          account: {
            select: {
              accountNumber: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.statement.count({ where }),
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

    return { statements, meta };
  }
}