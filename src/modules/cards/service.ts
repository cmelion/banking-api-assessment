import { Prisma } from '@prisma/client';
import { prisma } from '../../db/connection';
import { CreateCardRequest, ListAccountCardsRequest, UpdateCardRequest } from './schemas';
import { BusinessError, NotFoundError } from '../../lib/errors';
import { PaginationMeta } from '../../lib/types';

export class CardService {
  private generateCardNumber(): string {
    // Generate a mock 16-digit card number (starts with 4 for Visa-like)
    const prefix = '4';
    const randomDigits = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
    return prefix + randomDigits;
  }

  private maskCardNumber(cardNumber: string): string {
    return `****-****-****-${cardNumber.slice(-4)}`;
  }

  private getBrandFromNumber(cardNumber: string): string {
    if (cardNumber.startsWith('4')) return 'VISA';
    if (cardNumber.startsWith('5')) return 'MASTERCARD';
    return 'VISA'; // Default
  }

  async createCard(accountId: string, userId: string, _request: CreateCardRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId, status: 'ACTIVE' },
    });

    if (!account) {
      throw new NotFoundError('Account not found or not active');
    }

    // Check card limits (e.g., max 3 cards per account)
    const existingCards = await prisma.card.count({
      where: { accountId, status: { not: 'EXPIRED' } },
    });

    if (existingCards >= 3) {
      throw new BusinessError('Maximum number of cards reached for this account');
    }

    const cardNumber = this.generateCardNumber();
    const maskedPan = this.maskCardNumber(cardNumber);
    const brand = this.getBrandFromNumber(cardNumber);
    const last4 = cardNumber.slice(-4);
    const now = new Date();
    const expMonth = now.getMonth() + 1;
    const expYear = now.getFullYear() + 3;

    return await prisma.card.create({
      data: {
        accountId,
        maskedPan,
        brand,
        last4,
        expMonth,
        expYear,
        status: 'ACTIVE',
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

  async getCardById(id: string, userId: string) {
    const card = await prisma.card.findFirst({
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

    if (!card) {
      throw new NotFoundError('Card not found');
    }

    return card;
  }

  async listAccountCards(accountId: string, userId: string, params: ListAccountCardsRequest) {
    // Verify account ownership
    const account = await prisma.account.findFirst({
      where: { id: accountId, ownerId: userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { page = 1, limit = 10, status } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.CardWhereInput = {
      accountId,
    };

    if (status) {
      where.status = status;
    }

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        select: {
          id: true,
          maskedPan: true,
          brand: true,
          last4: true,
          expMonth: true,
          expYear: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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
      prisma.card.count({ where }),
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

    return { cards, meta };
  }

  async updateCard(id: string, userId: string, request: UpdateCardRequest) {
    const card = await this.getCardById(id, userId);

    if (card.status === 'EXPIRED') {
      throw new BusinessError('Cannot update expired card');
    }

    const updateData: Prisma.CardUpdateInput = {};

    if (request.status) {
      updateData.status = request.status;
    }

    return await prisma.card.update({
      where: { id },
      data: updateData,
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
}