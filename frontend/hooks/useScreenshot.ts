import { useCallback } from 'react';
import html2canvas from 'html2canvas';

export function useScreenshot() {
  const takeScreenshot = useCallback(async (elementId: string, fileName: string = 'screenshot.png') => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id ${elementId} not found`);
      return;
    }

    try {
      // Temporarily hide elements that shouldn't be in the screenshot if needed
      // For example, buttons or navigation elements
      
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#020617', // Match the slate-950 background
        scale: 2, // Higher quality
        logging: false,
      });

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
