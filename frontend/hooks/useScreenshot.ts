import { useCallback } from 'react';
import { safeHtml2Canvas } from '@/utils/ReportPdfExport';

export function useScreenshot() {
  const takeScreenshot = useCallback(async (elementId: string, fileName: string = 'screenshot.png') => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id ${elementId} not found`);
      return;
    }

    try {

      const bgVideo = document.getElementById('bg-video-container');
      if (bgVideo) bgVideo.style.display = 'none';

      const canvas = await safeHtml2Canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#020617',
        scale: 2,
        logging: false,
      });

      if (bgVideo) bgVideo.style.display = 'block';

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = fileName;
      link.click();

      return true;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return false;
    }
  }, []);

  return { takeScreenshot };
}

