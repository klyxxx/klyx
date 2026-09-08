// Vitest-only no-op for Next.js' server-only marker.
// Production builds still resolve `server-only` through Next.js so client imports
// remain rejected by the framework boundary.
export {};
