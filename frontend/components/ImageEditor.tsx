import { useState, useRef } from 'react';
import ReactCrop, { centerCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion } from 'motion/react';
import { X, Check, RotateCw, ZoomIn, Scissors, RefreshCcw, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ImageEditorProps {
    image: string;
    onSave: (editedImage: string) => void;
    onCancel: () => void;
    description?: string;
    maintenanceName?: string;
    specificDetail?: string;
}

export function ImageEditor({ image, onSave, onCancel, description, maintenanceName, specificDetail }: ImageEditorProps) {
    const [crop, setCrop] = useState<Crop>();
    const [pixelCrop, setPixelCrop] = useState<PixelCrop>();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const imgRef = useRef<HTMLImageElement>(null);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        
        // Langsung set kotak crop 90% dari ukuran foto agar tidak jadi garis tipis
        const initialCrop = centerCrop(
            {
                unit: '%',
                width: 90,
                height: 90,
            },
            width,
            height
        );
        
        setCrop(initialCrop);

        // Langsung set pixel crop juga biar tombol "Apply" langsung work
        const pc: PixelCrop = {
            unit: 'px',
            x: (width * (initialCrop.x || 0)) / 100,
            y: (height * (initialCrop.y || 0)) / 100,
            width: (width * (initialCrop.width || 0)) / 100,
            height: (height * (initialCrop.height || 0)) / 100,
        };
        setPixelCrop(pc);
    };

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

        canvas.width = bBoxWidth;
        canvas.height = bBoxHeight;

        ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
        ctx.rotate(rotRad);
        ctx.translate(-image.width / 2, -image.height / 2);

        ctx.drawImage(image, 0, 0);

        const data = ctx.getImageData(
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height
        );

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.putImageData(data, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.6);
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
            if (!pixelCrop || !imgRef.current) {
                toast.error('Please select a crop area');
                return;
            }

            const img = imgRef.current;
            const scaleX = img.naturalWidth / img.width;
            const scaleY = img.naturalHeight / img.height;

            const scaledCrop = {
                x: pixelCrop.x * scaleX,
                y: pixelCrop.y * scaleY,
                width: pixelCrop.width * scaleX,
                height: pixelCrop.height * scaleY,
            };

            const croppedImage = await getCroppedImg(
                image,
                scaledCrop,
                rotation
            );
            onSave(croppedImage);
        } catch (e) {
            console.error(e);
            toast.error('Failed to crop image');
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = image;
        const ts = new Date().getTime();
        const cleanMain = (maintenanceName || 'report').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const cleanUnit = (specificDetail || 'unit').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const cleanDesc = (description || 'edited').substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${cleanMain}_${cleanUnit}_${cleanDesc}_${ts}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Foto diunduh');
    };

    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        if (imgRef.current) {
            const { width, height } = imgRef.current;
            const newCrop = centerCrop(
                { unit: '%', width: 90, height: 90 },
                width,
                height
            );
            setCrop(newCrop);
            setPixelCrop({
                unit: 'px',
                x: (width * (newCrop.x || 0)) / 100,
                y: (height * (newCrop.y || 0)) / 100,
                width: (width * (newCrop.width || 0)) / 100,
                height: (height * (newCrop.height || 0)) / 100,
            });
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

                <div className="relative flex-1 min-h-[400px] bg-slate-950 flex items-center justify-center p-8 overflow-hidden">
                    <style>{`
                        .ReactCrop {
                            max-height: 60vh;
                        }
                        .ReactCrop__crop-selection {
                            border: 2px solid #3b82f6 !important;
                            box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.7) !important;
                        }
                        .ReactCrop__drag-handle {
                            background-color: #3b82f6 !important;
                            width: 12px !important;
                            height: 12px !important;
                            border: 2px solid #ffffff !important;
                            border-radius: 2px !important;
                        }
                        /* Corner bars styling to match screenshot selection bars */
                        .ReactCrop__drag-handle.ord-nw,
                        .ReactCrop__drag-handle.ord-ne,
                        .ReactCrop__drag-handle.ord-sw,
                        .ReactCrop__drag-handle.ord-se {
                            width: 24px !important;
                            height: 24px !important;
                            background-color: transparent !important;
                            border: none !important;
                        }
                        .ReactCrop__drag-handle.ord-nw { border-top: 4px solid #3b82f6 !important; border-left: 4px solid #3b82f6 !important; }
                        .ReactCrop__drag-handle.ord-ne { border-top: 4px solid #3b82f6 !important; border-right: 4px solid #3b82f6 !important; }
                        .ReactCrop__drag-handle.ord-sw { border-bottom: 4px solid #3b82f6 !important; border-left: 4px solid #3b82f6 !important; }
                        .ReactCrop__drag-handle.ord-se { border-bottom: 4px solid #3b82f6 !important; border-right: 4px solid #3b82f6 !important; }

                        .ReactCrop__drag-handle::after {
                            display: none !important;
                        }
                    `}</style>

                    <div 
                        className="relative transition-transform duration-200 ease-out"
                        style={{ 
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        }}
                    >
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            onComplete={(c) => setPixelCrop(c)}
                            keepSelection={true}
                        >
                            <img
                                ref={imgRef}
                                src={image}
                                alt="Crop me"
                                onLoad={onImageLoad}
                                className="max-w-full max-h-[60vh] object-contain select-none shadow-2xl rounded-lg"
                                style={{ transformOrigin: 'center' }}
                            />
                        </ReactCrop>
                    </div>
                    
                    <div className="absolute top-4 right-4 z-10">
                         <button
                            onClick={handleReset}
                            className="p-2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-sm rounded-lg text-slate-300 transition-colors shadow-lg"
                            title="Reset"
                        >
                            <RefreshCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-slate-900 border-t border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
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

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <RotateCw className="w-4 h-4 text-emerald-500" />
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

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={handleDownload}
                            className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl font-medium transition flex items-center gap-2 border border-emerald-500/20"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        <div className="flex-1" />
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
