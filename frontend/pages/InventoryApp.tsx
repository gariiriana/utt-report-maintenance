import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/api/firebase';
import { 
  collection, query, onSnapshot, updateDoc, doc, 
  serverTimestamp, orderBy 
} from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { 
  Check, X, Search, History, Package, 
  AlertCircle, ChevronRight, LogOut, ArrowRightLeft, 
  Inbox, Calendar, QrCode, RefreshCcw, Hash, CheckCircle2,
  Layers, ClipboardList, Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCenterBackground } from '@/components/DataCenterBackground';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import logoUTT from '@/assets/logo_utt.png';
import { useScreenshot } from '@/hooks/useScreenshot';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

export function InventoryApp() {
  const { user, logout } = useAuth();
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'borrowed' | 'return_pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const { takeScreenshot } = useScreenshot();

  useEffect(() => {
    const q = query(
      collection(db, 'inventory_borrowings'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBorrowings(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const toastId = toast.loading('Memperbarui status...');
    try {
      await updateDoc(doc(db, 'inventory_borrowings', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status diperbarui ke ${newStatus}`, { id: toastId });
      setSelectedItem(null);
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Gagal memperbarui status', { id: toastId });
    }
  };

  const filteredData = borrowings.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter;
    const itemsString = item.items?.map((i: any) => i.name).join(' ') || '';
    const matchesSearch = itemsString.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.engineerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    pending: borrowings.filter(i => i.status === 'pending').length,
    borrowed: borrowings.filter(i => i.status === 'borrowed').length,
    returning: borrowings.filter(i => i.status === 'return_pending').length,
    completed: borrowings.filter(i => i.status === 'completed').length,
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'Menunggu Persetujuan', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'borrowed': return { label: 'Sedang Dipinjam', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'return_pending': return { label: 'Verifikasi Kembali', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'completed': return { label: 'Selesai', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'rejected': return { label: 'Ditolak', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
      default: return { label: status, color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <DataCenterBackground />

      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <img src={logoUTT} className="w-16 h-16 object-contain" alt="UTT Logo" />
             <div>
                <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Manajemen Peminjaman Alat</h1>
                <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                   <QrCode className="w-3 h-3" /> Dashboard Sistem
                </div>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Masuk sebagai Tim Peminjaman</p>
                <p className="text-sm font-medium text-slate-300">{user?.email}</p>
             </div>
             <Button 
                variant="outline" 
                onClick={() => {
                  toast.promise(takeScreenshot('inventory-dashboard', `inventory-report-${new Date().toISOString().split('T')[0]}.png`), {
                    loading: 'Menyiapkan tangkapan layar...',
                    success: 'Tangkapan layar berhasil disimpan!',
                    error: 'Gagal mengambil tangkapan layar'
                  });
                }}
                className="bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all mr-2"
             >
                <Camera className="w-4 h-4 mr-2" /> Capture View
             </Button>
             <Button variant="outline" onClick={() => setLogoutModalOpen(true)} className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-red-600/10 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4 mr-2" /> Keluar
             </Button>
          </div>
        </div>
      </header>

      <main id="inventory-dashboard" className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 relative z-10">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Menunggu', count: stats.pending, icon: Inbox, color: 'blue' },
            { label: 'Dipinjam', count: stats.borrowed, icon: ArrowRightLeft, color: 'amber' },
            { label: 'Riwayat Kembali', count: stats.returning, icon: RefreshCcw, color: 'purple' },
            { label: 'Riwayat', count: stats.completed, icon: History, color: 'emerald' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-4 rounded-2xl flex items-center gap-4 group hover:border-slate-700 transition-all"
            >
              <div className={`p-3 rounded-xl bg-${stat.color}-500/10 group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-white leading-none">{stat.count}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dashboard Content */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
          {/* Toolbar */}
          <div className="p-4 md:p-6 border-b border-slate-800/60 bg-slate-900/40 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Cari alat, engineer, atau pesanan..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
               {[
                 { id: 'all', label: 'Semua' },
                 { id: 'pending', label: 'Menunggu' },
                 { id: 'borrowed', label: 'Dipinjam' },
                 { id: 'return_pending', label: 'Kembali' },
                 { id: 'completed', label: 'Riwayat' },
               ].map(t => (
                 <button
                   key={t.id}
                   onClick={() => setFilter(t.id as any)}
                   className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                     filter === t.id 
                       ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                       : 'bg-slate-800/40 text-slate-500 hover:text-slate-300 border border-transparent'
                   }`}
                 >
                   {t.label}
                 </button>
               ))}
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                 <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sinkronisasi Data Peminjaman...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                 <AlertCircle className="w-12 h-12 text-slate-800 mx-auto" />
                 <p className="text-slate-500 font-medium tracking-wide">No borrowing records found for this criteria.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-950/30">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-[40%]">Material / Barang</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pemohon</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredData.map((item) => {
                    const statusInfo = getStatusInfo(item.status);
                    return (
                      <motion.tr 
                        key={item.id} 
                        layout
                        className="hover:bg-slate-800/20 transition-colors group cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-slate-800/50 rounded-xl group-hover:bg-blue-600/10 group-hover:text-blue-400 transition-all text-slate-500">
                                <Layers className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="font-bold text-white text-sm uppercase tracking-wide group-hover:text-blue-400 transition-colors">
                                   {item.items?.[0]?.name || 'Unknown Item'} 
                                   {item.items?.length > 1 ? ` (+${item.items.length - 1} more)` : ''}
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                   <Hash className="w-3 h-3" /> {item.items?.length || 0} Jenis Barang • <Calendar className="w-3 h-3" /> {item.requestDate}
                                </p>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold text-xs">
                                 {item.borrowerName.charAt(0)}
                              </div>
                              <div>
                                 <p className="text-sm font-semibold text-slate-200">{item.borrowerName}</p>
                                 <p className="text-[10px] text-slate-600 font-bold tracking-tight truncate max-w-[120px]">{item.engineerEmail}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <Badge className={`${statusInfo.color} px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest`}>
                              {statusInfo.label}
                           </Badge>
                        </td>
                        <td className="px-6 py-5 text-right">
                           <div className="flex items-center justify-end gap-2">
                              {item.status === 'pending' && (
                                <>
                                   <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, 'borrowed'); }} className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all border border-emerald-500/20 shadow-lg shadow-emerald-900/5">
                                      <Check className="w-4 h-4" />
                                   </button>
                                   <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, 'rejected'); }} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 shadow-lg shadow-red-900/5">
                                      <X className="w-4 h-4" />
                                   </button>
                                </>
                              )}
                              {item.status === 'return_pending' && (
                                 <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(item.id, 'completed'); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-50 text-white hover:text-blue-600 font-bold text-[10px] rounded-lg transition-all border border-blue-500 shadow-lg shadow-blue-900/20 uppercase tracking-widest">
                                    Approve Return
                                 </button>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                           </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setSelectedItem(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700/50 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
               <div className="p-1.5 flex flex-col flex-1">
                  <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
                     {/* Item Info */}
                     <div className="flex justify-between items-start">
                         <div className="space-y-1">
                            <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                               <Info className="w-3.5 h-3.5" /> Detail Permintaan
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                               {selectedItem.items?.length || 0} Barang Pinjaman
                            </h2>
                            <Badge className={`${getStatusInfo(selectedItem.status).color} px-3 py-1 rounded-full text-[10px] font-bold mt-2 uppercase`}>
                               {getStatusInfo(selectedItem.status).label}
                            </Badge>
                         </div>
                        <button onClick={() => setSelectedItem(null)} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors text-slate-500">
                           <X className="w-6 h-6" />
                        </button>
                     </div>

                      <div className="py-8 border-y border-slate-800/50 space-y-6">
                         <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1 font-bold">
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Pemohon</p>
                               <p className="text-lg font-bold text-white leading-tight">{selectedItem.borrowerName}</p>
                               <p className="text-xs text-slate-500 font-medium">{selectedItem.engineerEmail}</p>
                            </div>
                            <div className="space-y-1 font-bold">
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Waktu Permintaan</p>
                               <p className="text-lg font-bold text-slate-200">{selectedItem.requestDate} <span className="text-slate-500 ml-1">@{selectedItem.requestTime}</span></p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest pl-0.5">Daftar Barang & Material</p>
                            <div className="grid grid-cols-1 gap-2">
                               {selectedItem.items?.map((tool: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl group/item transition-all hover:border-blue-500/30">
                                     <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-900 rounded-lg text-slate-500 group-hover/item:text-blue-400 transition-colors">
                                           <Package className="w-4 h-4" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-200">{tool.name}</p>
                                     </div>
                                     <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-xl text-xs font-black">
                                        {tool.quantity} Qty
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>

                         <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Untuk Maintenance Apa</p>
                            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                               <ClipboardList className="w-4 h-4 text-slate-600" />
                               <span className="text-sm font-bold text-slate-300">{selectedItem.purpose}</span>
                            </div>
                         </div>
                      </div>

                     {/* Signatures */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {selectedItem.requestSignature && (
                           <div className="space-y-3">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                 <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Tanda Tangan Peminjam
                              </p>
                              <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl aspect-[3/2] flex items-center justify-center overflow-hidden">
                                 <img src={selectedItem.requestSignature} className="max-h-full invert brightness-200 opacity-80" alt="Signature" />
                              </div>
                           </div>
                        )}
                        {selectedItem.returnSignature && (
                           <div className="space-y-3">
                              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                 <History className="w-3.5 h-3.5" /> Tanda Tangan Kembali
                              </p>
                              <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl aspect-[3/2] flex items-center justify-center overflow-hidden">
                                 <img src={selectedItem.returnSignature} className="max-h-full invert brightness-200 opacity-80" alt="Return Signature" />
                              </div>
                           </div>
                        )}
                     </div>

                     {selectedItem.status === 'pending' && (
                        <div className="flex gap-4 pt-4">
                           <Button onClick={() => handleUpdateStatus(selectedItem.id, 'rejected')} variant="outline" className="flex-1 h-14 rounded-2xl font-bold text-red-400 border-red-500/20 hover:bg-red-500/10">TOLAK PERMINTAAN</Button>
                           <Button onClick={() => handleUpdateStatus(selectedItem.id, 'borrowed')} className="flex-1 h-14 rounded-2xl font-bold bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-900/30">SETUJUI PEMINJAMAN</Button>
                        </div>
                     )}
                     
                     {selectedItem.status === 'return_pending' && (
                        <div className="pt-4">
                           <Button onClick={() => handleUpdateStatus(selectedItem.id, 'completed')} className="w-full h-14 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-900/30">KONFIRMASI PENGEMBALIAN SELESAI</Button>
                        </div>
                     )}
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}
