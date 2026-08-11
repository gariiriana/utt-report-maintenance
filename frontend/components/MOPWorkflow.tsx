// ============================================================================
// FILE: frontend/components/MOPWorkflow.tsx
// Deskripsi: Modul Utama Pengelolaan MOP (Method of Procedure) Workflow.
//            Menampilkan Kanban Board dengan 4 kolom status (Draft, Review OCS,
//            Review TDE, Completed), CRUD MOP, upload file PDF dengan chunking
//            ke Firestore, inline remarks, dan progress tracking.
// ============================================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, FileUp, File, X, ChevronDown, ChevronUp,
  Send, CheckCircle2, Clock, Download, Loader2,
  MessageSquare, Upload, RotateCcw, Trash2,
  FileText, Shield, Check
} from 'lucide-react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, Timestamp, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type {
  MOPWorkflowDoc, MOPStatus, MOPRemark, MOPFileAttachment, MOPCreateFormData
} from '@/types/mopTypes';
import {
  EQUIPMENT_TYPES, MOP_STATUS_LABELS, MOP_STATUS_COLORS,
  generateQuarters, generateMOPNumber,
  MOP_CHUNK_SIZE, MOP_MAX_FILE_SIZE
} from '@/types/mopTypes';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { key: MOPStatus | 'all_review_ocs' | 'all_review_tde'; statuses: MOPStatus[]; label: string; icon: typeof Clock; color: string; bgGradient: string }[] = [
  {
    key: 'draft' as MOPStatus,
    statuses: ['draft'],
    label: 'Draft',
    icon: FileText,
    color: 'text-slate-600',
    bgGradient: 'from-slate-50 to-slate-100/50',
  },
  {
    key: 'all_review_ocs',
    statuses: ['review_ocs', 'revision_ocs', 'approved_ocs'],
    label: 'Tahap OCS',
    icon: Send,
    color: 'text-amber-600',
    bgGradient: 'from-amber-50 to-orange-50/50',
  },
  {
    key: 'all_review_tde',
    statuses: ['review_tde', 'revision_tde'],
    label: 'Tahap TDE',
    icon: Shield,
    color: 'text-blue-600',
    bgGradient: 'from-blue-50 to-sky-50/50',
  },
  {
    key: 'completed' as MOPStatus,
    statuses: ['completed'],
    label: 'Selesai',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgGradient: 'from-green-50 to-emerald-50/50',
  },
];

// ─── HELPER: Base64 chunking (same pattern as PTWManagement) ──────────────────

const chunkToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// ─── SUB-COMPONENT: Status Badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: MOPStatus }) {
  const colors = MOP_STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
      {MOP_STATUS_LABELS[status]}
    </span>
  );
}

// ─── SUB-COMPONENT: Time Ago Label ────────────────────────────────────────────

function TimeAgo({ timestamp }: { timestamp?: Timestamp }) {
  if (!timestamp) return null;
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  let label = '';
  if (diffDays > 0) label = `${diffDays} hari lalu`;
  else if (diffHours > 0) label = `${diffHours} jam lalu`;
  else label = 'Baru saja';

  return (
    <span className="text-[10px] text-slate-400 font-medium">{label}</span>
  );
}

// ─── SUB-COMPONENT: MOP Card ──────────────────────────────────────────────────

interface MOPCardProps {
  mop: MOPWorkflowDoc;
  onAction: (mopId: string, action: string, data?: any) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function MOPCard({ mop, onAction, isExpanded, onToggleExpand }: MOPCardProps) {
  const [remarkText, setRemarkText] = useState('');
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onAction(mop.id, 'upload_file', { file: files[0], phase: getUploadPhase(mop.status) });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAction(mop.id, 'upload_file', { file: e.target.files[0], phase: getUploadPhase(mop.status) });
    }
  };

  const getUploadPhase = (status: MOPStatus): string => {
    if (status === 'approved_ocs') return 'ocs_approved';
    if (status === 'revision_ocs') return 'revision';
    if (status === 'revision_tde') return 'revision';
    return 'draft';
  };

  const needsFileUpload = ['approved_ocs', 'revision_ocs', 'revision_tde'].includes(mop.status);

  const submitRemark = () => {
    if (!remarkText.trim()) return;
    const phase: 'ocs' | 'tde' = ['review_ocs', 'revision_ocs', 'approved_ocs'].includes(mop.status) ? 'ocs' : 'tde';
    onAction(mop.id, 'add_remark', { message: remarkText.trim(), phase });
    setRemarkText('');
    setShowRemarkInput(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${
        isDraggingFile ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200/80'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragEnter={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={needsFileUpload ? handleFileDrop : undefined}
    >
      {/* Card Header */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{mop.mopNumber}</span>
              <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{mop.equipmentType}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-800 truncate">{mop.title}</h4>
          </div>
          <StatusBadge status={mop.status} />
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-2.5">
          <span>{mop.quarter}</span>
          <span>•</span>
          <TimeAgo timestamp={mop.createdAt} />
          {mop.remarks.length > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />
                {mop.remarks.length}
              </span>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-1.5">
          {mop.status === 'draft' && (
            <>
              <button
                onClick={() => onAction(mop.id, 'submit_ocs')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <Send className="w-3 h-3" />
                Ajukan OCS
              </button>
              <button
                onClick={() => onAction(mop.id, 'delete')}
                className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                title="Hapus MOP"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {mop.status === 'review_ocs' && (
            <>
              <button
                onClick={() => onAction(mop.id, 'ocs_approve')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                OCS Approved
              </button>
              <button
                onClick={() => onAction(mop.id, 'ocs_revision')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Revisi
              </button>
            </>
          )}

          {mop.status === 'revision_ocs' && (
            <button
              onClick={() => onAction(mop.id, 'resubmit_ocs')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3" />
              Ajukan Ulang OCS
            </button>
          )}

          {mop.status === 'approved_ocs' && (
            <button
              onClick={() => onAction(mop.id, 'submit_tde')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3" />
              Ajukan TDE
            </button>
          )}

          {mop.status === 'review_tde' && (
            <>
              <button
                onClick={() => onAction(mop.id, 'tde_approve')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                TDE Approved
              </button>
              <button
                onClick={() => onAction(mop.id, 'tde_revision')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Revisi
              </button>
            </>
          )}

          {mop.status === 'revision_tde' && (
            <button
              onClick={() => onAction(mop.id, 'resubmit_tde')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3" />
              Ajukan Ulang TDE
            </button>
          )}

          {/* Remark button - shown for review/revision statuses */}
          {!['draft', 'completed'].includes(mop.status) && (
            <button
              onClick={() => setShowRemarkInput(!showRemarkInput)}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-100 text-slate-500 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              Remark
            </button>
          )}

          {/* Expand / collapse */}
          <button
            onClick={onToggleExpand}
            className="ml-auto p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* File Upload Drop Zone (only when status needs upload) */}
        {needsFileUpload && (
          <div
            className={`mt-2.5 border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer ${
              isDraggingFile
                ? 'border-blue-400 bg-blue-50'
                : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <p className="text-[11px] text-slate-500 font-medium">
              {mop.status === 'approved_ocs' ? 'Upload MOP yang sudah di-approved OCS' : 'Upload file revisi MOP'}
            </p>
            <p className="text-[10px] text-slate-400">Drag & drop atau klik di sini</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Inline Remark Input */}
        <AnimatePresence>
          {showRemarkInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2.5 overflow-hidden"
            >
              <div className="flex gap-2">
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Tulis catatan/remark..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                  rows={2}
                />
                <button
                  onClick={submitRemark}
                  disabled={!remarkText.trim()}
                  className="self-end px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 border-t border-slate-100 pt-3 space-y-3">
              {/* Description */}
              {mop.description && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deskripsi</p>
                  <p className="text-xs text-slate-600">{mop.description}</p>
                </div>
              )}

              {/* Files */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">File Terlampir</p>
                <div className="space-y-1">
                  {mop.draftFile && (
                    <FileRow label="Draft MOP" file={mop.draftFile} onDownload={() => onAction(mop.id, 'download', { fileType: 'draft' })} />
                  )}
                  {mop.ocsApprovedFile && (
                    <FileRow label="Approved OCS" file={mop.ocsApprovedFile} onDownload={() => onAction(mop.id, 'download', { fileType: 'ocs_approved' })} />
                  )}
                  {mop.tdeApprovedFile && (
                    <FileRow label="Approved TDE" file={mop.tdeApprovedFile} onDownload={() => onAction(mop.id, 'download', { fileType: 'tde_approved' })} />
                  )}
                  {!mop.draftFile && !mop.ocsApprovedFile && !mop.tdeApprovedFile && (
                    <p className="text-xs text-slate-400 italic">Belum ada file</p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Timeline</p>
                <div className="space-y-1.5">
                  <TimelineItem label="Dibuat" timestamp={mop.createdAt} active />
                  {mop.submittedToOcsAt && <TimelineItem label="Diajukan ke OCS" timestamp={mop.submittedToOcsAt} active />}
                  {mop.ocsResponseAt && <TimelineItem label="Respons OCS" timestamp={mop.ocsResponseAt} active />}
                  {mop.submittedToTdeAt && <TimelineItem label="Diajukan ke TDE" timestamp={mop.submittedToTdeAt} active />}
                  {mop.tdeResponseAt && <TimelineItem label="Respons TDE" timestamp={mop.tdeResponseAt} active />}
                  {mop.completedAt && <TimelineItem label="Selesai" timestamp={mop.completedAt} active />}
                </div>
              </div>

              {/* Remarks History */}
              {mop.remarks.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Remark History</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {mop.remarks.map((remark, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg px-2.5 py-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-slate-600">{remark.authorName}</span>
                          <span className="text-[9px] text-slate-400 uppercase">{remark.phase}</span>
                        </div>
                        <p className="text-xs text-slate-700">{remark.message}</p>
                        <TimeAgo timestamp={remark.timestamp} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── SUB-COMPONENT: File Row ──────────────────────────────────────────────────

function FileRow({ label, file, onDownload }: { label: string; file: MOPFileAttachment; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <File className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-700 truncate">{file.fileName}</p>
          <p className="text-[9px] text-slate-400">{label} • {(file.fileSize / 1024).toFixed(0)} KB</p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors cursor-pointer"
        title="Unduh"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── SUB-COMPONENT: Timeline Item ─────────────────────────────────────────────

function TimelineItem({ label, timestamp, active }: { label: string; timestamp: Timestamp; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-blue-500' : 'bg-slate-300'}`} />
      <span className="text-[11px] text-slate-600 font-medium">{label}</span>
      <span className="text-[10px] text-slate-400 ml-auto">
        {timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    </div>
  );
}

// ─── SUB-COMPONENT: Equipment Combobox (Typeahead / Searchable & Custom Input) ──

interface EquipmentComboboxProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
}

function EquipmentCombobox({
  value,
  onChange,
  required = false,
  placeholder = "Pilih atau ketik...",
  options = EQUIPMENT_TYPES,
}: EquipmentComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return options;
    return options.filter(opt => opt.toLowerCase().includes(query));
  }, [inputValue, options]);

  const exactMatch = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return options.some(opt => opt.toLowerCase() === query);
  }, [inputValue, options]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedVal: string) => {
    setInputValue(selectedVal);
    onChange(selectedVal);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) return;
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (inputValue.trim()) {
          handleSelect(inputValue.trim());
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="w-full pl-3 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                onChange('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Hapus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(prev => !prev);
              inputRef.current?.focus();
            }}
            className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            title="Pilih equipment"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-1 text-sm font-medium"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => {
                const isSelected = option.toLowerCase() === inputValue.trim().toLowerCase();
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{option}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                Tidak ada dalam daftar preset
              </div>
            )}

            {/* Opsi Custom Equipment jika teks belum terdaftar */}
            {inputValue.trim() && !exactMatch && (
              <div className="p-1 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => handleSelect(inputValue.trim())}
                  className="w-full px-3 py-2 text-left rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Gunakan: <strong>"{inputValue.trim()}"</strong></span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SUB-COMPONENT: Create MOP Modal ──────────────────────────────────────────

interface CreateMOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MOPCreateFormData, file: File | null) => void;
  isSubmitting: boolean;
  nextNumber: string;
}

function CreateMOPModal({ isOpen, onClose, onSubmit, isSubmitting, nextNumber }: CreateMOPModalProps) {
  const [formData, setFormData] = useState<MOPCreateFormData>({
    title: '',
    equipmentType: '',
    quarter: generateQuarters()[0],
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.equipmentType.trim()) {
      toast.error('Judul dan Tipe Equipment wajib diisi');
      return;
    }
    onSubmit(formData, selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MOP_MAX_FILE_SIZE) {
        toast.error('Ukuran file maksimal 15MB');
        return;
      }
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Hanya file PDF yang diperbolehkan');
        return;
      }
      setSelectedFile(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-sky-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg">Buat MOP Baru</h3>
              <p className="text-blue-100 text-xs font-medium">{nextNumber}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Judul MOP *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. PM ATS Quarter 3 - Neutra DC"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Tipe Equipment *</label>
              <EquipmentCombobox
                value={formData.equipmentType}
                onChange={(val) => setFormData(prev => ({ ...prev, equipmentType: val }))}
                placeholder="Pilih / ketik equipment..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Quarter</label>
              <select
                value={formData.quarter}
                onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white"
              >
                {generateQuarters().map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Deskripsi (Opsional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Keterangan tambahan..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Upload File MOP (PDF)</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                selectedFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
              onClick={() => document.getElementById('mop-create-file')?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-slate-700">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="p-0.5 hover:bg-red-100 rounded-full cursor-pointer"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ) : (
                <>
                  <FileUp className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-sm text-slate-500 font-medium">Klik untuk upload atau drag & drop</p>
                  <p className="text-xs text-slate-400">PDF, maksimal 15MB</p>
                </>
              )}
            </div>
            <input
              id="mop-create-file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl text-sm font-bold hover:from-blue-600 hover:to-sky-600 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Buat MOP
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function MOPWorkflow() {
  const { user } = useAuth();
  const [mopList, setMopList] = useState<MOPWorkflowDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // ─── Firestore Real-time Listener ─────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'mop_workflows'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: MOPWorkflowDoc[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        remarks: doc.data().remarks || [],
      })) as MOPWorkflowDoc[];
      setMopList(docs);
      setLoading(false);
    }, (error) => {
      console.warn('MOP Workflow listener note:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filteredMops = searchQuery.trim()
    ? mopList.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.mopNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.equipmentType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mopList;

  // ─── Next MOP Number ──────────────────────────────────────────────────────

  const nextMopNumber = generateMOPNumber(mopList.length + 1);

  // ─── Toggle card expand ───────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Upload file chunks to Firestore ──────────────────────────────────────

  const uploadFileChunks = async (
    mopId: string,
    file: File,
    subCollection: string
  ): Promise<MOPFileAttachment> => {
    const totalChunks = Math.ceil(file.size / MOP_CHUNK_SIZE);

    // Delete old chunks first
    const oldChunks = await getDocs(collection(db, 'mop_workflows', mopId, subCollection));
    if (!oldChunks.empty) {
      const delBatch = writeBatch(db);
      oldChunks.docs.forEach(d => delBatch.delete(d.ref));
      await delBatch.commit();
    }

    // Upload chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MOP_CHUNK_SIZE;
      const end = Math.min(start + MOP_CHUNK_SIZE, file.size);
      let chunkBase64 = await chunkToBase64(file.slice(start, end));
      if (i === 0) chunkBase64 = `data:${file.type};base64,${chunkBase64}`;
      await addDoc(collection(db, 'mop_workflows', mopId, subCollection), {
        index: i,
        data: chunkBase64,
      });
      setUploadProgress(((i + 1) / totalChunks) * 100);
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      uploadedAt: Timestamp.now(),
      fileType: subCollection.replace('_chunks', '') as MOPFileAttachment['fileType'],
    };
  };

  // ─── Download file from chunks ────────────────────────────────────────────

  const downloadFile = async (mopId: string, fileType: string) => {
    const subCollection = `${fileType}_chunks`;
    const toastId = toast.loading('Menyiapkan unduhan...');
    try {
      const chunksSnap = await getDocs(collection(db, 'mop_workflows', mopId, subCollection));
      if (chunksSnap.empty) {
        toast.error('File tidak ditemukan', { id: toastId });
        return;
      }

      const sortedDocs = chunksSnap.docs.sort((a, b) => (a.data().index || 0) - (b.data().index || 0));
      const byteArrays: Uint8Array[] = [];
      let mimeString = 'application/octet-stream';

      sortedDocs.forEach(d => {
        const chunkData = d.data().data as string;
        let base64Part = chunkData;
        if (chunkData.includes(';base64,')) {
          const parts = chunkData.split(';base64,');
          mimeString = parts[0].split(':')[1] || mimeString;
          base64Part = parts[1];
        }
        const byteStr = atob(base64Part);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        byteArrays.push(bytes);
      });

      const mop = mopList.find(m => m.id === mopId);
      const fileField = fileType === 'draft' ? mop?.draftFile
        : fileType === 'ocs_approved' ? mop?.ocsApprovedFile
        : mop?.tdeApprovedFile;
      const fileName = fileField?.fileName || `MOP-${fileType}.pdf`;

      const blob = new Blob(byteArrays as BlobPart[], { type: mimeString });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('File berhasil diunduh!', { id: toastId });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Gagal mengunduh file', { id: toastId });
    }
  };

  // ─── Create MOP ───────────────────────────────────────────────────────────

  const handleCreateMOP = async (formData: MOPCreateFormData, file: File | null) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const docData: any = {
        mopNumber: nextMopNumber,
        title: formData.title.trim(),
        equipmentType: formData.equipmentType,
        quarter: formData.quarter,
        description: formData.description.trim(),
        status: 'draft',
        remarks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        createdByName: user.displayName || user.email || '',
      };

      const docRef = await addDoc(collection(db, 'mop_workflows'), docData);

      // Upload file if provided
      if (file) {
        setIsUploading(true);
        const fileAttachment = await uploadFileChunks(docRef.id, file, 'draft_chunks');
        await updateDoc(doc(db, 'mop_workflows', docRef.id), {
          draftFile: {
            fileName: fileAttachment.fileName,
            fileSize: fileAttachment.fileSize,
            totalChunks: fileAttachment.totalChunks,
            uploadedAt: serverTimestamp(),
            fileType: 'draft',
          },
        });
        setIsUploading(false);
        setUploadProgress(0);
      }

      toast.success(`✅ MOP ${nextMopNumber} berhasil dibuat!`);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Create MOP error:', err);
      toast.error('Gagal membuat MOP');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // ─── MOP Actions Handler ──────────────────────────────────────────────────

  const handleMOPAction = async (mopId: string, action: string, data?: any) => {
    const mopRef = doc(db, 'mop_workflows', mopId);

    try {
      switch (action) {
        case 'submit_ocs':
          await updateDoc(mopRef, {
            status: 'review_ocs',
            submittedToOcsAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('📤 MOP diajukan ke OCS');
          break;

        case 'ocs_approve':
          await updateDoc(mopRef, {
            status: 'approved_ocs',
            ocsResponseAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('✅ OCS Approved! Upload file MOP yang sudah di-approved.');
          break;

        case 'ocs_revision':
          await updateDoc(mopRef, {
            status: 'revision_ocs',
            ocsResponseAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.info('📝 MOP perlu direvisi (OCS)');
          break;

        case 'resubmit_ocs':
          await updateDoc(mopRef, {
            status: 'review_ocs',
            submittedToOcsAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('📤 MOP diajukan ulang ke OCS');
          break;

        case 'submit_tde':
          await updateDoc(mopRef, {
            status: 'review_tde',
            submittedToTdeAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('📤 MOP diajukan ke TDE');
          break;

        case 'tde_approve':
          await updateDoc(mopRef, {
            status: 'completed',
            tdeResponseAt: serverTimestamp(),
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('🎉 MOP telah selesai disetujui TDE!');
          break;

        case 'tde_revision':
          await updateDoc(mopRef, {
            status: 'revision_tde',
            tdeResponseAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.info('📝 MOP perlu direvisi (TDE)');
          break;

        case 'resubmit_tde':
          await updateDoc(mopRef, {
            status: 'review_tde',
            submittedToTdeAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          toast.success('📤 MOP diajukan ulang ke TDE');
          break;

        case 'add_remark': {
          const mop = mopList.find(m => m.id === mopId);
          if (!mop) break;
          const newRemark: MOPRemark = {
            author: user?.email || '',
            authorName: user?.displayName || user?.email || '',
            message: data.message,
            timestamp: Timestamp.now(),
            phase: data.phase,
          };
          await updateDoc(mopRef, {
            remarks: [...mop.remarks, newRemark],
            updatedAt: serverTimestamp(),
          });
          toast.success('💬 Remark ditambahkan');
          break;
        }

        case 'upload_file': {
          const file = data.file as File;
          if (file.size > MOP_MAX_FILE_SIZE) {
            toast.error('Ukuran file maksimal 15MB');
            return;
          }
          if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Hanya file PDF yang diperbolehkan');
            return;
          }

          setIsUploading(true);
          const toastId = toast.loading('Mengunggah file...');
          try {
            const mop = mopList.find(m => m.id === mopId);
            if (!mop) break;

            let subCollection = 'draft_chunks';
            let fileField = 'draftFile';

            if (mop.status === 'approved_ocs') {
              subCollection = 'ocs_approved_chunks';
              fileField = 'ocsApprovedFile';
            } else if (mop.status === 'revision_ocs' || mop.status === 'revision_tde') {
              subCollection = 'draft_chunks';
              fileField = 'draftFile';
            }

            const fileAttachment = await uploadFileChunks(mopId, file, subCollection);
            await updateDoc(mopRef, {
              [fileField]: {
                fileName: fileAttachment.fileName,
                fileSize: fileAttachment.fileSize,
                totalChunks: fileAttachment.totalChunks,
                uploadedAt: serverTimestamp(),
                fileType: fileAttachment.fileType,
              },
              updatedAt: serverTimestamp(),
            });

            toast.success('📎 File berhasil diunggah!', { id: toastId });
          } catch (err) {
            console.error('Upload error:', err);
            toast.error('Gagal mengunggah file', { id: toastId });
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
          }
          break;
        }

        case 'download':
          await downloadFile(mopId, data.fileType);
          break;

        case 'delete': {
          // Delete all subcollection chunks first
          for (const sub of ['draft_chunks', 'ocs_approved_chunks', 'tde_approved_chunks']) {
            const chunks = await getDocs(collection(db, 'mop_workflows', mopId, sub));
            if (!chunks.empty) {
              const batch = writeBatch(db);
              chunks.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          }
          await deleteDoc(mopRef);
          toast.success('🗑️ MOP berhasil dihapus');
          break;
        }
      }
    } catch (err) {
      console.error('MOP action error:', err);
      toast.error('Terjadi kesalahan');
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = {
    total: filteredMops.length,
    draft: filteredMops.filter(m => m.status === 'draft').length,
    reviewOcs: filteredMops.filter(m => ['review_ocs', 'revision_ocs', 'approved_ocs'].includes(m.status)).length,
    reviewTde: filteredMops.filter(m => ['review_tde', 'revision_tde'].includes(m.status)).length,
    completed: filteredMops.filter(m => m.status === 'completed').length,
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">MOP Workflow</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola pengajuan Method of Procedure</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari MOP..."
              className="w-full sm:w-56 pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </div>
          {/* Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah MOP</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Draft', value: stats.draft, color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
          { label: 'Tahap OCS', value: stats.reviewOcs, color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
          { label: 'Tahap TDE', value: stats.reviewTde, color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
          { label: 'Selesai', value: stats.completed, color: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl px-3 py-2.5 flex items-center gap-2`}>
            <span className={`w-2 h-2 rounded-full ${stat.dot}`} />
            <span className="text-xs font-bold">{stat.value}</span>
            <span className="text-xs font-medium opacity-70">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Upload Progress Bar */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-700">Mengunggah file...</span>
                <span className="text-xs font-bold text-blue-600">{uploadProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-1.5">
                <motion.div
                  className="bg-blue-500 h-1.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Memuat data MOP...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((column, colIdx) => {
              const columnMops = filteredMops.filter(m => column.statuses.includes(m.status));
              const ColumnIcon = column.icon;

              return (
                <motion.div
                  key={column.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: colIdx * 0.1 }}
                  className={`bg-gradient-to-b ${column.bgGradient} rounded-2xl border border-slate-200/60 overflow-hidden`}
                >
                  {/* Column Header */}
                  <div className="px-4 py-3 border-b border-slate-200/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ColumnIcon className={`w-4 h-4 ${column.color}`} />
                        <span className="text-sm font-bold text-slate-700">{column.label}</span>
                      </div>
                      <span className={`min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        columnMops.length > 0 ? 'bg-white shadow-sm text-slate-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {columnMops.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards */}
                  <div className="p-2.5 space-y-2.5 min-h-[120px] max-h-[calc(100vh-380px)] overflow-y-auto">
                    <AnimatePresence>
                      {columnMops.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-8 text-center"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mb-2">
                            <ColumnIcon className="w-5 h-5 text-slate-300" />
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Belum ada MOP</p>
                        </motion.div>
                      ) : (
                        columnMops.map(mop => (
                          <MOPCard
                            key={mop.id}
                            mop={mop}
                            onAction={handleMOPAction}
                            isExpanded={expandedCards.has(mop.id)}
                            onToggleExpand={() => toggleExpand(mop.id)}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Empty State */}
          {mopList.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada MOP</h3>
              <p className="text-sm text-slate-500 mb-4">Mulai dengan membuat MOP pertama Anda</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-sky-600 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat MOP Pertama
              </button>
            </motion.div>
          )}
        </>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateMOPModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateMOP}
            isSubmitting={isSubmitting}
            nextNumber={nextMopNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
