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
    doc,
    serverTimestamp,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

// File categories
const FILE_CATEGORIES = [
    'Laporan Harian',
    'Laporan Bulanan',
    'Checklist Alat',
    'Checklist APD',
    'PTW',
    'JSEA',
    'MOP',
    'SLA/SLG',
    'Custom',
    'Monthly'
];

// Maintenance Categories for Service Reports
const MAINTENANCE_TYPES = [
    'Water Leak',
    'Cooling Tower Water Treatment',
    'FCU',
    'Lift Units',
    'Dock Leveler',
    'Door',
    'Fuel Leak',
    'PJU',
    'Hydrant System',
    'Gate',
    'STP & Plumbing',
    'Exhaust Fan',
    'Capacitor Bank',
    'AHU',
    'UPS',
    'CRAC Data Hall & Supporting Room',
    'Chiller',
    'Cooling Tower',
    'ATS',
    'Cooling pump',
    'Exhaust Fan',
    'Transformer',
    'Generator & Fuel system',
    'MV and RMU panel',
    'LV Panel',
    'PDU Panel',
    'FSS',
    'Pre-Action System',
    'Lighting Point',
    'Grounding System',
    'Lightning Protection System',
    'VRV',
    'AC Splits',
    'Panel LDB & RDB (Distribution)',
    'Road Blocker',
    'X-Ray',
    'Pressurization & Degassing',
    'Pumps',
    'Water Softener',
    'Biosduct',
    'Physical Cooling Automation'
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030']; // ✅ NEW: Year categories

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
    quarter?: string; // ✅ NEW: Field for Q1-Q4
    year?: string; // ✅ NEW: Field for Year
    customCategory?: string;
    uploadedBy: string;
    uploadedByEmail: string;
    uploadedAt: any;
    description?: string;
    totalChunks: number;
    maintenanceType?: string; // ✅ NEW: Field for maintenance type
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
    const [selectedMaintenance, setSelectedMaintenance] = useState('Standard'); // ✅ NEW: State for maintenance type
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [selectedUploadQuarter, setSelectedUploadQuarter] = useState('Q1');
    const [selectedUploadYear, setSelectedUploadYear] = useState(new Date().getFullYear().toString()); // ✅ NEW: State for upload year

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterYear, setFilterYear] = useState('All'); // ✅ NEW: State for global year filter
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null); // ✅ NEW: State for selected quarter
    const [selectedMType, setSelectedMType] = useState<string | null>(null); // ✅ NEW: State for selected maintenance type
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]); // ✅ NEW: State for bulk selection
    const [isDeletingAllJSEA, setIsDeletingAllJSEA] = useState(false); // ✅ NEW: State for bulk JSEA deletion

    // Modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileData | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ NEW: State for upload success modal
    const [uploadedFileName, setUploadedFileName] = useState(''); // ✅ NEW: Track uploaded file name

    // Modal states

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
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Standard single file upload logic
        const file = files[0];
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
                maintenanceType: ['MOP', 'JSEA', 'PTW'].includes(finalCategory) ? selectedMaintenance : null, // ✅ NEW: Store maintenance type conditionally
                quarter: selectedUploadQuarter, // ✅ NEW: Store quarter
                year: selectedUploadYear, // ✅ NEW: Store year
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

            // Show success feedback modal
            setUploadedFileName(selectedFile?.name || 'File');
            setShowSuccessModal(true);

            // Reset form
            setSelectedFile(null);
            setSelectedCategory('Laporan Harian');
            setCustomCategory('');
            setDescription('');
            setUploading(false);

            toast.success('File uploaded successfully!');
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file');
            setUploading(false);
        }
    };

    // Handle delete (Delete metadata + all chunks)
    const handleDelete = async () => {
        if (!isAdmin) return;

        // Handle Bulk Delete (Selection)
        if (selectedFileIds.length > 0 && !fileToDelete) {
            await performBulkDelete(selectedFileIds, `Deleting ${selectedFileIds.length} files...`);
            return;
        }

        if (!fileToDelete) return;

        setIsBulkDeleting(true);
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
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Internal perform bulk delete (NEW: Refactored logic)
    const performBulkDelete = async (ids: string[], loadingMessage: string) => {
        if (ids.length === 0 || !isAdmin) return;

        setIsBulkDeleting(true);
        const toastId = toast.loading(loadingMessage);

        try {
            // Process in batches because showing feedback for each file
            for (const fileId of ids) {
                const batch = writeBatch(db);

                // 1. Get chunks
                const chunksSnapshot = await getDocs(collection(db, 'files', fileId, 'chunks'));

                // 2. Delete chunks
                chunksSnapshot.docs.forEach((chunkDoc) => {
                    batch.delete(chunkDoc.ref);
                });

                // 3. Delete metadata
                batch.delete(doc(db, 'files', fileId));

                await batch.commit();
            }

            toast.success(`Action completed successfully!`, { id: toastId });
            setSelectedFileIds([]);
            setFileToDelete(null);
            setDeleteModalOpen(false);
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast.error('Failed to complete some operations', { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // ✅ NEW: Handle Delete All JSEA Data
    const handleDeleteAllJSEA = async () => {
        if (!isAdmin) return;
        const jseaFiles = files.filter(f => f.category === 'JSEA');
        if (jseaFiles.length === 0) return;

        const ids = jseaFiles.map(f => f.id);
        await performBulkDelete(ids, `Deleting ${ids.length} JSEA files...`);
        setIsDeletingAllJSEA(false);
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
        const matchesYear =
            filterYear === 'All' || file.year === filterYear; // ✅ NEW: Match year
        const matchesMType = !selectedMType || file.maintenanceType === selectedMType;
        return matchesSearch && matchesCategory && matchesYear && matchesMType;
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

                        {/* Category & Quarter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Quarter
                                </label>
                                <select
                                    value={selectedUploadQuarter}
                                    onChange={(e) => setSelectedUploadQuarter(e.target.value)}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {QUARTERS.map((q) => (
                                        <option key={q} value={q}>
                                            {q}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Conditional Maintenance Selection for specific categories */}
                            {['MOP', 'JSEA', 'PTW'].includes(selectedCategory) && (
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Maintenance Type
                                    </label>
                                    <select
                                        value={selectedMaintenance}
                                        onChange={(e) => setSelectedMaintenance(e.target.value)}
                                        disabled={uploading}
                                        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {MAINTENANCE_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Year
                                </label>
                                <select
                                    value={selectedUploadYear}
                                    onChange={(e) => setSelectedUploadYear(e.target.value)}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {YEARS.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                        <div className="flex flex-col sm:flex-row gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Upload File
                                    </>
                                )}
                            </motion.button>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* Search & Filter */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-slate-700/50 mb-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                    {/* Search - Takes more space on tablet+ */}
                    <div className="md:col-span-6 lg:col-span-7">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm sm:text-base placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="md:col-span-3 lg:col-span-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer outline-none transition"
                            >
                                <option value="All">Semua Kategori</option>
                                {FILE_CATEGORIES.filter((cat) => cat !== 'Custom').map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Year Filter */}
                    <div className="md:col-span-3 lg:col-span-2">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer outline-none transition"
                            >
                                <option value="All">Semua Tahun</option>
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2 min-w-0">
                        {searchQuery ? (
                            <>
                                <Search className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <span className="truncate">Search Results ({filteredFiles.length})</span>
                            </>
                        ) : selectedMType ? (
                            <>
                                <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <span className="truncate">{selectedFolder} / {selectedQuarter} / {selectedMType} ({filteredFiles.filter(a => a.category === selectedFolder && a.quarter === selectedQuarter && a.maintenanceType === selectedMType).length})</span>
                            </>
                        ) : selectedQuarter ? (
                            <>
                                <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <span className="truncate">{selectedFolder} / {selectedQuarter}</span>
                            </>
                        ) : selectedFolder ? (
                            <>
                                <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <span className="truncate">{selectedFolder}</span>
                            </>
                        ) : (
                            <>
                                <FolderOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <span>Categories ({[...new Set(files.map(f => f.category))].length})</span>
                            </>
                        )}
                    </h2>

                    {(selectedFolder || selectedQuarter || selectedMType) && !searchQuery && (
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                            {isAdmin && selectedFolder === 'JSEA' && !selectedQuarter && (
                                <button
                                    onClick={() => {
                                        setIsDeletingAllJSEA(true);
                                        setDeleteModalOpen(true);
                                    }}
                                    className="text-xs px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg border border-red-500/20 transition flex items-center gap-1.5"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete All JSEA Data
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (selectedMType) setSelectedMType(null);
                                    else if (selectedQuarter) setSelectedQuarter(null);
                                    else setSelectedFolder(null);
                                }}
                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            >
                                <X className="w-4 h-4" />
                                Back to {selectedMType ? 'Maintenance Types' : selectedQuarter ? 'Quarters' : 'Folders'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation View */}
                {!searchQuery && !selectedFolder ? (
                    /* Level 1: Categories */
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[...new Set(filteredFiles.map(f => f.category))].sort().map((category) => {
                            const fileCount = filteredFiles.filter(f => f.category === category).length;
                            return (
                                <motion.div
                                    key={category}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(51, 65, 85, 0.4)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedFolder(category)}
                                    className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50 cursor-pointer transition-all group"
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className="bg-blue-600/20 p-4 rounded-2xl mb-3 group-hover:bg-blue-600/30 transition-colors">
                                            <FolderOpen className="w-10 h-10 text-blue-400" />
                                        </div>
                                        <h3 className="text-white font-medium truncate w-full px-2">
                                            {category}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {filteredFiles.length === 0 && (
                            <div className="col-span-full text-center py-12">
                                <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">No files found for this filter</p>
                            </div>
                        )}
                    </div>
                ) : !searchQuery && selectedFolder && !selectedQuarter ? (
                    /* Level 2: Quarters (Q1-Q4) */
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {QUARTERS.map((quarter) => {
                            const fileCount = filteredFiles.filter(f => f.category === selectedFolder && f.quarter === quarter).length;
                            return (
                                <motion.div
                                    key={quarter}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(51, 65, 85, 0.4)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedQuarter(quarter)}
                                    className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50 cursor-pointer transition-all group"
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className="bg-emerald-600/20 p-4 rounded-2xl mb-3 group-hover:bg-emerald-600/30 transition-colors">
                                            <FolderOpen className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <h3 className="text-white font-medium">
                                            {quarter}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : !searchQuery && selectedFolder && selectedQuarter && !selectedMType && ['MOP', 'JSEA', 'PTW'].includes(selectedFolder) ? (
                    /* Level 3: Maintenance Types (Only for MOP, JSEA, PTW) */
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {MAINTENANCE_TYPES.map((type) => {
                            const typeFiles = filteredFiles.filter(f => f.category === selectedFolder && f.quarter === selectedQuarter && f.maintenanceType === type);
                            const fileCount = typeFiles.length;
                            if (fileCount === 0) return null; // Only show folders with files

                            return (
                                <motion.div
                                    key={type}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(51, 65, 85, 0.4)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedMType(type)}
                                    className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50 cursor-pointer transition-all group"
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className="bg-blue-600/20 p-4 rounded-2xl mb-3 group-hover:bg-blue-600/30 transition-colors">
                                            <FolderOpen className="w-10 h-10 text-blue-400" />
                                        </div>
                                        <h3 className="text-white font-medium text-xs truncate w-full">
                                            {type}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    /* Level 3: Files List */
                    <div className="space-y-3">
                        {(searchQuery
                            ? filteredFiles
                            : filteredFiles.filter(f =>
                                f.category === selectedFolder &&
                                f.quarter === selectedQuarter &&
                                (['MOP', 'JSEA', 'PTW'].includes(selectedFolder || '') ? f.maintenanceType === selectedMType : true)
                            )
                        ).length === 0 ? (
                            <div className="text-center py-12">
                                <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">No matching files found</p>
                            </div>
                        ) : (
                            <>
                                {/* Bulk Actions Bar - Only for Admin */}
                                {isAdmin && (
                                    <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    (searchQuery ? filteredFiles : filteredFiles.filter(f => f.category === selectedFolder && f.quarter === selectedQuarter && (['MOP', 'JSEA', 'PTW'].includes(selectedFolder || '') ? f.maintenanceType === selectedMType : true))).length > 0 &&
                                                    (searchQuery ? filteredFiles : filteredFiles.filter(f => f.category === selectedFolder && f.quarter === selectedQuarter && (['MOP', 'JSEA', 'PTW'].includes(selectedFolder || '') ? f.maintenanceType === selectedMType : true))).every(f => selectedFileIds.includes(f.id))
                                                }
                                                onChange={(e) => {
                                                    const currentFiles = searchQuery ? filteredFiles : filteredFiles.filter(f => f.category === selectedFolder && f.quarter === selectedQuarter && (['MOP', 'JSEA', 'PTW'].includes(selectedFolder || '') ? f.maintenanceType === selectedMType : true));
                                                    if (e.target.checked) {
                                                        const allIds = currentFiles.map(f => f.id);
                                                        setSelectedFileIds(prev => [...new Set([...prev, ...allIds])]);
                                                    } else {
                                                        const currentIds = currentFiles.map(f => f.id);
                                                        setSelectedFileIds(prev => prev.filter(id => !currentIds.includes(id)));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                                            />
                                            <span className="text-sm font-medium text-slate-300">
                                                Select All Files
                                            </span>
                                        </div>

                                        {selectedFileIds.length > 0 && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={() => {
                                                    setFileToDelete(null); // Clear single delete state
                                                    setDeleteModalOpen(true);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg border border-red-500/20 transition text-sm font-medium"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Selected ({selectedFileIds.length})
                                            </motion.button>
                                        )}
                                    </div>
                                )}

                                {(searchQuery
                                    ? filteredFiles
                                    : filteredFiles.filter(f =>
                                        f.category === selectedFolder &&
                                        f.quarter === selectedQuarter &&
                                        (['MOP', 'JSEA', 'PTW'].includes(selectedFolder || '') ? f.maintenanceType === selectedMType : true)
                                    )
                                ).map((file) => (
                                    <motion.div
                                        key={file.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`bg-slate-700/30 rounded-xl p-3 sm:p-4 border transition flex items-start sm:items-center gap-3 sm:gap-4 ${selectedFileIds.includes(file.id) ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-600/50 hover:border-slate-500/50'
                                            }`}
                                    >
                                        {isAdmin && (
                                            <div className="mt-1 sm:mt-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFileIds.includes(file.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedFileIds(prev => [...prev, file.id]);
                                                        } else {
                                                            setSelectedFileIds(prev => prev.filter(id => id !== file.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 flex-1 min-w-0">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="text-2xl sm:text-3xl flex-shrink-0 mt-0.5 sm:mt-0">
                                                    {getFileIcon(file.fileType)}
                                                </div>
                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                    <h3 className="text-white font-medium text-sm sm:text-base truncate break-words">
                                                        {file.fileName}
                                                    </h3>
                                                    <div className="mt-2 space-y-2">
                                                        {/* Badges Row */}
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded border border-blue-500/20 text-[11px] sm:text-xs font-medium">
                                                                {file.category}
                                                            </span>
                                                            {file.quarter && (
                                                                <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 rounded border border-emerald-500/20 text-[11px] sm:text-xs font-medium">
                                                                    {file.quarter}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Info Row - Desktop: Show all | Mobile: Hide email */}
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-400">
                                                            <span className="font-medium text-slate-300">{formatFileSize(file.fileSize)}</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span>
                                                                {file.uploadedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                            </span>
                                                            {/* Email only visible on desktop */}
                                                            <span className="hidden sm:inline text-slate-600">•</span>
                                                            <span className="hidden sm:inline truncate max-w-[150px] italic opacity-70">
                                                                {file.uploadedByEmail}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {file.description && (
                                                        <p className="text-xs text-slate-500 mt-2.5 italic line-clamp-1 border-l-2 border-slate-700 pl-2.5 opacity-80">
                                                            "{file.description}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 self-end sm:self-auto ml-auto sm:ml-0">
                                                {/* Download */}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleDownload(file)}
                                                    className="p-2 sm:p-2.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition border border-blue-500/10"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </motion.button>

                                                {/* Delete - Admin Only (Individual) */}
                                                {isAdmin && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => {
                                                            setFileToDelete(file);
                                                            setSelectedFileIds([]); // Clear bulk selection if deleting single
                                                            setDeleteModalOpen(true);
                                                        }}
                                                        className="p-2 sm:p-2.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition border border-red-500/10"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (fileToDelete || selectedFileIds.length > 0 || isDeletingAllJSEA) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => {
                            if (!isBulkDeleting) setDeleteModalOpen(false);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-white">
                                    {isDeletingAllJSEA ? 'Hapus Semua Data JSEA' : selectedFileIds.length > 0 ? 'Delete Multiple Files' : 'Delete File'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                        setIsDeletingAllJSEA(false);
                                    }}
                                    disabled={isBulkDeleting}
                                    className="p-1 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <p className="text-slate-300 mb-6">
                                {isDeletingAllJSEA ? (
                                    <>Apakah Anda yakin ingin menghapus <span className="font-medium text-white">SELURUH data JSEA</span>? Tindakan ini tidak dapat dibatalkan.</>
                                ) : selectedFileIds.length > 0 ? (
                                    <>Are you sure you want to delete <span className="font-medium text-white">{selectedFileIds.length} selected files</span>?</>
                                ) : (
                                    <>Are you sure you want to delete <span className="font-medium text-white">{fileToDelete?.fileName}</span>?</>
                                )}
                                {!isDeletingAllJSEA && ' This action cannot be undone and will remove all file data.'}
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                        setIsDeletingAllJSEA(false);
                                    }}
                                    disabled={isBulkDeleting}
                                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={isDeletingAllJSEA ? handleDeleteAllJSEA : handleDelete}
                                    disabled={isBulkDeleting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isBulkDeleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                        onClick={() => setShowSuccessModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-slate-700 text-center shadow-2xl relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Decorative Background */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                                    >
                                        <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </motion.div>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2">Upload Berhasil!</h3>
                                <p className="text-slate-400 mb-6 px-4">
                                    File <span className="text-emerald-400 font-medium break-all">{uploadedFileName}</span> telah berhasil disimpan ke sistem.
                                </p>

                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
                                >
                                    Selesai
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FileManagement;
