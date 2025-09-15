import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const generateStatementSchema = {
  type: 'object',
  properties: {
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    format: { type: 'string', enum: ['PDF', 'CSV', 'JSON'], default: 'PDF' },
  },
  required: ['startDate', 'endDate'],
  additionalProperties: false,
};

export const getStatementSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false,
};

export const listAccountStatementsSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    year: { type: 'number', minimum: 2020, maximum: 2030 },
  },
  additionalProperties: false,
};

export const validateGenerateStatement = ajv.compile(generateStatementSchema);
export const validateGetStatement = ajv.compile(getStatementSchema);
export const validateListAccountStatements = ajv.compile(listAccountStatementsSchema);

export interface GenerateStatementRequest {
  startDate: string;
  endDate: string;
  format?: 'PDF' | 'CSV' | 'JSON';
}

export interface GetStatementRequest {
  id: string;
}

export interface ListAccountStatementsRequest {
  page?: number;
  limit?: number;
  year?: number;
}