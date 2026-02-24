"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next.js 14 known bug: error can be null, causing "Cannot read properties of null (reading 'digest')"
  // This global error boundary prevents that crash from propagating
  const message = error?.message || "An unexpected error occurred";
  const digest = error?.digest;

  // Log for debugging but don't crash
  if (error) {
    console.error("[GlobalError]", message, digest ? `(digest: ${digest})` : "");
  }

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>{message}</p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
