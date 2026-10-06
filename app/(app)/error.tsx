'use client';

import { ErrorPanel } from '@/components/shared/error-panel';

/** Errors inside the app keep the sidebar and header, so staff can move on. */
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel {...props} />;
}
