import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/api/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { 
  Clock, Package, User, CheckCircle2, 
  RefreshCcw, Layers, ClipboardList
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { SignaturePad } from './ui/SignaturePad';
import { toast } from 'sonner';

export function BorrowingStatusList() {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [returnTime, setReturnTime] = useState(new Date().toTimeString().slice(0, 5));
  const [returnSignature, setReturnSignature] = useState('');

  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'inventory_borrowings'),
      where('engineerEmail', '==', user.email),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBorrowings(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.email]);

  const handleReturn = async (id: string) => {
    if (!returnSignature) return toast.error('Tanda tangan wajib diisi');

    const toastId = toast.loading('Memproses pengembalian...');
    try {
      await updateDoc(doc(db, 'inventory_borrowings', id), {
        status: 'return_pending',
        returnTime,
        returnSignature,
        returnDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });
      toast.success('Pengajuan pengembalian berhasil dikirim', { id: toastId });
      setReturnId(null);
      setReturnSignature('');
    } catch (error) {
      console.error('Return error:', error);
      toast.error('Gagal memproses pengembalian', { id: toastId });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase tracking-wider text-[10px]">Menunggu Persetujuan</Badge>;
      case 'borrowed':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold uppercase tracking-wider text-[10px]">Sedang Dipinjam</Badge>;
      case 'return_pending':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold uppercase tracking-wider text-[10px]">Menunggu Konfirmasi Kembali</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold uppercase tracking-wider text-[10px]">Telah Dikembalikan</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-bold uppercase tracking-wider text-[10px]">Ditolak</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 font-bold uppercase tracking-wider text-[10px]">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Memuat data peminjaman...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {borrowings.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-16 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-slate-900/20"
        >
          <div className="p-4 bg-slate-800/50 rounded-2xl">
            <Package className="w-10 h-10 text-slate-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-400">Belum ada data peminjaman</h3>
            <p className="text-sm text-slate-600 font-medium">Semua pengajuan peminjaman barang Anda akan muncul di sini.</p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {borrowings.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:border-slate-500/50 transition-all group"
              >
                <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/15 rounded-2xl group-hover:bg-blue-500/25 transition-colors border border-blue-500/20 shadow-lg shadow-blue-900/10">
                      <Layers className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="font-black text-slate-100 uppercase tracking-[0.05em] truncate max-w-[140px] text-xs">
                      {doc.items?.length || 0} Barang Pinjaman
                    </div>
                  </div>
                  {getStatusBadge(doc.status)}
                </div>

                <div className="p-4 space-y-5">
                  {/* Items List */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] pl-0.5">Daftar Barang</p>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-none">
                      {doc.items?.map((tool: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-sm font-bold text-slate-200 bg-slate-950 border border-slate-800/80 px-3.5 py-2.5 rounded-2xl group-hover:border-blue-500/30 group-hover:bg-slate-900/50 transition-all shadow-sm">
                          <div className="flex items-center gap-2.5 truncate">
                            <Package className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="truncate">{tool.name}</span>
                          </div>
                          <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-xl shrink-0 border border-blue-500/20">
                            {tool.quantity} Qty
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                       <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-0.5">Untuk Maintenance Apa</p>
                       <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/50 truncate">
                         <ClipboardList className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                         <span className="truncate">{doc.purpose}</span>
                       </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-0.5">Peminjam</p>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-200 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/50 truncate">
                        {doc.facePhoto && (
                          <img src={doc.facePhoto} alt="Face" className="w-5 h-5 rounded-full object-cover border border-slate-700" />
                        )}
                        {!doc.facePhoto && <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        <span className="truncate">{doc.borrowerName}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest pl-0.5">Waktu Pinjam</p>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/50">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{doc.requestTime}</span>
                      </div>
                    </div>
                  </div>

                  {doc.status === 'borrowed' && (
                    <Button
                      onClick={() => setReturnId(doc.id)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      KEMBALIKAN BARANG
                    </Button>
                  )}
                  
                  {doc.status === 'completed' && doc.returnTime && (
                    <div className="pt-2 border-t border-slate-800/60 mt-2">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> Dikembalikan pada {doc.returnDate} {doc.returnTime}
                       </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Return Modal */}
      <AnimatePresence>
        {returnId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setReturnId(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-700/50 w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/15 rounded-xl">
                  <RefreshCcw className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Form Pengembalian</h3>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Konfirmasi waktu & tanda tangan pengembalian</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Jam Pengembalian</label>
                  <div className="relative group">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type="time"
                      lang="id-ID"
                      step="60"
                      value={returnTime}
                      onChange={e => setReturnTime(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker()}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/5 transition cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tanda Tangan Pengembalian</label>
                   <SignaturePad onSave={setReturnSignature} placeholder="Tanda tangan di sini..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setReturnId(null)} className="flex-1 rounded-xl h-12 font-bold text-slate-400 hover:bg-slate-800/50">Batal</Button>
                <Button 
                   onClick={() => handleReturn(returnId)} 
                   disabled={!returnSignature}
                   className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]"
                >
                  KONFIRMASI
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
