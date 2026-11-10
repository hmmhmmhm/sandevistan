/** Packaged builds use the public API Worker; local/Sites builds stay same-origin. */
export function apiEndpoint(path: string, origin = import.meta.env.VITE_PUBLIC_API_ORIGIN || ""): string {
  return origin ? new URL(path, origin).toString() : path;
}
