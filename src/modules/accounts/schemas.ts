import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const createAccountSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['CHECKING', 'SAVINGS', 'CREDIT'] },
    currency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD' },
    initialDeposit: { type: 'number', minimum: 0 },
  },
  required: ['type'],
  additionalProperties: false,
};

export const getAccountSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const listAccountsSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    type: { type: 'string', enum: ['CHECKING', 'SAVINGS', 'CREDIT'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'FROZEN', 'CLOSED'] },
  },
  additionalProperties: false,
};

export const updateAccountSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'FROZEN', 'CLOSED'] },
  },
  additionalProperties: false,
};

export const validateCreateAccount = ajv.compile(createAccountSchema);
export const validateGetAccount = ajv.compile(getAccountSchema);
export const validateListAccounts = ajv.compile(listAccountsSchema);
export const validateUpdateAccount = ajv.compile(updateAccountSchema);

export interface CreateAccountRequest {
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT';
  currency?: string;
  initialDeposit?: number;
}

export interface GetAccountRequest {
  id: string;
}

export interface ListAccountsRequest {
  page?: number;
  limit?: number;
  type?: 'CHECKING' | 'SAVINGS' | 'CREDIT';
  status?: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED';
}

export interface UpdateAccountRequest {
  status?: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED';
}