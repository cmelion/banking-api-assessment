import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { prisma } from '../../db/connection';
import { jwtConfig } from '../../config';
import { AuthenticationError, ConflictError, ValidationError } from '../../lib/errors';
import { AuthTokens, JwtPayload, UserRole } from '../../lib/types';
import { User } from '@prisma/client';

// User type for API responses (excluding sensitive fields)
type SafeUser = Pick<User, 'id' | 'email' | 'name' | 'status' | 'createdAt'>;

export class AuthService {
  async signup(email: string, password: string, name: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    // Validate input
    if (!email || !password || !name) {
      throw new ValidationError('Email, password, and name are required');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create user and default checking account in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });

      // Generate account number
      const prefix = '1000';
      const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
      const accountNumber = prefix + randomPart;

      // Create default checking account with $0 balance
      await tx.account.create({
        data: {
          accountNumber,
          type: 'CHECKING',
          currency: 'USD',
          balance: 0,
          ownerId: user.id,
          status: 'ACTIVE',
        },
      });

      return user;
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.id, result.email);

    return { user: result, tokens };
  }

  async login(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Account is not active');
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Remove passwordHash from response
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
    };

    return { user: userResponse, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Find refresh token in database
      const tokenRecord = await prisma.refreshToken.findFirst({
        where: {
          tokenHash: await argon2.hash(refreshToken),
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      });

      if (!tokenRecord || tokenRecord.user.status !== 'ACTIVE') {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      // Revoke old refresh token
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      // Generate new tokens
      return await this.generateTokens(tokenRecord.user.id, tokenRecord.user.email);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = await argon2.hash(refreshToken);

      await prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      // Silently fail - logout should always succeed from user perspective
    }
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload: JwtPayload = {
      userId,
      email,
      role: UserRole.USER,
    };

    // Generate access token
    const accessToken = this.signToken(payload, jwtConfig.accessTokenExpiresIn);

    // Generate refresh token
    const refreshTokenValue = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(refreshTokenValue);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: this.parseExpiresIn(jwtConfig.accessTokenExpiresIn),
    };
  }

  private signToken(payload: JwtPayload, expiresIn: string): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, jwtConfig.secret, { expiresIn });
  }

  private parseExpiresIn(expiresIn: string): number {
    // Simple parser for common time formats
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
  }
}