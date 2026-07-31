import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FileText,
  Camera,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Download,
  X,
  User,
  AlertTriangle,
  Scissors
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { PIRReportData, INITIAL_PIR_REPORT_DATA, PIRCorrectiveAction, PIRPhoto } from '@/types/pirReportTypes';
import { generatePIRReportPDF } from '@/utils/PIRReportPdfExport';
import { ImageEditor } from './ImageEditor';

interface PIRReportFormModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  editId?: string;
}

export function PIRReportFormModal({ onSuccess, onCancel, editId }: PIRReportFormModalProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<PIRReportData>(INITIAL_PIR_REPORT_DATA);

  // Temporary Attendee Input State
  const [newTde, setNewTde] = useState('');
  const [newDme, setNewDme] = useState('');

  // Load draft or existing report if editing
  useEffect(() => {
    if (editId) {
      const fetchReport = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'corrective_reports', editId));
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setFormData({
              ...INITIAL_PIR_REPORT_DATA,
              ...data,
              attendeesTDE: data.attendeesTDE || INITIAL_PIR_REPORT_DATA.attendeesTDE,
              attendeesDME: data.attendeesDME || INITIAL_PIR_REPORT_DATA.attendeesDME,
              correctiveActions: data.correctiveActions || INITIAL_PIR_REPORT_DATA.correctiveActions,
              photos: data.photos || []
            });
          }
        } catch (err) {
          console.error('Failed to fetch PIR report:', err);
          toast.error('Gagal memuat data laporan PIR');
        }
      };
      fetchReport();
    } else {
      const savedDraft = localStorage.getItem('pir_report_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.formData) {
            setFormData(parsed.formData);
          }
          if (parsed.currentStep) {
            setCurrentStep(parsed.currentStep);
          }
        } catch (e) {
          console.error('Failed to parse PIR draft', e);
        }
      }
    }
  }, [editId]);

  // Save draft on state change
  useEffect(() => {
    if (!editId) {
      localStorage.setItem('pir_report_draft', JSON.stringify({ formData, currentStep }));
    }
  }, [formData, currentStep, editId]);

  // Handlers for Attendee List
  const addTDEAttendee = () => {
    if (!newTde.trim()) return;
    setFormData((prev) => ({ ...prev, attendeesTDE: [...prev.attendeesTDE, newTde.trim()] }));
    setNewTde('');
  };

  const removeTDEAttendee = (index: number) => {
    setFormData((prev) => ({ ...prev, attendeesTDE: prev.attendeesTDE.filter((_, i) => i !== index) }));
  };

  const addDMEAttendee = () => {
    if (!newDme.trim()) return;
    setFormData((prev) => ({ ...prev, attendeesDME: [...prev.attendeesDME, newDme.trim()] }));
    setNewDme('');
  };

  const removeDMEAttendee = (index: number) => {
    setFormData((prev) => ({ ...prev, attendeesDME: prev.attendeesDME.filter((_, i) => i !== index) }));
  };

  // Handlers for Corrective Actions
  const handleActionChange = (index: number, field: keyof PIRCorrectiveAction, value: string) => {
    const updated = [...formData.correctiveActions];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, correctiveActions: updated }));
  };

  const addActionRow = () => {
    setFormData((prev) => ({
      ...prev,
      correctiveActions: [
        ...prev.correctiveActions,
        {
          actionItem: `${prev.correctiveActions.length + 1}. `,
          typeOfAction: 'TROUBLESHOOTING ACTION',
          assignedTo: 'Facility Maintenance Team',
          bug: '- Issue / Bug details',
          startDate: 'April 13, 2026 10:00',
          endDate: 'April 14, 2026'
        }
      ]
    }));
  };

  const removeActionRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      correctiveActions: prev.correctiveActions.filter((_, i) => i !== index)
    }));
  };

  // Photo handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const newPhoto: PIRPhoto = {
            photoBase64: reader.result,
            caption: 'Foto Dokumentasi'
          };
          setFormData((prev) => ({
            ...prev,
            photos: [...prev.photos, newPhoto]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handlePhotoCaptionChange = (index: number, caption: string) => {
    const updated = [...formData.photos];
    updated[index].caption = caption;
    setFormData((prev) => ({ ...prev, photos: updated }));
  };

  // Validate step navigation
  const validateStep = (targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;

    // Step 1 Validation
    if (targetStep > 1) {
      if (!formData.incidentName?.trim()) {
        toast.error('Mohon isi Incident Name di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.incidentDate?.trim()) {
        toast.error('Mohon isi Incident Date di Step 1');
        setCurrentStep(1);
        return false;
      }
      if (!formData.postmortemOwner?.trim()) {
        toast.error('Mohon isi Postmortem Owner Name & Title di Step 1');
        setCurrentStep(1);
        return false;
      }
    }

    // Step 2 Validation
    if (targetStep > 2) {
      if (!formData.summary?.trim()) {
        toast.error('Mohon isi Summary di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.rootCause?.trim()) {
        toast.error('Mohon isi Root Cause di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.trigger?.trim()) {
        toast.error('Mohon isi Trigger di Step 2');
        setCurrentStep(2);
        return false;
      }
      if (!formData.resolution?.trim()) {
        toast.error('Mohon isi Resolution di Step 2');
        setCurrentStep(2);
        return false;
      }
    }

    // Step 3 Validation
    if (targetStep > 3) {
      if (!formData.detection?.trim()) {
        toast.error('Mohon isi Detection di Step 3');
        setCurrentStep(3);
        return false;
      }
      if (!formData.contributingFactors?.trim()) {
        toast.error('Mohon isi Contributing Factors di Step 3');
        setCurrentStep(3);
        return false;
      }
    }

    // Step 4 Validation
    if (targetStep > 4) {
      if (!formData.correctiveActions || formData.correctiveActions.length === 0 || !formData.correctiveActions[0]?.actionItem?.trim()) {
        toast.error('Mohon lengkapi minimal 1 Action Item di Step 4');
        setCurrentStep(4);
        return false;
      }
    }

    // Step 5 Validation
    if (targetStep > 5) {
      if (!formData.photos || formData.photos.length === 0) {
        toast.error('Mohon unggah minimal 1 Foto Dokumentasi di Step 5');
        setCurrentStep(5);
        return false;
      }
    }

    return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (validateStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  // Save to database
  const handleSubmitReport = async () => {
    if (!validateStep(6)) return;
    setSubmitting(true);
    toast.loading('Menyimpan Laporan PIR...', { id: 'save-pir' });

    try {
      const docPayload = {
        reportType: 'PIR',
        issue: formData.incidentName,
        location: 'Neutra DC Cikarang',
        ticketName: formData.incidentName,
        actionTaken: formData.resolution,
        status: 'Resolved',
        reportedBy: formData.reportAuthors,
        reportedByEmail: user?.email || 'standby@dwimitra.co.id',
        reportedAt: serverTimestamp(),
        ...formData
      };

      if (editId) {
        await updateDoc(doc(db, 'corrective_reports', editId), docPayload);
        toast.success('Laporan PIR berhasil diperbarui!', { id: 'save-pir' });
      } else {
        await addDoc(collection(db, 'corrective_reports'), docPayload);
        toast.success('Laporan PIR berhasil disimpan ke Arsip Standby!', { id: 'save-pir' });
        localStorage.removeItem('pir_report_draft');
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving PIR report:', err);
      toast.error('Gagal menyimpan Laporan PIR', { id: 'save-pir' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPDFOnly = async () => {
    if (!validateStep(6)) return;
    await generatePIRReportPDF(formData);
    setSubmitting(true);
    try {
      const docPayload = {
        reportType: 'PIR',
        issue: formData.incidentName,
        location: 'Neutra DC Cikarang',
        ticketName: formData.incidentName,
        actionTaken: formData.resolution,
        status: 'Resolved',
        reportedBy: formData.reportAuthors,
        reportedByEmail: user?.email || 'standby@dwimitra.co.id',
        reportedAt: serverTimestamp(),
        ...formData
      };

      if (editId) {
        await updateDoc(doc(db, 'corrective_reports', editId), docPayload);
        toast.success('Laporan PIR diekspor PDF & diperbarui di Arsip Standby!');
      } else {
        await addDoc(collection(db, 'corrective_reports'), docPayload);
        toast.success('Laporan PIR diekspor PDF & disimpan ke Arsip Standby!');
        localStorage.removeItem('pir_report_draft');
      }

      onSuccess();
    } catch (err) {
      console.error('Error auto-saving PIR report on export:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-red-200 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-red-900/10 text-slate-800 relative">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-red-100 text-red-700 font-extrabold text-xs rounded-full uppercase tracking-wider">
              FORM LAPORAN POSTMORTEM (PIR)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-600" />
            Postmortem Incident Report
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Format Resmi PDF 10-Halaman Standard PT Dwimitra Ekatama Mandiri / NeutraDC
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Step Indicator Navigation Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-200">
        {[
          { step: 1, label: '1. Incident & Severity' },
          { step: 2, label: '2. Summary & Overview' },
          { step: 3, label: '3. Factors & Lessons' },
          { step: 4, label: '4. Action Items' },
          { step: 5, label: '5. Foto Dokumentasi' },
          { step: 6, label: '6. TTD & Export PDF' }
        ].map((item) => (
          <button
            key={item.step}
            type="button"
            onClick={() => handleStepClick(item.step)}
            className={`py-2 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              currentStep === item.step
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : currentStep > item.step
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-500 hover:bg-slate-200/60'
            }`}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: INCIDENT & SEVERITY */}
      {currentStep === 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-200 pb-2">
              <FileText className="w-4 h-4 text-red-600" /> Informasi Dasar Incident & Owner
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">INCIDENT NAME</label>
                <input
                  type="text"
                  value={formData.incidentName}
                  onChange={(e) => setFormData({ ...formData, incidentName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">INCIDENT DATE</label>
                <input
                  type="text"
                  value={formData.incidentDate}
                  onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">INCIDENT ID</label>
                <input
                  type="text"
                  value={formData.incidentId}
                  onChange={(e) => setFormData({ ...formData, incidentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">POSTMORTEM OWNER NAME & TITLE</label>
                <input
                  type="text"
                  value={formData.postmortemOwner}
                  onChange={(e) => setFormData({ ...formData, postmortemOwner: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">DATE COMPLETED</label>
                <input
                  type="text"
                  value={formData.dateCompleted}
                  onChange={(e) => setFormData({ ...formData, dateCompleted: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">REPORT AUTHORS</label>
                <input
                  type="text"
                  value={formData.reportAuthors}
                  onChange={(e) => setFormData({ ...formData, reportAuthors: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">REPORT ID</label>
                <input
                  type="text"
                  value={formData.reportId}
                  onChange={(e) => setFormData({ ...formData, reportId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">LINK TO INCIDENT RECORDING</label>
                <input
                  type="text"
                  value={formData.linkToIncidentRecording}
                  onChange={(e) => setFormData({ ...formData, linkToIncidentRecording: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">POSTMORTEM MEETING DATE</label>
                <input
                  type="text"
                  value={formData.postmortemMeetingDate}
                  onChange={(e) => setFormData({ ...formData, postmortemMeetingDate: e.target.value })}
                  placeholder="e.g. 14 April 2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Meeting Attendees Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-200 pb-2">
              <User className="w-4 h-4 text-red-600" /> Meeting Attendees (TDE & DME)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* TDE Attendees */}
              <div>
                <label className="block text-xs font-bold text-red-700 uppercase mb-2">PESERTA TDE</label>
                <div className="space-y-2 mb-3">
                  {formData.attendeesTDE.map((name, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">
                      <span>• {name}</span>
                      <button type="button" onClick={() => removeTDEAttendee(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTde}
                    onChange={(e) => setNewTde(e.target.value)}
                    placeholder="+ Nama Peserta TDE"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none"
                  />
                  <button type="button" onClick={addTDEAttendee} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700">
                    Tambah
                  </button>
                </div>
              </div>

              {/* DME Attendees */}
              <div>
                <label className="block text-xs font-bold text-blue-700 uppercase mb-2">PESERTA DME</label>
                <div className="space-y-2 mb-3">
                  {formData.attendeesDME.map((name, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">
                      <span>• {name}</span>
                      <button type="button" onClick={() => removeDMEAttendee(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDme}
                    onChange={(e) => setNewDme(e.target.value)}
                    placeholder="+ Nama Peserta DME"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none"
                  />
                  <button type="button" onClick={addDMEAttendee} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                    Tambah
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Incident Severity Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-200 pb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Incident Severity Level
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['HIGH', 'MEDIUM', 'LOW', 'OTHER'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFormData({ ...formData, severityLevel: lvl })}
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition ${
                    formData.severityLevel === lvl
                      ? 'bg-red-600 text-white border-red-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  [ {formData.severityLevel === lvl ? 'X' : ' '} ] {lvl}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                ADDITIONAL COMMENTS REGARDING INCIDENT SEVERITY
              </label>
              <textarea
                rows={3}
                value={formData.severityComments}
                onChange={(e) => setFormData({ ...formData, severityComments: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 2: SUMMARY & OVERVIEW */}
      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">SUMMARY</h3>
            <textarea
              rows={4}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">INCIDENT OVERVIEW</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IMPACT</label>
                <textarea
                  rows={3}
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">TRIGGER</label>
                <textarea
                  rows={2}
                  value={formData.trigger}
                  onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">ROOT CAUSE</label>
                <textarea
                  rows={3}
                  value={formData.rootCause}
                  onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">DETECTION</label>
                <textarea
                  rows={2}
                  value={formData.detection}
                  onChange={(e) => setFormData({ ...formData, detection: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">RESPONSE</label>
                <textarea
                  rows={2}
                  value={formData.response}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">RESOLUTION</label>
                <textarea
                  rows={4}
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 3: FACTORS & LESSONS LEARNED */}
      {currentStep === 3 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">CONTRIBUTING FACTORS</h3>
            <textarea
              rows={5}
              value={formData.contributingFactors}
              onChange={(e) => setFormData({ ...formData, contributingFactors: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">LESSONS LEARNED</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">WHAT WENT WELL?</label>
                <textarea
                  rows={2}
                  value={formData.whatWentWell}
                  onChange={(e) => setFormData({ ...formData, whatWentWell: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-700 uppercase mb-1">WHAT WENT POORLY?</label>
                <textarea
                  rows={2}
                  value={formData.whatWentPoorly}
                  onChange={(e) => setFormData({ ...formData, whatWentPoorly: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-700 uppercase mb-1">WHERE WERE WE LUCKY?</label>
                <textarea
                  rows={2}
                  value={formData.whereWereWeLucky}
                  onChange={(e) => setFormData({ ...formData, whereWereWeLucky: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 4: ACTION ITEMS */}
      {currentStep === 4 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-slate-900 text-base">CORRECTIVE ACTIONS (TABLE)</h3>
              <button
                type="button"
                onClick={addActionRow}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Action Row
              </button>
            </div>

            <div className="space-y-4">
              {formData.correctiveActions.map((action, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 relative">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-xs text-red-600">ACTION ITEM #{idx + 1}</span>
                    {formData.correctiveActions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeActionRow(idx)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ACTION ITEM DESKRIPSI</label>
                    <textarea
                      rows={2}
                      value={action.actionItem}
                      onChange={(e) => handleActionChange(idx, 'actionItem', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">TYPE OF ACTION</label>
                      <input
                        type="text"
                        value={action.typeOfAction}
                        onChange={(e) => handleActionChange(idx, 'typeOfAction', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ASSIGNED TO</label>
                      <input
                        type="text"
                        value={action.assignedTo}
                        onChange={(e) => handleActionChange(idx, 'assignedTo', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BUG / TICKET</label>
                      <input
                        type="text"
                        value={action.bug}
                        onChange={(e) => handleActionChange(idx, 'bug', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">START / END DATE</label>
                      <input
                        type="text"
                        value={action.startDate}
                        onChange={(e) => handleActionChange(idx, 'startDate', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold mb-1"
                        placeholder="Start Date"
                      />
                      <input
                        type="text"
                        value={action.endDate}
                        onChange={(e) => handleActionChange(idx, 'endDate', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                        placeholder="End Date"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 5: PHOTOS */}
      {currentStep === 5 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-red-600" /> SUPPORTING DOCUMENTATION (FOTO)
              </h3>
              <label className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 cursor-pointer flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Upload Foto Insiden
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            {formData.photos.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">Belum ada foto dokumentasi. Klik tombol di atas untuk upload foto.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formData.photos.map((photo, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200 space-y-3">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 group">
                      <img src={photo.photoBase64} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingPhotoIndex(idx)}
                          className="p-1.5 bg-black/60 hover:bg-black text-white rounded-lg text-xs"
                          title="Crop/Edit Foto"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                          title="Hapus Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CAPTION FOTO #{idx + 1}</label>
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => handlePhotoCaptionChange(idx, e.target.value)}
                        placeholder="Deskripsi Foto (e.g. Checking inspection by DME team)"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image Editor Modal if cropping */}
          {editingPhotoIndex !== null && (
            <ImageEditor
              image={formData.photos[editingPhotoIndex].photoBase64}
              onSave={(cropped) => {
                const updated = [...formData.photos];
                updated[editingPhotoIndex].photoBase64 = cropped;
                setFormData({ ...formData, photos: updated });
                setEditingPhotoIndex(null);
              }}
              onCancel={() => setEditingPhotoIndex(null)}
            />
          )}
        </motion.div>
      )}

      {/* STEP 6: SIGNATURES & EXPORT PDF / SAVE */}
      {currentStep === 6 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-red-600" /> Kustomisasi Nama & Jabatan Tanda Tangan (Halaman 9)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-red-600 uppercase mb-1 flex items-center justify-between">
                  <span>1. PREPARED BY</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase">(Bisa Diubah)</span>
                </label>
                <input
                  type="text"
                  value={formData.preparedByName}
                  onChange={(e) => setFormData({ ...formData, preparedByName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold mb-1 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  value={formData.preparedByTitle}
                  onChange={(e) => setFormData({ ...formData, preparedByTitle: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-500 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Jabatan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>2. REVIEWED BY (1)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.reviewedBy1Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.reviewedBy1Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>3. REVIEWED BY (2)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.reviewedBy2Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.reviewedBy2Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>4. ACKNOWLEDGED BY (Kiri)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.acknowledgedBy1Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.acknowledgedBy1Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-red-600 uppercase mb-1 flex items-center justify-between">
                  <span>5. ACKNOWLEDGED BY (Kanan)</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase">(Bisa Diubah)</span>
                </label>
                <input
                  type="text"
                  value={formData.acknowledgedBy2Name}
                  onChange={(e) => setFormData({ ...formData, acknowledgedBy2Name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold mb-1 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  value={formData.acknowledgedBy2Title}
                  onChange={(e) => setFormData({ ...formData, acknowledgedBy2Title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-500 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Jabatan"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>6. APPROVED BY (1)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy1Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy1Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>7. APPROVED BY (2)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy2Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy2Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span>8. APPROVED BY (3)</span>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">(Paten)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy3Name}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed mb-1"
                  placeholder="Nama"
                />
                <input
                  type="text"
                  readOnly
                  value={formData.approvedBy3Title}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                  placeholder="Jabatan"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom Action Footer Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-5 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
          )}

          {currentStep < 6 && (
            <button
              type="button"
              onClick={() => handleStepClick(currentStep + 1)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              Lanjut <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {currentStep === 6 && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportPDFOnly}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>

            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={submitting}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Simpan Laporan PIR</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
