// Banking API Types and Enums

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const AccountType = {
  CHECKING: 'CHECKING',
  SAVINGS: 'SAVINGS',
  CREDIT: 'CREDIT',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const TransactionType = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransferStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const CardStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

// User Roles
export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Auth Types
export interface JwtPayload {
  userId: string;
  email: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

// Request Context
export interface RequestContext {
  userId: string;
  email: string;
  role: UserRole;
  correlationId: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}