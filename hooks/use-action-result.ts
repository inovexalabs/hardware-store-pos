'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/result';

interface Options<T> {
  /** Shown as a success toast when the action succeeds. */
  successMessage?: string;
  /** Called with the action's data on success (e.g. navigate somewhere). */
  onSuccess?: (data: T) => void;
  /** Navigate here on success (optional). */
  redirectTo?: (data: T) => string | null | undefined;
}

/**
 * Watches the state returned by a server action (via useActionState)
 * and shows the right toast exactly once per attempt.
 */
export function useActionResult<T>(
  state: ActionResult<T> | null | undefined,
  options: Options<T> = {}
) {
  const router = useRouter();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const lastState = useRef<ActionResult<T> | null | undefined>(undefined);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;

    if (state.ok) {
      const opts = optionsRef.current;
      if (opts.successMessage) toast.success(opts.successMessage);
      const to = opts.redirectTo?.(state.data);
      if (to) {
        router.push(to);
      }
      opts.onSuccess?.(state.data);
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);
}
