import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
    X, Check, Type, RotateCcw, Palette, AlignLeft,
    Minus, Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface TextOverlay {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    bgColor: string | null;
    hasBg: boolean;
}

interface HSEPhotoEditorProps {
    imageUrl: string;
    onSave: (editedDataUrl: string) => void;
    onCancel: () => void;
}

const PRESET_LABELS = [
    { label: 'Before', color: '#ffffff', bgColor: '#16a34a' },
    { label: 'After', color: '#ffffff', bgColor: '#2563eb' },
    { label: 'In Progress', color: '#ffffff', bgColor: '#d97706' },
    { label: 'Selesai', color: '#ffffff', bgColor: '#7c3aed' },
    { label: '✓', color: '#ffffff', bgColor: '#16a34a' },
    { label: '✗', color: '#ffffff', bgColor: '#dc2626' },
];

const TEXT_COLORS = [
    { value: '#ffffff', label: 'Putih' },
    { value: '#ff0000', label: 'Merah' },
    { value: '#00ff00', label: 'Hijau' },
    { value: '#ffff00', label: 'Kuning' },
    { value: '#000000', label: 'Hitam' },
    { value: '#ff6600', label: 'Oranye' },
];

const BG_COLORS = [
    { value: null, label: 'Transparan' },
    { value: '#16a34a', label: 'Hijau' },
    { value: '#2563eb', label: 'Biru' },
    { value: '#dc2626', label: 'Merah' },
    { value: '#d97706', label: 'Kuning' },
    { value: '#7c3aed', label: 'Ungu' },
    { value: '#000000', label: 'Hitam' },
];

export function HSEPhotoEditor({ imageUrl, onSave, onCancel }: HSEPhotoEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [overlays, setOverlays] = useState<TextOverlay[]>([]);
    const [currentText, setCurrentText] = useState('Before');
    const [fontSize, setFontSize] = useState(32);
    const [textColor, setTextColor] = useState('#ffffff');
    const [bgColor, setBgColor] = useState<string | null>('#16a34a');
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imgRef.current = img;
            const maxW = 800;
            const ratio = Math.min(1, maxW / img.width);
            setCanvasSize({ w: Math.round(img.width * ratio), h: Math.round(img.height * ratio) });
            setIsReady(true);
        };
        img.onerror = () => toast.error('Gagal memuat gambar');
        img.src = imageUrl;
    }, [imageUrl]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const ov of overlays) {
            const paddingX = ov.fontSize * 0.4;
            const paddingY = ov.fontSize * 0.2;

            ctx.font = `bold ${ov.fontSize}px Arial, sans-serif`;
            const metrics = ctx.measureText(ov.text);
            const textW = metrics.width;
            const textH = ov.fontSize;

            if (ov.hasBg && ov.bgColor) {
                ctx.fillStyle = ov.bgColor;
                const radius = 6;
                const rx = ov.x - paddingX;
                const ry = ov.y - textH - paddingY;
                const rw = textW + paddingX * 2;
                const rh = textH + paddingY * 2;
                ctx.beginPath();
                ctx.moveTo(rx + radius, ry);
                ctx.lineTo(rx + rw - radius, ry);
                ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
                ctx.lineTo(rx + rw, ry + rh - radius);
                ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
                ctx.lineTo(rx + radius, ry + rh);
                ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
                ctx.lineTo(rx, ry + radius);
                ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = ov.color;
            ctx.fillText(ov.text, ov.x, ov.y);
        }
    }, [overlays]);

    useEffect(() => {
        if (isReady) redraw();
    }, [isReady, redraw, canvasSize]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!currentText.trim()) {
            toast.error('Isi dulu teks yang mau ditambahkan');
            return;
        }
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const newOverlay: TextOverlay = {
            id: Date.now().toString(),
            text: currentText,
            x,
            y,
            fontSize,
            color: textColor,
            bgColor,
            hasBg: bgColor !== null,
        };
        setOverlays(prev => [...prev, newOverlay]);
    };

    useEffect(() => {
        redraw();
    }, [overlays, redraw]);

    const handleUndo = () => {
        setOverlays(prev => prev.slice(0, -1));
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        onSave(dataUrl);
    };

    const applyPreset = (preset: typeof PRESET_LABELS[0]) => {
        setCurrentText(preset.label);
        setTextColor(preset.color);
        setBgColor(preset.bgColor);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl"
            >
                {}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/15 rounded-lg">
                            <Type className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white leading-none">Edit Foto HSE</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Klik pada foto untuk menempatkan teks</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
                    {}
                    <div className="flex-1 bg-slate-950 overflow-auto flex items-start justify-center p-4 min-h-[300px]">
                        {isReady ? (
                            <canvas
                                ref={canvasRef}
                                width={canvasSize.w}
                                height={canvasSize.h}
                                onClick={handleCanvasClick}
                                className="cursor-crosshair rounded-lg shadow-2xl max-w-full"
                                style={{ maxHeight: '60vh', objectFit: 'contain' }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-64 text-slate-500">
                                <div className="w-8 h-8 border-2 border-green-500/50 border-t-green-400 rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {}
                    <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60 flex flex-col overflow-y-auto">
                        <div className="p-4 space-y-5">

                            {}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Palette className="w-3.5 h-3.5" /> Preset Label
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {PRESET_LABELS.map((p) => (
                                        <button
                                            key={p.label}
                                            onClick={() => applyPreset(p)}
                                            className="px-2 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80 active:scale-95"
                                            style={{ backgroundColor: p.bgColor, color: p.color }}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <AlignLeft className="w-3.5 h-3.5" /> Teks
                                </p>
                                <input
                                    type="text"
                                    value={currentText}
                                    onChange={(e) => setCurrentText(e.target.value)}
                                    placeholder="Ketik teks..."
                                    className="w-full px-3 py-2 bg-slate-800/70 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"
                                />
                            </div>

                            {}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ukuran</p>
                                    <span className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{fontSize}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFontSize(s => Math.max(12, s - 4))}
                                        className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-slate-300"
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        type="range"
                                        min={12}
                                        max={96}
                                        step={4}
                                        value={fontSize}
                                        onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                    <button
                                        onClick={() => setFontSize(s => Math.min(96, s + 4))}
                                        className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-slate-300"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Warna Teks</p>
                                <div className="flex gap-2 flex-wrap">
                                    {TEXT_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            title={c.label}
                                            onClick={() => setTextColor(c.value)}
                                            className={`w-7 h-7 rounded-full border-2 transition hover:scale-110 ${textColor === c.value ? 'border-white scale-110' : 'border-slate-600'}`}
                                            style={{ backgroundColor: c.value }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Background Label</p>
                                <div className="flex gap-2 flex-wrap">
                                    {BG_COLORS.map((c) => (
                                        <button
                                            key={c.label}
                                            title={c.label}
                                            onClick={() => setBgColor(c.value)}
                                            className={`w-7 h-7 rounded-full border-2 transition hover:scale-110 ${bgColor === c.value ? 'border-white scale-110' : 'border-slate-600'}`}
                                            style={{
                                                backgroundColor: c.value ?? 'transparent',
                                                backgroundImage: c.value === null ? 'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)' : undefined,
                                                backgroundSize: c.value === null ? '6px 6px' : undefined,
                                                backgroundPosition: c.value === null ? '0 0, 3px 3px' : undefined,
                                            }}
                                        />
                                    ))}
                                </div>
                                {bgColor === null && (
                                    <p className="text-xs text-slate-500 mt-1">Tidak ada background</p>
                                )}
                            </div>

                            {}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview Teks</p>
                                <div className="flex items-center justify-center p-3 bg-slate-800/50 rounded-lg min-h-[50px]">
                                    <span
                                        className="font-bold px-2 py-1 rounded-md text-sm"
                                        style={{
                                            color: textColor,
                                            backgroundColor: bgColor ?? 'transparent',
                                            fontSize: Math.min(24, fontSize) + 'px',
                                        }}
                                    >
                                        {currentText || 'Preview...'}
                                    </span>
                                </div>
                            </div>

                            {}
                            {overlays.length > 0 && (
                                <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-xs text-slate-400">{overlays.length} teks ditambahkan</span>
                                    <button
                                        onClick={handleUndo}
                                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Undo
                                    </button>
                                </div>
                            )}
                        </div>

                        {}
                        <div className="p-4 border-t border-slate-800 mt-auto flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition text-sm"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 text-sm"
                            >
                                <Check className="w-4 h-4" />
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
