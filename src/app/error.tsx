"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Ocorreu um erro</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Algo deu errado ao carregar esta página.
      </p>

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: "rgba(0,0,0,0.06)",
          borderRadius: 12,
          overflow: "auto",
          fontSize: 12,
        }}
      >
        {error?.message || String(error)}
      </pre>

      <button
        onClick={reset}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.25)",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
        type="button"
      >
        Tentar novamente
      </button>
    </main>
  );
}
