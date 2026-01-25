import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion } from 'motion/react';
import { X, Check, RotateCw, ZoomIn, Scissors } from 'lucide-react';
import { toast } from 'sonner';

interface ImageEditorProps {
    image: string;
    onSave: (editedImage: string) => void;
    onCancel: () => void;
}

export function ImageEditor({ image, onSave, onCancel }: ImageEditorProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: any,
        rotation = 0
    ): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return '';
        }

        const rotRad = (rotation * Math.PI) / 180;
        const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
            image.width,
            image.height,
            rotation
        );

        // set canvas size to match the bounding box
        canvas.width = bBoxWidth;
        canvas.height = bBoxHeight;

        // translate canvas context to a central point to allow rotating and flipping around the center
        ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
        ctx.rotate(rotRad);
        ctx.translate(-image.width / 2, -image.height / 2);

        // draw rotated image
        ctx.drawImage(image, 0, 0);

        // croppedAreaPixels values are bounding box relative
        const data = ctx.getImageData(
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height
        );

        // set canvas width to final desired crop size - this will clear existing context
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // paste generated rotate image with correct offsets for x,y crop values.
        ctx.putImageData(data, 0, 0);

        // As Base64 string
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    function rotateSize(width: number, height: number, rotation: number) {
        const rotRad = (rotation * Math.PI) / 180;

        return {
            width:
                Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
            height:
                Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
        };
    }

    const handleSave = async () => {
        try {
            const croppedImage = await getCroppedImg(
                image,
                croppedAreaPixels,
                rotation
            );
            onSave(croppedImage);
        } catch (e) {
            console.error(e);
            toast.error('Failed to crop image');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Scissors className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-none">Edit & Crop Photo</h3>
                            <p className="text-xs text-slate-500 mt-1">Adjust your photo for the report</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Cropper Container */}
                <div className="relative flex-1 min-h-[400px] bg-slate-950">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={4 / 3}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                    />
                </div>

                {/* Controls */}
                <div className="p-6 bg-slate-900 border-t border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                        {/* Zoom Control */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <ZoomIn className="w-4 h-4 text-slate-500" />
                                    Zoom
                                </label>
                                <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                                    {zoom.toFixed(1)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Rotation Control */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <RotateCw className="w-4 h-4 text-slate-500" />
                                    Rotation
                                </label>
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                    {rotation}°
                                </span>
                            </div>
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                aria-labelledby="Rotation"
                                onChange={(e) => setRotation(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Apply Changes
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
