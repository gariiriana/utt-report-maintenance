// ============================================================================
// FILE: aiErrorUtils.ts
// Deskripsi: Utility untuk mengubah error mentah dari backend/API menjadi
//            pesan error yang ramah pengguna dalam Bahasa Indonesia.
//            Khusus untuk menangani error dari layanan AI (Google Gemini).
// ============================================================================

/**
 * Formats raw backend or API errors into user-friendly Indonesian messages.
 */
export function formatAIError(err: any): string {
  // Kalau error kosong/null, tampilkan pesan default
  if (!err) return 'Terjadi kesalahan pada layanan AI.';

  // Ambil pesan error — bisa berupa string langsung atau objek Error
  const msg = typeof err === 'string' ? err : (err.message || String(err));

  // Deteksi error kuota/rate limit dari Google Gemini API
  // Error 429 = Too Many Requests (kuota habis)
  // RESOURCE_EXHAUSTED = kuota Google Cloud habis
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('limit') ||
    msg.includes('padat') ||
    msg.includes('free_tier_requests')
  ) {
    return 'Layanan AI sedang padat (Batas Kuota Google Gemini 15 request/menit tercapai). Mohon tunggu ~30 detik lalu coba lagi.';
  }

  // Coba parse error yang formatnya JSON (kadang backend kirim error dalam JSON)
  // Kalau berhasil di-parse, ambil field 'message'-nya
  if (msg.includes('{') && msg.includes('}')) {
    try {
      const jsonStart = msg.indexOf('{');
      const jsonStr = msg.substring(jsonStart);
      const parsed = JSON.parse(jsonStr);
      if (parsed.message) {
        return formatAIError(parsed.message); // Rekursif: parse lagi pesan di dalamnya
      }
    } catch (_) {} // Kalau gagal parse, lanjut ke fallback di bawah
  }

  // Fallback: potong pesan kalau terlalu panjang (max 180 karakter)
  return msg.length > 180 ? msg.substring(0, 180) + '...' : msg;
}
