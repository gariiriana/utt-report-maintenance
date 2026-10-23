// Saran Incident Severity di form PIR dari katalog SLA equipment (sama dengan form SLA):
// equipment High/Medium/Low -> HIGH/MEDIUM/LOW, equipment di luar katalog -> OTHER.
import { useState } from 'react';
import { Search, X, Zap } from 'lucide-react';
import { EQUIPMENT_SLA_CATALOG, type EquipmentSLAItem } from '@/config/equipmentSlaCatalog';

export type SeverityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'OTHER';

const PRIORITY_BADGE: Record<EquipmentSLAItem['defaultPriority'], string> = {
  High: 'bg-amber-100 text-amber-800 border-amber-300',
  Medium: 'bg-blue-100 text-blue-800 border-blue-300',
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function EquipmentSeverityPicker({ onPick }: { onPick: (level: SeverityLevel) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<{ equipment: string; level: SeverityLevel } | null>(null);
  const term = search.trim().toLowerCase();
  const matches = EQUIPMENT_SLA_CATALOG.filter(item =>
    item.device.toLowerCase().includes(term) || item.category.toLowerCase().includes(term));

  const pick = (equipment: string, level: SeverityLevel) => {
    setSearch(equipment);
    setPicked({ equipment, level });
    setOpen(false);
    onPick(level);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase mb-1">
        <Zap className="w-3.5 h-3.5 text-amber-500" /> Equipment / Perangkat Terganggu
      </label>
      <p className="text-[11px] text-slate-500 mb-2">Ketik nama equipment, severity terisi otomatis sesuai prioritas SLA.</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPicked(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ketik misal: UPS, Chiller, Trafo, Generator..."
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition shadow-sm font-medium"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setPicked(null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
            {matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item.device, item.defaultPriority.toUpperCase() as SeverityLevel)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between gap-2 group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition">{item.device}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Kategori: {item.category}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${PRIORITY_BADGE[item.defaultPriority]}`}>
                  {item.defaultPriority.toUpperCase()}
                </span>
              </button>
            ))}
            {term && matches.length === 0 && (
              <button
                type="button"
                onClick={() => pick(search.trim(), 'OTHER')}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between gap-2 cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{search.trim()}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Tidak ada di katalog SLA</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-100 text-purple-800 border-purple-300">OTHER</span>
              </button>
            )}
          </div>
        </>
      )}

      {picked && (
        <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
          {picked.equipment} → severity {picked.level}. Masih bisa diubah manual di bawah.
        </p>
      )}
    </div>
  );
}
