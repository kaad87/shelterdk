// Next.js calls this on server startup. Vi loader Sentry-configen for det
// runtime der bootes, så samme codebase virker for Node API routes og
// Edge middleware uden eksplicit branching.
//
// Edge-config kan ikke bruge Node-only APIs, derfor den separate fil.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// onRequestError fanger uncaught fejl fra App Router renders + server
// actions og sender dem til Sentry. Vigtig hook for at få stack-traces
// fra "Error: Internal Server Error"-sider.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
