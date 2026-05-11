import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Package, ClipboardList, Calendar,
  Clock, Send, ShieldCheck, Plus, Trash2,
  Layers, Camera, Check
} from 'lucide-react';
import { SignaturePad } from './ui/SignaturePad';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { useScreenshot } from '@/hooks/useScreenshot';
import { toast } from 'sonner';

interface SuccessReceiptProps {
  data: any;
  onDone: () => void;
}

function SuccessReceipt({ data, onDone }: SuccessReceiptProps) {
  const { takeScreenshot } = useScreenshot();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div id="borrowing-receipt" className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">

        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />

        <div className="text-center space-y-2 relative z-10">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Pengajuan Berhasil!</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Digital Receipt • {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-900">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Peminjam</p>
              <p className="text-sm font-bold text-slate-200">{data.borrowerName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Waktu</p>
              <p className="text-sm font-bold text-slate-200">{data.requestDate} @{data.requestTime}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Daftar Barang</p>
            <div className="space-y-1.5">
              {data.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50">
                  <span className="text-xs font-bold text-slate-300">{item.name}</span>
                  <span className="text-[10px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-md">{item.quantity} Qty</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-center">
             <div className="space-y-2 text-center w-full max-w-[200px]">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Tanda Tangan</p>
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 aspect-square flex items-center justify-center overflow-hidden">
                   <img src={data.requestSignature} className="max-h-full invert brightness-200 opacity-80" alt="Signature" />
                </div>
             </div>
          </div>
        </div>

        <div className="pt-6 text-center">
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Sultanah Maintenance System • Security Verified</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            toast.promise(takeScreenshot('borrowing-receipt', `receipt-${data.borrowerName.replace(/\s+/g, '-')}.png`), {
              loading: 'Menyiapkan gambar...',
              success: 'Berhasil disimpan!',
              error: 'Gagal mengambil gambar'
            });
          }}
          className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-700"
        >
          <Camera className="w-4 h-4" /> Simpan Sebagai Gambar
        </button>
        <button
          onClick={onDone}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20"
        >
          <Check className="w-4 h-4" /> Selesai
        </button>
      </div>
    </motion.div>
  );
}

interface BorrowingItem {
  id: string;
  name: string;
  quantity: number | string;
}

interface BorrowingFormProps {
  onSuccess: () => void;
}

export function BorrowingForm({ onSuccess }: BorrowingFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submittedData, setSubmittedData] = useState<any | null>(null);

  const [formData, setFormData] = useState<{
    borrowerName: string;
    items: BorrowingItem[];
    purpose: string;
    requestDate: string;
    requestTime: string;
    requestSignature: string;
  }>({
    borrowerName: '',
    items: [{ id: Math.random().toString(36).substr(2, 9), name: '', quantity: 1 }],
    purpose: '',
    requestDate: new Date().toISOString().split('T')[0],
    requestTime: new Date().toTimeString().slice(0, 5),
    requestSignature: ''
  });

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: Math.random().toString(36).substr(2, 9), name: '', quantity: 1 }]
    }));
  };

  const removeItem = (id: string) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, field: 'name' | 'quantity', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasEmptyItems = formData.items.some(item => !item.name.trim() || Number(item.quantity) < 1);
    if (!formData.borrowerName || hasEmptyItems || !formData.purpose || !formData.requestSignature) {
      return toast.error('Harap lengkapi semua field, item, dan tanda tangan');
    }

    setLoading(true);
    const toastId = toast.loading('Mengirim pengajuan...');

    try {
      await addDoc(collection(db, 'inventory_borrowings'), {
        borrowerName: formData.borrowerName,
        items: formData.items.map(({ name, quantity }) => ({
          name: name.trim(),
          quantity: typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity
        })),
        purpose: formData.purpose,
        requestDate: formData.requestDate,
        requestTime: formData.requestTime,
        requestSignature: formData.requestSignature,
        engineerEmail: user?.email,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Pengajuan berhasil dikirim', { id: toastId });
      setSubmittedData({ ...formData });

      setFormData({
        borrowerName: '',
        items: [{ id: Math.random().toString(36).substr(2, 9), name: '', quantity: 1 }],
        purpose: '',
        requestDate: new Date().toISOString().split('T')[0],
        requestTime: new Date().toTimeString().slice(0, 5),
        requestSignature: ''
      });
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Gagal mengirim pengajuan', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl p-6"
    >
      <AnimatePresence mode="wait">
        {submittedData ? (
          <SuccessReceipt
            data={submittedData}
            onDone={() => {
              setSubmittedData(null);
              onSuccess();
            }}
          />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/15 rounded-xl">
          <ClipboardList className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Form Peminjaman Alat</h2>
          <p className="text-sm text-slate-500 font-medium tracking-wide first-letter:uppercase">Lengkapi detail peminjaman alat/material</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-6">
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Nama Peminjam</label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={formData.borrowerName}
                  onChange={e => setFormData({ ...formData, borrowerName: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition"
                  placeholder="cth: Gari Iriana"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Untuk Maintenance Apa</label>
              <div className="relative group">
                <ClipboardList className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={formData.purpose}
                  onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition"
                  placeholder="cth: Maintenance UPS / Perbaikan AC"
                />
              </div>
            </div>
          </div>

  
          <div className="space-y-4">
            <div className="flex items-center justify-between pl-1">
               <label className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                 <Layers className="w-3.5 h-3.5" /> Daftar Barang Pinjaman
               </label>
               <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-blue-500/20"
               >
                 <Plus className="w-3.5 h-3.5" /> Tambah Barang
               </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {formData.items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl relative group/row hover:border-slate-700 transition-all shadow-lg"
                  >
                    <div className="flex-[3] relative">
                       <label className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest absolute -top-1.5 left-2 sm:left-3 bg-slate-950 px-1 border border-slate-800 rounded-full z-10">Nama Barang</label>
                       <Package className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                       <input
                        type="text"
                        placeholder="Nama Barang"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        className="w-full pl-8 sm:pl-10 pr-3 py-2.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium text-white placeholder-slate-700 outline-none focus:border-blue-500/50 transition"
                       />
                    </div>

                    <div className="w-16 sm:w-32 relative">
                        <label className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest absolute -top-1.5 left-2 sm:left-3 bg-slate-950 px-1 border border-slate-800 rounded-full z-10">Qty</label>
                        <input
                         type="number"
                         min="1"
                         placeholder="Qty"
                         value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        onBlur={e => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val < 1) {
                            updateItem(item.id, 'quantity', 1);
                          } else {
                            updateItem(item.id, 'quantity', val);
                          }
                        }}
                         className="w-full px-2 py-2.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-white text-center placeholder-slate-700 outline-none focus:border-blue-500/50 transition"
                        />
                    </div>

                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-2 sm:p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl sm:rounded-2xl transition-all border border-red-500/20 flex items-center justify-center shrink-0"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Tanggal Pengajuan</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="date"
                  value={formData.requestDate}
                  onChange={e => setFormData({ ...formData, requestDate: e.target.value })}
                  onClick={(e) => e.currentTarget.showPicker()}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500/50 transition cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Jam Pengajuan</label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="time"
                  lang="id-ID"
                  step="60"
                  value={formData.requestTime}
                  onChange={e => setFormData({ ...formData, requestTime: e.target.value })}
                  onClick={(e) => e.currentTarget.showPicker()}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500/50 transition cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <div className="w-full max-w-md space-y-4">
            <label className="text-xs font-bold text-red-400/80 uppercase tracking-widest pl-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Tanda Tangan Peminjam
            </label>
            <SignaturePad onSave={dataUrl => setFormData({ ...formData, requestSignature: dataUrl })} />
          </div>
        </div>


        <div className="pt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98] disabled:opacity-50 border border-white/10"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <div className="p-1.5 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 -rotate-12" />
                </div>
                <span>SIMPAN & KIRIM PENGAJUAN</span>
              </>
            )}
          </button>
        </div>
      </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

