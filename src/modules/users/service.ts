import { prisma } from '../../db/connection';
import { NotFoundError } from '../../lib/errors';

export class UserService {
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            type: true,
            currency: true,
            balance: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async updateUser(userId: string, updates: { name?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async getAllUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              accounts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getUserById(userId: string, requesterId: string, requesterRole: string) {
    // Users can only view their own profile unless they're admin
    if (userId !== requesterId && requesterRole !== 'ADMIN') {
      throw new NotFoundError('User');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            type: true,
            currency: true,
            balance: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }
}