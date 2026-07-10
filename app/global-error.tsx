"use client"

import { useEffect } from "react"

/**
 * Root layout error boundary. Must define its own html/body
 * because it replaces the root layout when active.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#fafafa",
          color: "#171717",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            background: "#fff",
            padding: 24,
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>
            Application error
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#737373" }}>
            A critical error occurred. You can try again or reload the page.
          </p>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              background: "#f5f5f5",
              borderRadius: 8,
              padding: 12,
              wordBreak: "break-word",
            }}
          >
            {error.message || "Unknown error"}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 8,
                background: "#171717",
                color: "#fff",
                padding: "8px 12px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                background: "#fff",
                color: "#171717",
                padding: "8px 12px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
