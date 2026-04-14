# 🚀 UTT Report Maintenance

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Cloud-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)

**UTT Report Maintenance** adalah aplikasi sistem dokumentasi profesional yang dirancang khusus untuk memfasilitasi pelaporan pemeliharaan (maintenance) infrastruktur kritis, khususnya data center, bagi PT United Transworld Trading.

---

## 🏗️ Core Stack

Aplikasi ini dibangun menggunakan arsitektur modern yang memisahkan antara frontend yang interaktif dan backend yang skalabel.

### **Frontend**
- **⚛️ React 18 & TypeScript**: Menjamin antarmuka yang responsif dengan *type-safety* yang ketat.
- **⚡ Vite**: Generasi terbaru build tool untuk performa pengembangan yang super cepat.
- **🎨 Tailwind CSS v4**: Framework styling utility-first untuk desain yang bersih dan modern.
- **✨ Framer Motion**: Memberikan pengalaman pengguna yang emosional melalui animasi yang halus.
- **🧩 Radix UI / Shadcn**: Komponen UI yang aksesibel dan mudah dikustomisasi.

### **Backend & Cloud**
- **🐹 Go (Golang)**: Digunakan untuk pengolahan data intensif dan manajemen API backend.
- **🔥 Firebase Ecosystem**: 
  - **Authentication**: Manajemen user yang aman dan teruji.
  - **Firestore**: Database NoSQL real-time untuk penyimpanan arsip laporan.
  - **Security Rules**: Memastikan integritas dan keamanan data di level database.

### **Reporting Engines**
- **📊 ExcelJS**: Engine generasi file Excel (.xlsx) dengan layout grid yang presisi.
- **📄 jsPDF & AutoTable**: Transformasi laporan dari web langsung ke format PDF (A4) siap cetak.

---

## ✨ Fitur Unggulan

### 🔐 Keamanan & Akses
- **Role-Based Access Control (RBAC)**: Diferensiasi akses antara Engineer dan Administrator.
- **Secure Authentication**: Sistem login terpadu menggunakan Firebase Auth.
- **Row-Level Security**: User hanya dapat memanipulasi data miliknya sendiri.

### 📝 Manajemen Laporan (Report Management)
- **Fluid Photo Upload**: Mendukung drag-and-drop dan preview instan.
- **Dynamic Metadata**: Pengisian detail maintenance yang fleksibel sesuai unit/ruangan.
- **Instant Export**: Konversi laporan ke format Excel dan PDF secara simultan.

### 📄 Dokumentasi Profesional
- **Standardized Layout**: Output laporan dengan header resmi, logo Dwimitra & NeutraDC.
- **Auto-pagination**: Pengaturan halaman otomatis (9 foto per halaman) untuk tampilan yang rapi.
- **Base64 Cloud Storage**: Foto disimpan dengan efisiensi tinggi di Firestore.

### 📊 Admin Dashboard
- **Comprehensive Analytics**: Statistik total dokumen, user aktif, dan distribusi tipe file.
- **Master Archive**: Kemampuan bagi Admin untuk memonitor dan mengunduh laporan dari seluruh Engineer.

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
1. **Login**: Autentikasi menggunakan kredensial terdaftar.
2. **Input Data**: Isi informasi maintenance dan unggah foto dokumentasi.
3. **Capture**: Masukkan deskripsi untuk setiap foto guna memberikan konteks teknis.
4. **Export**: Pilih format output (Excel/PDF). File akan terunduh dan tersimpan di sistem arsip.
5. **Archive**: Akses laporan lama kapan saja melalui tab Document Archive.

---

## 📄 Lisensi
Sistem ini bersifat privat dan dikembangkan eksklusif untuk kebutuhan operasional **PT United Transworld Trading**.

---
*Built with ❤️ by [Gari Iriana](https://github.com/gariiriana)*
