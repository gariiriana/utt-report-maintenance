/**
 * Image Compression Utility
 * Compresses images to reduce file size for PDF/Excel exports
 */

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0.0 to 1.0
}

/**
 * Compress an image file using HTML5 Canvas
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<string> - Base64 encoded compressed image
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 1200,  // Max width in pixels
        maxHeight = 1200, // Max height in pixels
        quality = 0.8,    // JPEG quality (0.0 - 1.0)
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const aspectRatio = width / height;

                    if (width > height) {
                        width = maxWidth;
                        height = width / aspectRatio;
                    } else {
                        height = maxHeight;
                        width = height * aspectRatio;
                    }
                }

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Use better image quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Draw image
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with compression
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Compress base64 image string
 * @param base64String - Base64 encoded image
 * @param options - Compression options
 * @returns Promise<string> - Compressed base64 string
 */
export async function compressBase64Image(
    base64String: string,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.8,
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;

                if (width > height) {
                    width = maxWidth;
                    height = width / aspectRatio;
                } else {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
            }

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = base64String;
    });
}

/**
 * Get file size in KB from base64 string
 * @param base64String - Base64 encoded string
 * @returns number - Size in KB
 */
export function getBase64SizeKB(base64String: string): number {
    const base64Length = base64String.length - (base64String.indexOf(',') + 1);
    const sizeInBytes = (base64Length * 3) / 4;
    return Math.round(sizeInBytes / 1024);
}
