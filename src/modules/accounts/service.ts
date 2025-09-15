import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../db/connection';
import { ValidationError, NotFoundError, AuthorizationError, InternalServerError } from '../../lib/errors';
import { AccountStatus, TransactionType } from '../../lib/types';
import { CreateAccountRequest, UpdateAccountRequest } from './schemas';

export class AccountService {
  private generateAccountNumber(): string {
    const prefix = '1000';
    const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    return prefix + randomPart;
  }

  async createAccount(userId: string, data: CreateAccountRequest): Promise<any> {
    try {
      const accountNumber = this.generateAccountNumber();

      return await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            accountNumber,
            type: data.type,
            currency: data.currency || 'USD',
            balance: new Decimal(data.initialDeposit || 0),
            ownerId: userId,
            status: AccountStatus.ACTIVE,
          },
        });

        if (data.initialDeposit && data.initialDeposit > 0) {
          await tx.transaction.create({
            data: {
              accountId: account.id,
              type: TransactionType.CREDIT,
              amount: new Decimal(data.initialDeposit),
              currency: account.currency,
              description: 'Initial deposit',
              balanceAfter: account.balance,
            },
          });
        }

        return account;
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('account_number')) {
        return this.createAccount(userId, data);
      }
      throw new InternalServerError('Failed to create account', error);
    }
  }

  async getAccountById(accountId: string, userId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    if (account.ownerId !== userId) {
      throw new AuthorizationError('Access denied to this account');
    }

    return account;
  }

  async listAccountsByUser(userId: string, options: { page?: number; limit?: number; type?: string; status?: string } = {}) {
    const { page = 1, limit = 10, type, status } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      ownerId: userId,
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              transactions: true,
              cards: true,
            },
          },
        },
      }),
      prisma.account.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      accounts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async updateAccount(accountId: string, userId: string, data: UpdateAccountRequest) {
    const account = await this.getAccountById(accountId, userId);

    if (data.status && data.status === AccountStatus.CLOSED) {
      if (account.balance.toNumber() !== 0) {
        throw new ValidationError('Cannot close account with non-zero balance');
      }
    }

    return await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(data.status && { status: data.status }),
        updatedAt: new Date(),
      },
    });
  }

  async getAccountBalance(accountId: string, userId: string) {
    const account = await this.getAccountById(accountId, userId);
    return {
      accountId: account.id,
      balance: account.balance,
      currency: account.currency,
      status: account.status,
    };
  }
}