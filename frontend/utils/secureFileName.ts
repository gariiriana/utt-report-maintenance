// ============================================================================
// FILE: secureFileName.ts
// Deskripsi: Utility untuk membuat nama file yang aman dan tidak bisa ditebak.
//            Digunakan saat upload file ke Firebase Storage supaya nama file
//            unik dan tidak bisa di-enumerate (ditebak URL-nya oleh orang luar).
// Format output: {prefix}_{uuid}_{random8}.{ext}
// Contoh: "laporan_3f2a9c01-..._a1b2c3d4.pdf"
// ============================================================================

/**
 * Generates a secure, unguessable filename for storage.
 * Combines a prefix, UUID v4, and a random suffix to prevent enumeration.
 * Format: {prefix}_{uuid}_{random8}.{ext}
 */
export function generateSecureFileName(prefix: string, ext: string = 'pdf'): string {
  // Buat UUID unik (v4) — dijamin unik setiap kali dipanggil
  const uuid = crypto.randomUUID();

  // Tambahan random suffix 8 karakter hex untuk keamanan ekstra
  const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Bersihkan prefix dari karakter spesial, hanya huruf & angka yang diizinkan
  // Contoh: "Laporan CM!" -> "laporan_cm_"
  const cleanPrefix = prefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  return `${cleanPrefix}_${uuid}_${randomSuffix}.${ext}`;
}
