/**
 * Formats raw backend or API errors into user-friendly Indonesian messages.
 */
export function formatAIError(err: any): string {
  if (!err) return 'Terjadi kesalahan pada layanan AI.';
  const msg = typeof err === 'string' ? err : (err.message || String(err));

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

  if (msg.includes('{') && msg.includes('}')) {
    try {
      const jsonStart = msg.indexOf('{');
      const jsonStr = msg.substring(jsonStart);
      const parsed = JSON.parse(jsonStr);
      if (parsed.message) {
        return formatAIError(parsed.message);
      }
    } catch (_) {}
  }

  return msg.length > 180 ? msg.substring(0, 180) + '...' : msg;
}
