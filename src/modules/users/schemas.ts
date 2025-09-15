import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
});

export const userParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

// Type exports
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;