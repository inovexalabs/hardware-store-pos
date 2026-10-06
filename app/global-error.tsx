'use client';

import { useEffect } from 'react';

/** Last resort when even the root layout fails. Keeps its own minimal styling. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 16,
          background: '#fafafa',
          color: '#111',
        }}
      >
        <title>Something went wrong · Inovexa POS</title>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong.</h1>
          <p style={{ color: '#555' }}>
            The app could not start. Check your internet connection and try again.
            {error.digest ? ` (code ${error.digest})` : ''}
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 8,
              border: 0,
              background: '#111',
              color: '#fff',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
