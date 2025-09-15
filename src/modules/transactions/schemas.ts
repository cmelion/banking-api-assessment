import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const getTransactionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const listAccountTransactionsSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
    type: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    search: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
};

export const getAccountTransactionSummarySchema = {
  type: 'object',
  properties: {
    days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
  },
  additionalProperties: false,
};

export const validateGetTransaction = ajv.compile(getTransactionSchema);
export const validateListAccountTransactions = ajv.compile(listAccountTransactionsSchema);
export const validateGetAccountTransactionSummary = ajv.compile(getAccountTransactionSummarySchema);

export interface GetTransactionRequest {
  id: string;
}

export interface ListAccountTransactionsRequest {
  page?: number;
  limit?: number;
  type?: 'DEBIT' | 'CREDIT';
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface GetAccountTransactionSummaryRequest {
  days?: number;
}