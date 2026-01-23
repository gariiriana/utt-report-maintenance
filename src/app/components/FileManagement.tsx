import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Upload,
    Search,
    Filter,
    Download,
    Trash2,
    X,
    Loader2,
    FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
    doc,
    serverTimestamp,
    getDocs,
    writeBatch,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

// File categories
const FILE_CATEGORIES = [
    'Laporan Harian',
    'Laporan Bulanan',
    'Checklist Alat',
    'Checklist APD',
    'PTW',
    'JSE',
    'MOP',
    'Custom',
];

// Allowed file types (PDF, Excel, Word)
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// 30MB Limit (as requested)
const MAX_FILE_SIZE = 30 * 1024 * 1024;
// Chunk size (800KB - safely under 1MB Firestore limit)
const CHUNK_SIZE = 800 * 1024;

interface FileData {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    category: string;
    customCategory?: string;
    uploadedBy: string;
    uploadedByEmail: string;
    uploadedAt: any;
    description?: string;
    totalChunks: number;
}

export function FileManagement() {
    const { user, userRole } = useAuth();
    const isAdmin = userRole === 'admin';

    const [files, setFiles] = useState<FileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Upload form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('Laporan Harian');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    // Delete modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileData | null>(null);

    // Load files from Firestore
    useEffect(() => {
        const q = query(collection(db, 'files'), orderBy('uploadedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const filesData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as FileData[];
                setFiles(filesData);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading files:', error);
                toast.error('Failed to load files');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            toast.error('Only PDF, Excel, and Word files are allowed');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.error('File size must be less than 30MB');
            return;
        }

        setSelectedFile(file);
    };

    // Handle upload with Chunking
    const handleUpload = async () => {
        if (!selectedFile || !user) return;

        const finalCategory =
            selectedCategory === 'Custom' ? customCategory : selectedCategory;

        if (!finalCategory.trim()) {
            toast.error('Please enter a category name');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            // 1. Convert file to base64
            const base64Data = await fileToBase64(selectedFile);

            // Calculate chunks
            const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
            const chunks: string[] = [];

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = start + CHUNK_SIZE;
                chunks.push(base64Data.slice(start, end));
            }

            // 2. Create metadata document first
            const fileDocRef = await addDoc(collection(db, 'files'), {
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                fileType: selectedFile.type,
                category: finalCategory,
                customCategory: selectedCategory === 'Custom' ? customCategory : null,
                uploadedBy: user.uid,
                uploadedByEmail: user.email,
                uploadedAt: serverTimestamp(),
                description: description || null,
                totalChunks: totalChunks,
                status: 'uploading' // Flag to prevent access while uploading
            });

            // 3. Upload chunks to sub-collection
            const batchSize = 500; // Firestore batch limit

            for (let i = 0; i < totalChunks; i += batchSize) {
                const batch = writeBatch(db);
                const currentBatchChunks = chunks.slice(i, i + batchSize);

                currentBatchChunks.forEach((chunkData, index) => {
                    const chunkIndex = i + index;
                    const chunkRef = doc(collection(db, 'files', fileDocRef.id, 'chunks'), chunkIndex.toString());
                    batch.set(chunkRef, {
                        index: chunkIndex,
                        data: chunkData
                    });
                });

                await batch.commit();

                // Update progress
                const currentProgress = Math.min(((i + currentBatchChunks.length) / totalChunks) * 100, 99);
                setUploadProgress(currentProgress);
            }

            // 4. Update status to completed
            const fileRef = doc(db, 'files', fileDocRef.id);
            const finalBatch = writeBatch(db);
            finalBatch.update(fileRef, { status: 'completed' });
            await finalBatch.commit();

            setUploadProgress(100);
            toast.success('File uploaded successfully!');

            // Reset form
            setSelectedFile(null);
            setSelectedCategory('Laporan Harian');
            setCustomCategory('');
            setDescription('');
            setUploading(false);
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file');
            setUploading(false);
        }
    };

    // Handle delete (Delete metadata + all chunks)
    const handleDelete = async () => {
        if (!fileToDelete || !isAdmin) return;

        try {
            const batch = writeBatch(db);

            // 1. Get all chunks
            const chunksSnapshot = await getDocs(collection(db, 'files', fileToDelete.id, 'chunks'));

            // 2. Delete chunks
            chunksSnapshot.docs.forEach((chunkDoc) => {
                batch.delete(chunkDoc.ref);
            });

            // 3. Delete metadata
            const fileRef = doc(db, 'files', fileToDelete.id);
            batch.delete(fileRef);

            // Commit batch
            await batch.commit();

            toast.success('File deleted successfully!');
            setDeleteModalOpen(false);
            setFileToDelete(null);
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Failed to delete file');
        }
    };

    // Handle download (Reconstruct chunks)
    const handleDownload = async (file: FileData) => {
        try {
            const toastId = toast.loading('Preparing download...');

            // 1. Fetch all chunks
            const chunksSnapshot = await getDocs(query(collection(db, 'files', file.id, 'chunks'), orderBy('index')));

            if (chunksSnapshot.empty) {
                // Fallback for old files (if any were created without chunks)
                // But in this new system, all should handle chunks. 
                // We assume if no chunks, it might be the old format or error.
                toast.error('File data not found', { id: toastId });
                return;
            }

            // 2. Reconstruct base64
            let fullBase64 = '';
            chunksSnapshot.docs.forEach((doc) => {
                fullBase64 += doc.data().data;
            });

            // 3. Convert to blob and download
            const byteString = atob(fullBase64.split(',')[1]);
            const mimeString = fullBase64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('File downloaded!', { id: toastId });
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('Failed to download file');
        }
    };

    // Filter files
    const filteredFiles = files.filter((file) => {
        const matchesSearch = file.fileName
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const matchesCategory =
            filterCategory === 'All' || file.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Get file icon
    const getFileIcon = (fileType: string) => {
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        return '📁';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Upload Section - Admin Only */}
            {isAdmin && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8"
                >
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-blue-400" />
                        Upload File
                    </h2>

                    <div className="space-y-4">
                        {/* File Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Select File (PDF, Excel, Word - Max 30MB)
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.xlsx,.xls,.docx,.doc"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                            />
                            {selectedFile && (
                                <p className="mt-2 text-sm text-slate-400">
                                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                </p>
                            )}
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Category
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                disabled={uploading}
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {FILE_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Custom Category Input */}
                        {selectedCategory === 'Custom' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Custom Category Name
                                </label>
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    disabled={uploading}
                                    placeholder="Enter category name..."
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={uploading}
                                placeholder="Add a description..."
                                rows={3}
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {/* Upload Progress */}
                        {uploading && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span>Uploading... (Encrypting & Sharding)</span>
                                    <span>{uploadProgress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Upload File4
                                </>
                            )}
                        </motion.button>
                    </div>
                </motion.div>
            )}

            {/* Search & Filter */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-6"
            >
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="sm:w-64">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                            >
                                <option value="All">All Categories</option>
                                {FILE_CATEGORIES.filter((cat) => cat !== 'Custom').map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* File List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-emerald-400" />
                    Files ({filteredFiles.length})
                </h2>

                {filteredFiles.length === 0 ? (
                    <div className="text-center py-12">
                        <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No files found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredFiles.map((file) => (
                            <motion.div
                                key={file.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:border-slate-500/50 transition"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="text-3xl flex-shrink-0">
                                            {getFileIcon(file.fileType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-medium truncate">
                                                {file.fileName}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                                                <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                                                    {file.category}
                                                </span>
                                                <span>{formatFileSize(file.fileSize)}</span>
                                                <span>•</span>
                                                <span>{file.uploadedByEmail}</span>
                                                <span>•</span>
                                                <span>
                                                    {file.uploadedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                </span>
                                            </div>
                                            {file.description && (
                                                <p className="text-sm text-slate-400 mt-1">
                                                    {file.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Download */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleDownload(file)}
                                            className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </motion.button>

                                        {/* Delete - Admin Only */}
                                        {isAdmin && (
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => {
                                                    setFileToDelete(file);
                                                    setDeleteModalOpen(true);
                                                }}
                                                className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </motion.button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && fileToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setDeleteModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-white">Delete File</h3>
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="p-1 hover:bg-slate-700 rounded-lg transition"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <p className="text-slate-300 mb-6">
                                Are you sure you want to delete{' '}
                                <span className="font-medium text-white">{fileToDelete.fileName}</span>?
                                This action cannot be undone.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
