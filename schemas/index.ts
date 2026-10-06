import type { z } from 'zod';
import { firstZodMessage } from './transaction';

/**
 * Validate server action input.  Throws a friendly message on
 * failure — the `safe()` wrapper turns it into an error Result.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(firstZodMessage(result.error));
  }
  return result.data;
}

export * from './product';
export * from './party';
export * from './transaction';
