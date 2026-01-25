import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Plus,
    Search,
    Filter,
    Camera,
    MapPin,
    PenTool,
    AlertCircle,
    CheckCircle2,
    Clock,
    Trash2,
    X,
    Loader2,
    FileText,
    Scissors,
} from 'lucide-react';
import { ImageEditor } from './ImageEditor';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface CorrectiveReport {
    id: string;
    issue: string;
    actionTaken: string;
    spareParts: string;
    status: 'Open' | 'InProgress' | 'Resolved';
    location: string;
    photoBase64: string;
    photoDescription: string;
    reportedBy: string;
    reportedByEmail: string;
    reportedAt: any;
}

export function CorrectiveMaintenance() {
    const { user, userRole } = useAuth();
    // Role 'standby_engineer' only can create
    const canCreate = userRole === 'standby_engineer';
    const isAdmin = userRole === 'admin';

    const [reports, setReports] = useState<CorrectiveReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        issue: '',
        actionTaken: '',
        spareParts: '',
        status: 'Open' as 'Open' | 'InProgress' | 'Resolved',
        location: '',
        photoBase64: '',
        photoDescription: '',
    });

    const [editingPhoto, setEditingPhoto] = useState(false);

    // Load Reports
    useEffect(() => {
        const q = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as CorrectiveReport[];
                setReports(data);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading CM reports:', error);
                toast.error('Failed to load reports');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Handle Image Compression
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Max photo size is 5MB');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize to max 800px
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = (height * MAX_WIDTH) / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = (width * MAX_HEIGHT) / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress quality 0.7
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setFormData({ ...formData, photoBase64: compressedBase64 });
            };
        };
    };

    const handleApplyEdit = (editedBase64: string) => {
        setFormData({ ...formData, photoBase64: editedBase64 });
        setEditingPhoto(false);
        toast.success('Photo updated');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.issue || !formData.actionTaken || !formData.location) {
            toast.error('Please fill in required fields (Issue, Action, Location)');
            return;
        }
        if (!formData.photoBase64) {
            toast.error('Please upload 1 evidence photo');
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'corrective_reports'), {
                ...formData,
                reportedBy: user.uid,
                reportedByEmail: user.email,
                reportedAt: serverTimestamp(),
            });

            toast.success('Corrective report created!');
            setShowForm(false);
            setFormData({
                issue: '',
                actionTaken: '',
                spareParts: '',
                status: 'Open',
                location: '',
                photoBase64: '',
                photoDescription: '',
            });
        } catch (error) {
            console.error('Error creating report:', error);
            toast.error('Failed to create report');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDoc(doc(db, 'corrective_reports', deleteId));
            toast.success('Report deleted');
        } catch (error) {
            toast.error('Failed to delete report');
        } finally {
            setDeleteId(null);
        }
    };

    // Status Badge Helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'InProgress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <PenTool className="w-6 h-6 text-orange-500" />
                        Corrective Maintenance
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Issue tracking and conflict resolution</p>
                </div>

                {canCreate && (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg flex items-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                        {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {showForm ? 'Cancel' : 'New Report'}
                    </motion.button>
                )}
            </div>

            {/* CREATE FORM */}
            <AnimatePresence>
                {showForm && canCreate && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleSubmit}
                        className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8 overflow-hidden"
                    >
                        {/* ... Same form content (omitted for brevity, assume content is preserved if logic is correct, wait replace_tool replaces exact match) ... */}
                        {/* Wait, I cannot use range replacement efficiently if I want to wrap the whole file or huge chunks. 
                             Let me use targeted replacement for the handleDelete and the end of file for the Modal. */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">New Corrective Report</h2>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <Scissors className="w-3 h-3 text-blue-400" />
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Crop/Edit Enabled</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Text Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Location / Unit</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
                                        <input
                                            required
                                            type="text"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="e.g. Server Room A, Unit Chiller 1"
                                            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Issue Description</label>
                                    <textarea
                                        required
                                        value={formData.issue}
                                        onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                                        placeholder="Describe the problem..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Action Taken</label>
                                    <textarea
                                        required
                                        value={formData.actionTaken}
                                        onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                                        placeholder="Describe the fix..."
                                    />
                                </div>
                            </div>

                            {/* Right Column: Status & Photo */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        >
                                            <option value="Open">Open</option>
                                            <option value="InProgress">In Progress</option>
                                            <option value="Resolved">Resolved</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Spare Parts (Opt)</label>
                                        <input
                                            type="text"
                                            value={formData.spareParts}
                                            onChange={(e) => setFormData({ ...formData, spareParts: e.target.value })}
                                            placeholder="e.g. Fan Belt, Fuse"
                                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Photo Upload (Single) */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Evidence Photo (Max 1)</label>
                                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-orange-500 transition cursor-pointer relative group">
                                        {formData.photoBase64 ? (
                                            <div className="relative">
                                                <img
                                                    src={formData.photoBase64}
                                                    alt="Evidence"
                                                    className="h-40 object-contain mx-auto rounded-lg"
                                                />
                                                <div className="absolute inset-0 bg-slate-950/20 opacity-100 transition rounded-lg flex items-center justify-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingPhoto(true)}
                                                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xl"
                                                        title="Edit / Crop Foto"
                                                    >
                                                        <Scissors className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, photoBase64: '' })}
                                                        className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-xl"
                                                        title="Hapus Foto"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Camera className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400">Click to upload photo</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Photo Description</label>
                                    <input
                                        type="text"
                                        value={formData.photoDescription}
                                        onChange={(e) => setFormData({ ...formData, photoDescription: e.target.value })}
                                        placeholder="What is in the photo?"
                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                Submit Report
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* REPORT LIST */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/20 rounded-2xl border border-slate-700/50">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white">No Corrective Reports</h3>
                    <p className="text-slate-400 mt-2">No maintenance issues reported yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {reports.map((report) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition"
                        >
                            <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6">
                                {/* Photo Section */}
                                {report.photoBase64 && (
                                    <div className="w-full md:w-64 flex-shrink-0">
                                        <img
                                            src={report.photoBase64}
                                            alt={report.photoDescription || 'Issue evidence'}
                                            className="w-full h-48 object-cover rounded-lg border border-slate-700"
                                        />
                                        {report.photoDescription && (
                                            <p className="text-xs text-slate-500 mt-2 text-center italic">{report.photoDescription}</p>
                                        )}
                                    </div>
                                )}

                                {/* Content Section */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                                        <div>
                                            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(report.status)} mb-2`}>
                                                {report.status}
                                            </div>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                {report.location}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Reported by <span className="text-slate-300">{report.reportedByEmail}</span> • {report.reportedAt?.toDate?.()?.toLocaleDateString()}
                                            </p>
                                        </div>

                                        {/* Admin Delete Action */}
                                        {(isAdmin || report.reportedBy === user?.uid) && (
                                            <button
                                                onClick={() => handleDeleteClick(report.id)}
                                                className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition"
                                                title="Delete Report"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm font-semibold text-orange-400 mb-1 flex items-center gap-2">
                                                <AlertCircle className="w-3 h-3" /> Issue
                                            </h4>
                                            <p className="text-slate-300 text-sm leading-relaxed">{report.issue}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-2">
                                                <CheckCircle2 className="w-3 h-3" /> Action Taken
                                            </h4>
                                            <p className="text-slate-300 text-sm leading-relaxed">{report.actionTaken}</p>
                                        </div>
                                    </div>

                                    {report.spareParts && (
                                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spare Parts Used:</span>
                                            <span className="ml-2 text-sm text-slate-300">{report.spareParts}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            <AnimatePresence>
                {deleteId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Delete Report?</h3>
                                <p className="text-slate-400 mb-6">
                                    Are you sure you want to delete this maintenance report? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteId(null)}
                                        className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Editor Modal */}
            <AnimatePresence>
                {editingPhoto && (
                    <ImageEditor
                        image={formData.photoBase64}
                        onSave={handleApplyEdit}
                        onCancel={() => setEditingPhoto(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
