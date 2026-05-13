/**
 * Generates a secure, unguessable filename for storage.
 * Combines a prefix, UUID v4, and a random suffix to prevent enumeration.
 * Format: {prefix}_{uuid}_{random8}.{ext}
 */
export function generateSecureFileName(prefix: string, ext: string = 'pdf'): string {
  const uuid = crypto.randomUUID();
  const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Sanitize prefix to alphanumeric
  const cleanPrefix = prefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  return `${cleanPrefix}_${uuid}_${randomSuffix}.${ext}`;
}
