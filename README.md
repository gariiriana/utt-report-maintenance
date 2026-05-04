# 🚀 UTT Report Maintenance

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Cloud-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)

**UTT Report Maintenance** adalah sistem dokumentasi infrastruktur kritikal profesional yang dirancang khusus untuk memfasilitasi pelaporan pemeliharaan data center bagi PT United Transworld Trading.

---

## 🏗️ Core Stack

Aplikasi ini mengadopsi arsitektur decoupled yang modern, menggabungkan interaktivitas tinggi di sisi klien dengan performa backend yang tangguh.

### **Frontend**

- **⚛️ React 18 & TypeScript**: Antarmuka reaktif dengan *type-safety* kelas industri.
- **⚡ Vite**: Build tool generasi terbaru untuk siklus pengembangan yang instan.
- **🎨 Tailwind CSS v4**: Paradigma utility-first untuk desain UI yang presisi dan adaptif.
- **✨ Framer Motion**: Integrasi micro-animations untuk pengalaman pengguna yang premium.
- **🧩 Radix UI**: Fondasi komponen yang aksesibel dan berperforma tinggi.

### **Backend & Cloud**

- **🐹 Go (Golang)**: Engine backend berperforma tinggi untuk manajemen data intensif.
- **🔥 Firebase Ecosystem**:
  - **Authentication**: Protokol keamanan user tingkat lanjut.
  - **Firestore**: Database NoSQL real-time untuk sinkronisasi arsip laporan.
  - **Security Rules**: Validasi integritas data pada level database.

---

## ✨ Fitur Unggulan

### 📸 Smart Camera & Watermarking

Sistem pengambilan foto dokumentasi pintar yang menyematkan metadata teknis secara presisi langsung ke dalam citra:

- **Real-time GPS Integration**: Menyematkan koordinat Latitude/Longitude secara akurat.
- **Dynamic Address Lookup**: Konversi koordinat menjadi alamat lokasi fisik secara otomatis.
- **"Burn-on-Apply" Technology**: Sinkronisasi sempurna antara tampilan preview di perangkat dengan hasil akhir foto yang dihasilkan.
- **Professional Branding**: Watermark eksklusif NEUTRADC dengan gradien khusus untuk keterbacaan tinggi.

### ⚡ Optimasi Performa

Dirancang untuk menangani beban kerja operasional yang tinggi dengan efisiensi maksimal:

- **Frontend Debouncing**: Optimasi request API geolokasi untuk mengurangi latensi dan penggunaan bandwidth.
- **Tiered API Throttling**: Sistem *rate-limiting* berlapis (Heavy/Standard/Global) di sisi backend untuk menjaga integritas server dari beban berlebih.
- **AbortController Integration**: Manajemen siklus hidup request untuk memastikan konsistensi data selama pencarian lokasi.

### 📝 Manajemen Laporan (Report Management)

- **Fluid Photo Upload**: Alur kerja dokumentasi yang intuitif dengan preview instan.
- **Professional Export**: Konversi laporan ke format Excel (.xlsx) dan PDF (A4) siap cetak secara simultan.
- **Auto-pagination**: Pengaturan tata letak otomatis yang rapi (9 foto per halaman) untuk laporan PDF.

### 🔍 Manajemen Temuan & Arsip (Findings Management)

Modul terintegrasi untuk mendokumentasikan temuan kerusakan/trouble secara detail dengan alur kerja yang terorganisir:

- **Dual-Module Architecture**: Pemisahan modul antara **Input Temuan** (data entry fokus) dan **Arsip Temuan** (manajemen history).
- **Premium Input Interface**: Form input yang didesain secara luas dan modern untuk kemudahan pengisian detail part, brand, dan quantity.
- **Advanced Archival System**: Sistem pencarian dan filter arsip berdasarkan **Bulan** dan **Tahun** untuk manajemen laporan periodik.
- **Multi-Format Export findings**: Kemampuan untuk mengekspor kumpulan temuan hasil filter ke format **PDF** dan **Microsoft Word (.docx)** secara instan.
- **Interactive Photo Gallery**: Visualisasi temuan dengan gallery foto yang mendukung fitur *cropping* dan pengeditan deskripsi foto.

---

## 🚀 Panduan Instalasi

### Prasyarat

- Node.js (v18+)
- Go (v1.24+)
- pnpm / npm

### Instalasi Dependencies

```bash
# Clone repository
git clone https://github.com/gariiriana/utt-report-maintenance.git

# Install frontend dependencies
npm install

# Build backend
npm run backend:build
```

### Menjalankan Development Server

```bash
npm run dev
```

---

## 📱 Workflow Penggunaan

1. **Authentication**: Login menggunakan kredensial resmi.
2. **Metadata Input**: Isi detail unit/maintenance melalui form dinamis.
3. **Smart documentation**: Ambil foto menggunakan modul kamera terintegrasi yang otomatis menyertakan watermark teknis.
4. **Data Validation**: Review ringkasan laporan dan dokumentasi foto.
5. **Multi-format Export**: Unduh hasil laporan dalam format Excel atau PDF secara instan.

---

## 📄 Lisensi

Sistem ini bersifat privat dan dikembangkan eksklusif untuk kebutuhan operasional **PT United Transworld Trading (UTT)**. Dokumen dan source code ini merupakan properti perusahaan yang dilindungi.

---
*Built with ❤️ by [Gari Iriana](https://github.com/gariiriana)*
