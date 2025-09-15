// Custom Error Classes for Banking API

export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class BusinessError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BUSINESS_ERROR', details);
  }
}

export class InsufficientFundsError extends BaseError {
  constructor(availableBalance: string, requestedAmount: string) {
    super(
      'Insufficient funds for this transaction',
      409,
      'INSUFFICIENT_FUNDS',
      { availableBalance, requestedAmount }
    );
  }
}

export class DuplicateTransferError extends BaseError {
  constructor(idempotencyKey: string) {
    super(
      'Transfer with this idempotency key already exists',
      409,
      'DUPLICATE_TRANSFER',
      { idempotencyKey }
    );
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

// Error type guard
export function isBaseError(error: any): error is BaseError {
  return error instanceof BaseError;
}