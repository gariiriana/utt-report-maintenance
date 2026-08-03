import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

/**
 * Load image URL into base64 string for jsPDF rendering
 */
export async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Load default company logos for Service Report PDF header
 */
export async function loadCompanyLogos() {
  let logoLeft: string | null = null;
  let logoRight: string | null = null;

  try {
    logoLeft = await loadImageBase64(logoDwimitra);
  } catch (e) {
    console.warn('Failed to load left logo:', e);
  }

  try {
    logoRight = await loadImageBase64(logoNeutraDC);
  } catch (e) {
    console.warn('Failed to load right logo:', e);
  }

  return { logoLeft, logoRight };
}
