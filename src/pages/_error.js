/**
 * Custom Error Page for Pages Router fallback
 * This handles errors from older deployments and stale browser caches
 */
import Link from 'next/link';

function Error({ statusCode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      padding: '20px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>
        {statusCode || 'Error'}
      </h1>
      <p style={{ fontSize: '18px', color: '#888', marginBottom: '24px' }}>
        {statusCode === 404
          ? 'This page could not be found.'
          : 'An unexpected error occurred.'}
      </p>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>
        This may happen if your browser cached an older version of the site.
      </p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <Link
          href="/"
          style={{
            padding: '12px 24px',
            backgroundColor: '#22c55e',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '500',
          }}
        >
          Go Home
        </Link>
        <button
          onClick={() => {
            // Force refresh to get latest version
            window.location.reload(true);
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
