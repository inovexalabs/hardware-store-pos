'use server';

import { friendlyError } from '@/lib/errors';
import { fail, type ActionResult } from '@/lib/result';

/**
 * Wraps every server action: nothing technical ever reaches the UI.
 */
export async function safe<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    console.error('[server action]', error);
    return fail(friendlyError(error));
  }
}
