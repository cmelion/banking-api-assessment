import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const createTransferSchema = {
  type: 'object',
  properties: {
    fromAccountId: { type: 'string' },
    toAccountId: { type: 'string' },
    amount: { type: 'number', minimum: 0.01 },
    currency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD' },
    description: { type: 'string', minLength: 1, maxLength: 255 },
  },
  required: ['fromAccountId', 'toAccountId', 'amount'],
  additionalProperties: false,
};

export const getTransferSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const listTransfersSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
    status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
    direction: { type: 'string', enum: ['incoming', 'outgoing', 'all'], default: 'all' },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

export const cancelTransferSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const validateCreateTransfer = ajv.compile(createTransferSchema);
export const validateGetTransfer = ajv.compile(getTransferSchema);
export const validateListTransfers = ajv.compile(listTransfersSchema);
export const validateCancelTransfer = ajv.compile(cancelTransferSchema);

export interface CreateTransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface GetTransferRequest {
  id: string;
}

export interface ListTransfersRequest {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  direction?: 'incoming' | 'outgoing' | 'all';
  startDate?: string;
  endDate?: string;
}

export interface CancelTransferRequest {
  id: string;
}