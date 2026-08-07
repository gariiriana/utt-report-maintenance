// ============================================================================
// FILE: MaintenanceLogic.ts
// Deskripsi: Utility untuk menghitung kalkulasi progres pemeliharaan (PM Schedule / Activity).
//            Mengolah data jumlah rencana (plan), realisasi kemarin (yesterday),
//            dan realisasi hari ini (today/actual) per kategori perangkat,
//            serta menghitung persentase progres harian secara kumulatif.
// ============================================================================

// Interface data aktivitas pemeliharaan individu
export interface MaintenanceProgress {
  id: string;              // ID unik aktivitas
  category: string;        // Kategori perangkat (contoh: "Electrical", "HVAC & Cooling")
  equipment_name: string;  // Nama perangkat (contoh: "UPS 100kVA")
  plan_qty: number;        // Target jumlah unit yang direncanakan
  yesterday_qty?: number;  // Jumlah unit yang sudah dikerjakan sampai kemarin
  actual_qty: number;      // Jumlah unit yang dikerjakan hari ini
  remark: string;          // Catatan/keterangan pekerjaan
  plan_start?: string;     // Tanggal mulai rencana
  plan_finish?: string;    // Tanggal selesai rencana
  year?: number;           // Tahun pelaksanaan
  quarter?: string;        // Kuartal (Q1/Q2/Q3/Q4)
}

// Interface ringkasan per kategori perangkat
export interface CategorySummary {
  category: string;           // Nama kategori
  plan_qty: number;           // Total target plan dalam kategori ini
  weight_percent: number;     // Bobot persentase kategori dibanding total keseluruhan plan
  yesterday_qty: number;     // Total realisasi kemarin
  yesterday_percent: number; // Persentase capaian kemarin (%)
  today_qty: number;         // Total realisasi hari ini
  today_percent: number;     // Persentase capaian total hari ini (%)
}

// Interface hasil akhir ringkasan seluruh pemeliharaan
export interface MaintenanceSummary {
  category_summaries: CategorySummary[]; // Daftar ringkasan per kategori
  total_plan_qty: number;               // Total seluruh target plan
  total_yesterday_qty: number;          // Total unit dikerjakan sampai kemarin
  total_yesterday_percent: number;      // Total persentase capaian kemarin (%)
  total_today_qty: number;              // Total unit dikerjakan sampai hari ini
  total_today_percent: number;          // Total persentase capaian hari ini (%)
  daily_progress: number;               // Kenaikan progres harian (selisih hari ini - kemarin) (%)
}

/**
 * Memproses array aktivitas pemeliharaan dan menghasilkan kalkulasi ringkasan statistik.
 * @param activities Array aktivitas MaintenanceProgress
 * @returns Objek MaintenanceSummary lengkap dengan perhitungan persentase & bobot
 */
export function calculateMaintenanceSummary(activities: MaintenanceProgress[]): MaintenanceSummary {
  // Jika data kosong, kembalikan struktur default ber-nilai 0
  if (!activities || activities.length === 0) {
    return {
      category_summaries: [],
      total_plan_qty: 0,
      total_yesterday_qty: 0,
      total_yesterday_percent: 0,
      total_today_qty: 0,
      total_today_percent: 0,
      daily_progress: 0
    };
  }

  const result: MaintenanceSummary = {
    category_summaries: [],
    total_plan_qty: 0,
    total_yesterday_qty: 0,
    total_yesterday_percent: 0,
    total_today_qty: 0,
    total_today_percent: 0,
    daily_progress: 0
  };

  // Pengelompokan data berdasarkan nama kategori
  const groups: Record<string, MaintenanceProgress[]> = {};
  activities.forEach(a => {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);

    // Akumulasi total kuantitas secara keseluruhan
    result.total_plan_qty += a.plan_qty;
    result.total_yesterday_qty += a.yesterday_qty || 0;
    result.total_today_qty += a.actual_qty;
  });

  // Hitung persentase total kemarin dan hari ini (dibulatkan 2 desimal)
  if (result.total_plan_qty > 0) {
    result.total_yesterday_percent = Math.round((result.total_yesterday_qty / result.total_plan_qty) * 10000) / 100;
    result.total_today_percent = Math.round((result.total_today_qty / result.total_plan_qty) * 10000) / 100;
  }
  // Hitung selisih progres harian
  result.daily_progress = Math.round((result.total_today_percent - result.total_yesterday_percent) * 100) / 100;

  // Hitung rincian statistik per masing-masing kategori
  Object.keys(groups).sort().forEach(catName => {
    const catItems = groups[catName];
    const catPlan = catItems.reduce((sum, item) => sum + item.plan_qty, 0);
    const catYesterday = catItems.reduce((sum, item) => sum + (item.yesterday_qty || 0), 0);
    const catToday = catItems.reduce((sum, item) => sum + item.actual_qty, 0);

    result.category_summaries.push({
      category: catName,
      plan_qty: catPlan,
      weight_percent: result.total_plan_qty > 0 ? Math.round((catPlan / result.total_plan_qty) * 10000) / 100 : 0,
      yesterday_qty: catYesterday,
      yesterday_percent: catPlan > 0 ? Math.round((catYesterday / catPlan) * 10000) / 100 : 0,
      today_qty: catToday,
      today_percent: catPlan > 0 ? Math.round((catToday / catPlan) * 10000) / 100 : 0
    });
  });

  return result;
}
