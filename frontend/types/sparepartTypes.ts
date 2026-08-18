// ============================================================================
// FILE: frontend/types/sparepartTypes.ts
// Deskripsi: Interface dan tipe data untuk Modul Sparepart & Material Replacement.
// ============================================================================

export type SparepartActionStatus = 'Replaced' | 'Serviced' | 'Pending Replacement';

export interface SparepartLogItem {
  id?: string;
  date: string;                   // Format: YYYY-MM-DD
  monthYear: string;             // Format: YYYY-MM (e.g. 2026-07)
  equipmentName: string;         // e.g. "Chiller 1", "Genset 1F-DG-A", "CT - 1"
  systemCategory: string;        // e.g. "Chiller", "Cooling Tower", "Generator & Fuel system", "FSS"
  location?: string;             // e.g. "Power House Lt.1", "PH Rooftop"
  partName: string;              // e.g. "Fan belt", "Expansion Join flange DN 350", "Baterai VESDA"
  partNumber: string;            // e.g. "17 x 4000 b 158", "VOZ VA12-2.3 (12V 2.3Ah)"
  quantity: number;
  unit: string;                  // e.g. "Pcs", "Unit", "Set", "Liter", "Roll", "Batang"
  status: SparepartActionStatus;
  technicianName: string;
  notes?: string;
  photoBefore?: string;          // Base64 or URL
  photoAfter?: string;           // Base64 or URL
  createdAt?: any;
  createdBy?: string;
  createdByEmail?: string;
}
