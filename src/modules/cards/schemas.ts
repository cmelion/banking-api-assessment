import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const createCardSchema = {
  type: 'object',
  properties: {
    // Card creation is simplified - most fields are auto-generated
  },
  additionalProperties: false,
};

export const getCardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const listAccountCardsSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED'] },
  },
  additionalProperties: false,
};

export const updateCardSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] },
  },
  additionalProperties: false,
};

export const validateCreateCard = ajv.compile(createCardSchema);
export const validateGetCard = ajv.compile(getCardSchema);
export const validateListAccountCards = ajv.compile(listAccountCardsSchema);
export const validateUpdateCard = ajv.compile(updateCardSchema);

export interface CreateCardRequest {
  // Empty - card creation is auto-generated
}

export interface GetCardRequest {
  id: string;
}

export interface ListAccountCardsRequest {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'EXPIRED';
}

export interface UpdateCardRequest {
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}