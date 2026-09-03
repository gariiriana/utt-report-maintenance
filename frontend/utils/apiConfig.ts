/**
 * Helper utility to construct correct backend API endpoint URLs
 * across both local development (Vite dev proxy) and production (Vercel Serverless / Firebase Hosting).
 */
export function getApiEndpoint(path: string): string {
  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (!apiBaseUrl) {
    return cleanPath;
  }

  const base = apiBaseUrl.replace(/\/+$/, '');
  if (base.endsWith('/api')) {
    const subPath = cleanPath.startsWith('/api/')
      ? cleanPath.substring(4)
      : (cleanPath === '/api' ? '' : cleanPath);
    return `${base}${subPath}`;
  }

  return `${base}${cleanPath}`;
}
