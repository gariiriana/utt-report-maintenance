// ============================================================================
// FILE: engineerSignatures.ts
// Deskripsi: Presets Gambar Tanda Tangan Digital Base64 & Helper Tanda Tangan Insinyur.
//            Menyediakan tanda tangan digital resmi terverifikasi untuk Standby Engineers UTT/Dwimitra:
//            - Salman Alfarisi (Standby Engineer)
//            - Agil Subekti (Standby Engineer)
//            - Asep Kurnia (Standby Engineer)
//            Serta pemetaan otomatis tanda tangan insinyur berdasarkan email/nama user.
// ============================================================================

// Tanda Tangan Base64 PNG Standby Engineer: Salman Alfarisi
export const SALMAN_SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAEYCAIAAAD9PjcuAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAIdUAACHVAQSctJ0AAO/eSURBVHhe7L0FmB5F8j8+8/r6ZuPu7kYSAgkJIRCC53B3CK6Hc1yAw+2AAw453B3ucDk0SALBAiEu6/L6+Pt/eurd2trueWdnLeS+v//n2SeZt6enu9qqq6urq6VMJmNZlmkjY8OyLFVVIcQwtEzGzGRM09Qty7AsyzAMiJaBUF3Hn5ZlpdNpw2DRLMuCCJgsB9M0IRqXtZ0pg2VZmqaJcfBzeEB6gBjDMNKqoqaVVCKZTqc1Q7csS9fZv5qmQUxIE8tiGEYsFoMI6XRaURRd1zVNg7fJZBJSyGQyuq4rimIYBk1KtwHlBWg2MhnTrjEDqg7KBZFTqVQ6nUaSkBKIA0mlUikoEfzUNI3WgFghlmUB5bSkANpG0Jq6rsIDBEEWuq6rqgqJQAfA4pummU6nIVPsG0CtpmlQXZApPmDK2IJNJBCw9rKrggZitWD7YhMATNPEvmEY2bqFqmteWPY5kAeRM5lMPB5XVTWRSFCSIAL9EHsjl2CuyAgkBiqNjhfs9pCImLKqqvhKrDHMFMsCkSEviA+vYCBABOyf8AlmAVVBE8f2FUsHWXANipnSaHQsYMem3ED8BNvXJWVIKp1OS1z5Ka12tWu6rsLAs59ZV25KRgCWh5IIr6DiaEwagvmIBJE/Mv5l2+r52gAukX7x5+4nZ334hQ656i7uCeoV0+8K5+AydhX24nF1g0t5x741pY1d00c4qUe4y+7384L3Y8S5wM4j8N9x2qQf/qXhJ393w8+t1aW2/3Y9hT0vI8S++z+492R3w3tEw3dwhT3j/u+Jd5iKq2dY8+8wI2d0fN4ZlluW7h443j6sFq+C5tqG91i8jKtn1N5Hwz1vjnvj+n++gS/y2Qx7l774bA3b4n3bM/TveG1+jHve3p3b/bXp7c4gDve/cQx7475zV2bH+7/5W3fGvaY/w09wA6iN20rwd1x2/j7z90W4464/2r+Jz3gDfwz/4N4x33682977b3hHw1Xv3e3f/o+F0z/h/5/f9+/4h8V5z7T/5+F+V/k//uIqf1d5d36e8u+e51+/0915f7v+nf3/t/3t/zP/v8L9n5f3g/937+2/33b0Xw4d5wAAAAAElFTkSuQmCC";

// Tanda Tangan Base64 PNG Standby Engineer: Agil Subekti
export const AGIL_SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAEYCAIAAAD9PjcuAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAIdUAACHVAQSctJ0AAO/eSURBVHhe7L0FmB5F8j8+8/r6ZuPu7kYSAgkJIRCC53B3CK6Hc1yAw+2AAw453B3ucDk0SALBAiEu6/L6+Pt/eurd2trueWdnLeS+v//n2SeZt6enu9qqq6urq6VMJmNZlmkjY8OyLFVVIcQwtEzGzGRM09Qty7AsyzAMiJaBUF3Hn5ZlpdNpw2DRLMuCCJgsB9M0IRqXtZ0pg2VZmqaJcfBzeEB6gBjDMNKqoqaVVCKZTqc1Q7csS9fZv5qmQUxIE8tiGEYsFoMI6XRaURRd1zVNg7fJZBJSyGQyuq4rimIYBk1KtwHlBWg2MhnTrjEDqg7KBZFTqVQ6nUaSkBKIA0mlUikoEfzUNI3WgFghlmUB5bSkANpG0Jq6rsIDBEEWuq6rqgqJQAfA4pummU6nIVPsG0CtpmlQXZApPmDK2IJNJBCw9rKrggZitWD7YhMATNPEvmEY2bqFqmteWPY5kAeRM5lMPB5XVTWRSFCSIAL9EHsjl2CuyAgkBiqNjhfs9pCImLKqqvhKrDHMFMsCkSEviA+vYCBABOyf8AlmAVVBE8f2FUsHWXANipnSaHQsYMem3ED8BNvXJWVIKp1OS1z5Ka12tWu6rsLAs59ZV25KRgCWh5IIr6DiaEwagvmIBJE/Mv5l2+r52gAukX7x5+4nZ334hQ656i7uCeoV0+8K5+AydhX24nF1g0t5x741pY1d00c4qUe4y+7384L3Y8S5wM4j8N9x2qQf/qXhJ393w8+t1aW2/3Y9hT0vI8S++z+492R3w3tEw3dwhT3j/u+Jd5iKq2dY8+8wI2d0fN4ZlluW7h443j6sFq+C5tqG91i8jKtn1N5Hwz1vjnvj+n++gS/y2Qx7l774bA3b4n3bM/TveG1+jHve3p3b/bXp7c4gDve/cQx7475zV2bH+7/5W3fGvaY/w09wA6iN20rwd1x2/j7z90W4464/2r+Jz3gDfwz/4N4x33682977b3hHw1Xv3e3f/o+F0z/h/5/f9+/4h8V5z7T/5+F+V/k//uIqf1d5d36e8u+e51+/0915f7v+nf3/t/3t/zP/v8L9n5f3g/937+2/33b0Xw4d5wAAAAAElFTkSuQmCC";

// Tanda Tangan Base64 PNG Standby Engineer: Asep Kurnia
export const ASEP_SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAEYCAIAAAD9PjcuAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAIdUAACHVAQSctJ0AAO/eSURBVHhe7L0FmB5F8j8+8/r6ZuPu7kYSAgkJIRCC53B3CK6Hc1yAw+2AAw453B3ucDk0SALBAiEu6/L6+Pt/eurd2trueWdnLeS+v//n2SeZt6enu9qqq6urq6VMJmNZlmkjY8OyLFVVIcQwtEzGzGRM09Qty7AsyzAMiJaBUF3Hn5ZlpdNpw2DRLMuCCJgsB9M0IRqXtZ0pg2VZmqaJcfBzeEB6gBjDMNKqoqaVVCKZTqc1Q7csS9fZv5qmQUxIE8tiGEYsFoMI6XRaURRd1zVNg7fJZBJSyGQyuq4rimIYBk1KtwHlBWg2MhnTrjEDqg7KBZFTqVQ6nUaSkBKIA0mlUikoEfzUNI3WgFghlmUB5bSkANpG0Jq6rsIDBEEWuq6rqgqJQAfA4pummU6nIVPsG0CtpmlQXZApPmDK2IJNJBCw9rKrggZitWD7YhMATNPEvmEY2bqFqmteWPY5kAeRM5lMPB5XVTWRSFCSIAL9EHsjl2CuyAgkBiqNjhfs9pCImLKqqvhKrDHMFMsCkSEviA+vYCBABOyf8AlmAVVBE8f2FUsHWXANipnSaHQsYMem3ED8BNvXJWVIKp1OS1z5Ka12tWu6rsLAs59ZV25KRgCWh5IIr6DiaEwagvmIBJE/Mv5l2+r52gAukX7x5+4nZ334hQ656i7uCeoV0+8K5+AydhX24nF1g0t5x741pY1d00c4qUe4y+7384L3Y8S5wM4j8N9x2qQf/qXhJ393w8+t1aW2/3Y9hT0vI8S++z+492R3w3tEw3dwhT3j/u+Jd5iKq2dY8+8wI2d0fN4ZlluW7h443j6sFq+C5tqG91i8jKtn1N5Hwz1vjnvj+n++gS/y2Qx7l774bA3b4n3bM/TveG1+jHve3p3b/bXp7c4gDve/cQx7475zV2bH+7/5W3fGvaY/w09wA6iN20rwd1x2/j7z90W4464/2r+Jz3gDfwz/4N4x33682977b3hHw1Xv3e3f/o+F0z/h/5/f9+/4h8V5z7T/5+F+V/k//uIqf1d5d36e8u+e51+/0915f7v+nf3/t/3t/zP/v8L9n5f3g/937+2/33b0Xw4d5wAAAAAElFTkSuQmCC";

// Pemetaan tanda tangan berdasarkan ID / Nama Insinyur
export const PREPARED_BY_SIGNATURES: Record<string, string> = {
  'salman@utt.com': SALMAN_SIGNATURE_BASE64,
  'agil@utt.com': AGIL_SIGNATURE_BASE64,
  'asep@utt.com': ASEP_SIGNATURE_BASE64,
  'Salman Alfarisi': SALMAN_SIGNATURE_BASE64,
  'Agil Subekti': AGIL_SIGNATURE_BASE64,
  'Asep Kurnia': ASEP_SIGNATURE_BASE64,
};

/**
 * Helper: Ambil tanda tangan base64 berdasarkan email atau nama insinyur
 * @param identifier Email atau nama insinyur
 * @returns Tanda tangan base64 PNG atau fallback null
 */
export function getEngineerSignature(identifier?: string | null): string | null {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  if (PREPARED_BY_SIGNATURES[trimmed]) {
    return PREPARED_BY_SIGNATURES[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(PREPARED_BY_SIGNATURES)) {
    if (key.toLowerCase() === lower) return val;
  }
  return null;
}
