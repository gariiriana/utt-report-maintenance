/**
 * Universal PDF Download Utility
 * 
 * Provides robust cross-browser PDF downloading using file-saver and standard
 * anchor downloads. Eliminates iframe conflicts and transient activation drops.
 */
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

/**
 * Force-download a PDF blob to the user's device.
 */
export function downloadPDFBlob(blob: Blob, fileName: string): void {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);

  let downloadInitiated = false;

  // 1. Primary: file-saver saveAs
  try {
    saveAs(pdfBlob, safeName);
    downloadInitiated = true;
  } catch (err) {
    console.warn('[pdfDownload] saveAs failed, trying DOM link fallback:', err);
  }

  // 2. Direct DOM anchor fallback
  if (!downloadInitiated) {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = safeName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 1500);
      downloadInitiated = true;
    } catch (err) {
      console.warn('[pdfDownload] DOM link fallback failed:', err);
    }
  }

  // 3. Guaranteed manual fallback button in toast
  toast.success(`PDF siap diunduh!`, {
    id: `pdf-dl-${safeName.replace(/[^a-zA-Z0-9]/g, '_')}`,
    duration: 12000,
    description: `Klik tombol di bawah jika file tidak otomatis terunduh (${safeName}).`,
    action: {
      label: '📥 Unduh File',
      onClick: () => {
        try {
          saveAs(pdfBlob, safeName);
        } catch {
          const a = document.createElement('a');
          a.href = url;
          a.download = safeName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
          }, 1000);
        }
      }
    }
  });

  // Revoke object URL after 60s
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

/**
 * Download a jsPDF document. Extracts the blob and delegates to downloadPDFBlob.
 */
export function downloadJsPDFDoc(doc: any, fileName: string): void {
  try {
    const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    let blob: Blob;
    if (doc?.blob instanceof Blob) {
      blob = doc.blob;
    } else if (typeof doc?.output === 'function') {
      blob = doc.output('blob');
    } else {
      throw new Error('Invalid jsPDF document object');
    }
    downloadPDFBlob(blob, safeName);
  } catch (err) {
    console.error('[pdfDownload] Failed to get blob from jsPDF doc:', err);
    try {
      doc.save(fileName);
    } catch (saveErr) {
      console.error('[pdfDownload] doc.save also failed:', saveErr);
      toast.error('Gagal mengunduh PDF. Silakan coba lagi.');
    }
  }
}

