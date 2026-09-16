# SPESIFIKASI STANDAR MASTER LAYOUT & FORM DOKUMEN SOP & EOP
**PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang**

Dokumen ini memuat dokumentasi visual dan teknis 100% presisi untuk hasil ekspor dokumen **SOP (Standard Operating Procedure)** dan **EOP (Emergency Operating Procedure)** berdasarkan master file resmi Trafindo.

---

# BAGIAN 1: SPESIFIKASI LAYOUT SOP (5 HALAMAN)

## 1. Parameter Global SOP
- **Ukuran Kertas**: A4 Portrait (`11906 x 16838 dxa`).
- **Margin Halaman**: Top: `1440 dxa` (1.0 inch), Bottom: `1440 dxa`, Left: `1440 dxa`, Right: `1440 dxa`, Header: `708 dxa`, Footer: `708 dxa`.
- **Lebar Area Cetak**: Tepat **`9016 dxa`** (15.9 cm).
- **Tipografi**:
  - **Headings & Banners**: Font **`Aptos Display`**.
  - **Body Text & Data Tabel**: Font **`Aptos`**.
- **Standar Gaya Bilingual**:
  - **Bahasa Inggris (Utama)**: `10 pt` (`sz="20"`) regular / `9 pt` (`sz="18"`) pada data tabel, warna `#000000`.
  - **Bahasa Indonesia (Terjemahan)**: `9 pt` (`sz="18"`), warna `#595959` (abu-abu korporat), style **Italic**.
  - **Penempatan**: Berada di dalam satu paragraf yang sama dipisahkan Line Break (`<w:br/>`) dengan spasi rapat (`after: 40, line: 240`).
- **Header (Muncul di setiap halaman 1 - 5)**:
  - **Kiri**: Kotak Merah Solid (`#EE0000`), teks putih tebal 14pt:
    - Baris 1: `STANDARD OPERATING PROCEDURE`
    - Baris 2: `NeutraDC – Cikarang`
  - **Kanan**: Dua logo horizontal berdampingan:
    1. Logo **Dwimitra** (belah ketupat biru DME).
    2. Logo **NeutraDC** (titik-titik merah).
- **Footer**: `Page X of 5` terpusat di tengah (*center*).

## 2. Struktur Seksi SOP per Halaman

### HALAMAN 1 (SOP)
1. **Section 1 – Document Overview**:
   - Banner Merah `#EE0000` (`9016 dxa`), judul putih 11pt bold + subjudul ID 10pt bold italic `#E0E0E0`.
   - Field form bilingual titik dua (`:`) sejajar vertikal:
     - `Document Title : -` \n `Judul Dokumen : -`
     - `Document Purpose : Guide to carry Transformer Maintenance` \n `Tujuan Dokumen : Panduan pelaksanaan Pemeliharaan Transformator`
     - `Work Location : Neutra DC Cikarang` \n `Lokasi Kerja : Neutra DC Cikarang`
2. **Section 2 – Equipment Information**:
   - Banner Merah `#EE0000`.
   - Tabel Peralatan 10 Kolom dengan Border Box Penuh (`[480, 771, 907, 1326, 1041, 1198, 642, 1143, 1152, 356]` dxa).
   - Header 10 kolom: `No`, `Class id`, `CI Name*`, `CI Description*`, `Capacity`, `Serial Number`, `MFD`, `Product Name`, `Model`, `Room`.
   - Data trafo 5 baris (TRAFO 1 s/d TRAFO 5).

### HALAMAN 2 (SOP)
3. **Section 3 – Schedule / Work Information**:
   - Banner Merah `#EE0000`.
   - Form 2 kolom berdampingan:
     - Kiri: `SOP Execution Date: -` \n `Tanggal Pelaksanaan SOP: -`
     - Kanan: `Reference Ticket Number: -` \n `Nomor Tiket Referensi: -`
   - Form Eksekutor: `Executed by (Name)` & `Job title` di atas tabel 2 kolom `[4395, 4626]` dxa.
4. **Section 4 – Affected Equipment / Systems**:
   - Banner Merah `#EE0000`.
   - Tabel Checklist Sistem 3 kolom (`[3005, 3227, 2784]` dxa) **tanpa border (borderless)**, memuat 15 sistem dengan tanda centang `✓` / `•`.
   - Instruksi bilingual jika dicentang.
   - Kotak Rincian Border Box penuh (`9016 dxa`) untuk detail penjelasan sistem.
5. **Section 5 – Referenced Documents / Attachments**:
   - Banner Merah `#EE0000`.
   - Header: `Document Name` \n `Nama Dokumen` & `Document Number` \n `Nomor Dokumen`.
   - Tabel 2 kolom (`[6374, 2642]` dxa) ber-border box dengan 5-6 baris kosong.
6. **Section 6 – Environmental, Health & Safety**:
   - Banner Merah `#EE0000`.
   - Label: `Requirements` (underline) \n `Persyaratan`.
   - Kotak Border Box penuh (`9016 dxa`) memuat 4 poin APD/K3L (PPE, jewelry/rings, HT, LOTO).

### HALAMAN 3 (SOP)
7. **Section 7 – Prerequisites**:
   - Banner Merah `#EE0000`.
   - Header: `Requirements` | `Time` | `Initial`.
   - Tabel 3 kolom (`[6091, 1842, 1083]` dxa) ber-border box penuh memuat 5 poin prasyarat (PTW, arrival, tools, ref docs, competency).
8. **Section 8 – Dry Run**:
   - Banner Merah `#EE0000`.
   - Label: `Completed by:` \n `Diselesaikan oleh:`.
   - Header & Tabel 4 kolom (`[2254, 2254, 2254, 2254]` dxa): `Job Title:`, `Name:`, `Signature:`, `Date:`.
9. **Section 9 – Maintenance Period**:
   - Banner Merah `#EE0000`.
   - Tabel 2 kolom ber-border box: `• 6 Months` \n `  6 Bulan` & `• Annual` \n `  Tahunan`.
10. **Section 10 – Work Instruction / Procedures (Langkah 1 s/d 3)**:
    - Banner Merah `#EE0000`.
    - Kotak Kondisi Sebelum Eksekusi.
    - Tabel Prosedur 4 kolom (`[4248, 1843, 1842, 1083]` dxa) ber-border box penuh: `Action`, `Expected Outcome`, `Time`, `Initial`.
    - Berisi Langkah 1 s/d 3.

### HALAMAN 4 (SOP)
- **Lanjutan Section 10 – Work Instruction / Procedures**:
  - Berisi Langkah 4 s/d 12 (Grounding, parameter listrik, suhu, vibrasi, alarm, pemantauan, log sheet, abnormal handling, shutdown).

### HALAMAN 5 (SOP)
11. **Section 11 – Back Out Procedures**:
    - Banner Merah `#EE0000`.
    - Kotak Border Box: `N/A` \n `T/A`.
12. **Section 12 – Document Information**:
    - Banner Merah `#EE0000`.
    - Form 2 kolom berdampingan: `Author`, `Date of Creation`, `Date Revision`, `Revision Number`.
13. **Section 13 – Approval**:
    - Banner Merah `#EE0000`.
    - Tabel 4 baris evaluasi persetujuan:
      - Project Manager (Dwi Tasmiyadi)
      - Chief Engineering (Habib Mulyana)
      - Facility Manager (Supriyatno)
      - Assistant Manager HDC (Budi Susanto)
14. **Section 14 – Additional Information**:
    - Banner Merah `#EE0000`.
    - Kotak besar persegi panjang kosong ber-border untuk catatan lapangan.

---

# BAGIAN 2: SPESIFIKASI LAYOUT EOP (3 HALAMAN)

## 1. Parameter Global EOP
- **Ukuran Kertas**: A4 Portrait (`11906 x 16838 dxa`).
- **Margin Halaman**: Top: `1701 dxa` (1.18 inch), Bottom: `1440 dxa`, Left: `1440 dxa`, Right: `1440 dxa`, Header: `709 dxa`, Footer: `709 dxa`.
- **Lebar Area Cetak**: Tepat **`9016 dxa`** (15.9 cm).
- **Tipografi**:
  - **Headings & Banners**: Font **`Aptos Display`**.
  - **Body Text & Data Tabel**: Font **`Aptos`**.
- **Warna Identitas EOP**: **Magenta Solid / Pink Terang (`#FF00FF`)**.
- **Header (Muncul di setiap halaman 1 - 3)**:
  - **Kiri**: Kotak Magenta Solid (`#FF00FF`), teks putih tebal 14pt:
    - Baris 1: `EMERGENCY OPERATING PROCEDURE`
    - Baris 2: `NeutraDC – Cikarang`
  - **Kanan**: Dua logo horizontal berdampingan: Logo **Dwimitra** & Logo **NeutraDC**.
- **Footer**: `Page X of 3` terpusat di tengah (*center*).

## 2. Struktur Seksi EOP per Halaman

### HALAMAN 1 (EOP - Page 1 of 3)
1. **Section 1 – Document Overview**:
   - Banner Magenta `#FF00FF` (`9016 dxa`), teks putih tebal 11pt di tengah: `Section 1 – Document Overview`.
   - Field form bilingual titik dua (`:`) sejajar:
     - `Document Title : -` \n `Judul Dokumen : -`
     - `Document Purpose : Guide for actions that need to be taken when all operating TRAFO trip or stop due to fault.` \n `Tujuan Dokumen : Panduan tindakan yang perlu diambil saat seluruh TRAFO yang beroperasi trip atau padam karena gangguan.`
     - `Work Location : Neutra DC Cikarang` \n `Lokasi Kerja : Neutra DC Cikarang`
2. **Section 2 – Referenced Document / Attachments**:
   - Banner Magenta `#FF00FF`.
   - Header Kolom (underline): `Document Name` \n `Nama Dokumen` & `Document Number` \n `Nomor Dokumen`.
   - Tabel 2 Kolom (`[6516, 2500]` dxa) ber-border box penuh dengan 5 baris kosong.
3. **Section 3 – Environmental, Health & Safety**:
   - Banner Magenta `#FF00FF` (tertulis `Section 3 – Enviromental, Health & Safety`).
   - Label: `Requirements` (underline) \n `Persyaratan`.
   - Kotak Border Box penuh (`9016 dxa`) memuat 2 poin darurat:
     1. `1. Wear Personal Protective Equipment (PPE)...` \n `1. Gunakan Alat Pelindung Diri (APD)...`
     2. `2. Communication device such as handy-talkie (HT) is on hand.` \n `2. Perangkat komunikasi seperti handy-talkie (HT) tersedia / siap digunakan.`
4. **Section 4 – Work Instruction / Procedure (Langkah 1 s/d 3)**:
   - Banner Magenta `#FF00FF`.
   - Kotak Kondisi:
     `Expected Conditions / Equipment Status:` \n `Kondisi yang Diharapkan / Status Peralatan:` \n `1.` \n `2.`
   - Tabel Prosedur Kerja 5 Kolom (`[455, 4785, 2064, 855, 857]` dxa) ber-border box penuh:
     - Kolom 1: `No` (center)
     - Kolom 2: `Action` \n `Tindakan` (left)
     - Kolom 3: `Expected Outcome` \n `Hasil yang Diharapkan` (left)
     - Kolom 4: `Time` \n `Waktu` (center)
     - Kolom 5: `Name` \n `Nama` (center)
     - Berisi Langkah 1, 2, dan 3.

### HALAMAN 2 (EOP - Page 2 of 3)
- **Lanjutan Section 4 – Work Instruction / Procedure**:
  - Berisi Langkah 4 s/d 10:
    - Langkah 4: Trip and isolate transformer (Trip dan isolasi trafo).
    - Langkah 5: Inspect transformer, panel, cables, cooling (Inspeksi trafo, panel, kabel, pendingin).
    - Langkah 6: Fire/smoke emergency response (Tanggap darurat kebakaran/asap).
    - Langkah 7: Report to supervisor/control room (Laporkan ke pengawas/ruang kontrol).
    - Langkah 8: Record alarm and actions taken (Catat alarm dan tindakan).
    - Langkah 9: Inspection and corrective action (Inspeksi dan tindakan perbaikan).
    - Langkah 10: Re-energize transformer (Beri tegangan kembali setelah otorisasi).
5. **Section 5 – Document Information**:
   - Banner Magenta `#FF00FF`.
   - Form 2 kolom berdampingan:
     - Baris 1: `Author : Alif Darmawan` & `Date of Creation : 7 sep 2026`
     - Baris 2: `Next Date Revision : N / A` & `Revision Number : -`
6. **Section 6 – Dry Run**:
   - Banner Magenta `#FF00FF`.
   - Label: `Completed by:` (underline) \n `Diselesaikan oleh:`.
   - Header & Tabel 4 kolom (`[2254, 2254, 2254, 2254]` dxa): `Job Title:`, `Name:`, `Signature:`, `Date:`.

### HALAMAN 3 (EOP - Page 3 of 3)
7. **Section 7 – Approval**:
   - Banner Magenta `#FF00FF`.
   - Header Kolom (underline): `Job Title` \n `Jabatan`, `Name` \n `Nama`, `Signature` \n `Tanda Tangan`, `Date` \n `Tanggal`.
   - Tabel 4 Baris Evaluasi Persetujuan (`9016 dxa`) ber-border box penuh:
     - Project Manager (Dwi Tasmiyadi)
     - Chief Engineering (Habib Mulyana)
     - Facility Manager (Supriyatno)
     - Assistant Manager HDC (Budi Susanto)
8. **Section 8 – Additional Information**:
   - Banner Magenta `#FF00FF`.
   - Kotak besar persegi panjang kosong ber-border box penuh (`9016 dxa`) setinggi sisa halaman untuk catatan lapangan darurat.

---

## 3. PERBEDAAN UTAMA SOP VS EOP

| Atribut | SOP (Standard Operating Procedure) | EOP (Emergency Operating Procedure) |
| --- | --- | --- |
| **Warna Identitas & Banner** | Merah Solid (`#EE0000`) | Magenta Solid (`#FF00FF`) |
| **Total Halaman** | **5 Halaman** | **3 Halaman** |
| **Total Seksi** | **14 Seksi** | **8 Seksi** |
| **Margin Atas (Top Margin)** | `1440 dxa` (1.0 inch) | `1701 dxa` (1.18 inch) |
| **Kolom Prosedur Kerja** | 4 Kolom (`Action`, `Outcome`, `Time`, `Initial`) | 5 Kolom (`No`, `Action`, `Outcome`, `Time`, `Name`) |
| **Seksi Peralatan (Equipment List)** | Ada (Section 2 - 10 Kolom) | Tidak ada |
| **Seksi Sistem Terdampak** | Ada (Section 4 - Checklist 3 Kolom) | Tidak ada |
| **Seksi Periode Pemeliharaan** | Ada (Section 9 - 6 Bulan / Tahunan) | Tidak ada |
| **Seksi Prosedur Pemulihan** | Ada (Section 11 - Back Out Procedure) | Tidak ada |
| **Poin EHS / K3L** | 4 Poin (PPE, Jewelry, HT, LOTO) | 2 Poin Darurat (PPE, HT) |
| **Penomoran Halaman Footer** | `Page X of 5` | `Page X of 3` |
