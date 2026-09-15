# 🏢 DwimitraSystem

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![Cloudflare Turnstile](https://img.shields.io/badge/Cloudflare-Turnstile_CAPTCHA-F38020?style=flat-square&logo=cloudflare)](https://cloudflare.com/)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-3.1_Flash--Lite-4285F4?style=flat-square&logo=googlegemini)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_&_Storage-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Word DOCX](https://img.shields.io/badge/DOCX-Standardized_Export-2B579A?style=flat-square&logo=microsoft-word)](https://github.com/dolanmiu/docx)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-Dual--Sheet_Export-217346?style=flat-square&logo=microsoft-excel)](https://github.com/exceljs/exceljs)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Gateway_Baileys-25D366?style=flat-square&logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)
[![Security](https://img.shields.io/badge/Security-Firestore_Rules_&_WAF_Shield-brightgreen?style=flat-square&logo=shield)](#-security)

**DwimitraSystem** adalah sistem terintegrasi dokumentasi, otomatisasi analisis AI, pemeliharaan infrastruktur kritikal (*Data Center Critical Infrastructure Facility*), dan pelaporan operasional profesional yang dirancang khusus untuk **PT Dwimitra Ekatama Mandiri** melayani **PT United Transworld Trading (UTT)** di kawasan fasilitas data center **Neutra DC Cikarang**.

> 🔗 **Live Primary Domain**: <https://dwimitrasystem.com/>  
> 🔄 **Fallback / Redirection URL**: <https://report-utt.web.app/> *(Auto-redirect ke custom domain)*

---

## 📑 Table of Contents

- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Key Modules & Features](#-key-modules--features)
  - [🤖 AI-Powered Service Report, Chat Copilot & Voice Agent](#-ai-powered-service-report-chat-copilot--voice-agent)
  - [📑 Comprehensive Monthly Report Generator (Bab 1–8)](#-comprehensive-monthly-report-generator-bab-18)
  - [🔮 Predictive Maintenance (PdM) & NeutraDC 5-Role Approval Sheet](#-predictive-maintenance-pdm--neutradc-5-role-approval-sheet)
  - [📁 Centralized File Management (16 Kategori Folder)](#-centralized-file-management-16-kategori-folder)
  - [🚨 Abnormal Findings Center & QC DME Workflow](#-abnormal-findings-center--qc-dme-workflow)
  - [⚡ Corrective Maintenance (CM) & SLA 180-Minute Tracking](#-corrective-maintenance-cm--sla-180-minute-tracking)
  - [📜 PTW (Permit to Work) Dynamic Management](#-ptw-permit-to-work-dynamic-management)
  - [🦺 HSE, K3 & Attendance Verification with Face Recognition](#-hse-k3--attendance-verification-with-face-recognition)
  - [📋 MOP Workflow, Monitoring & Post Incident Report (PIR)](#-mop-workflow-monitoring--post-incident-report-pir)
  - [📷 Smart Camera & GPS Watermarking](#-smart-camera--gps-watermarking)
  - [📄 Paper Report Digitizer & WhatsApp Gateway](#-paper-report-digitizer--whatsapp-gateway)
  - [✨ Universal UI/UX Enhancements & Modal Scroll Lock](#-universal-uiux-enhancements--modal-scroll-lock)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Getting Started](#-getting-started)
- [Available Scripts](#-available-scripts)
- [Role System (RBAC)](#-role-system-rbac)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🏗 Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Frontend (React 18 + Vite 6 + Tailwind v4)               │
│                                                                                        │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │  Login   │ │ MainApp  │ │ AdminDashboard│ │SiteMgr / DME│ │MonthlyReportGen     │  │
│  │  Page    │ │ Engineer │ │ Control Panel │ │  Dashboard   │ │Bab 1-8 DOCX/Excel   │  │
│  └────┬─────┘ └────┬─────┘ └───────┬───────┘ └──────┬───────┘ └──────────┬──────────┘  │
│       │            │               │                │                    │             │
│  ┌────┴────────────┴───────────────┴────────────────┴────────────────────┴──────────┐  │
│  │  Modul Khusus: FileManagement (16 Folders) | AbnormalFindingsCenter | PdM Modal  │  │
│  │  CM SLA Form | PTWManagement | FaceRecognition Absensi TBM/Induction | MOP & PIR │  │
│  └─────────────────────────────────────┬────────────────────────────────────────────┘  │
│                                        │ Firebase Auth Token (Bearer)                  │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│                                        ▼                                               │
│                 ┌──────────────────────────────┐                                       │
│                 │   Cloudflare Enterprise WAF  │  Geo-Defense, Bot Fight, Direct IP    │
│                 └──────────────┬───────────────┘                                       │
│                                │                                                       │
│                 ┌──────────────▼──────────────┐                                        │
│                 │  Firebase Edge / Hosting     │  SSL Auto-Provisioning & Static CDN   │
│                 └──────────────┬───────────────┘                                       │
│                                │                                                       │
│  ┌─────────────────────────────┼──────────────────────────────────────────────────┐    │
│  │        Go 1.24 Backend (cmd/api/main.go & api/index.go)                        │    │
│  │                                                                                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────────┐  │    │
│  │  │ Middleware   │  │ Routes       │  │             Controllers              │  │    │
│  │  │ Chain        │──│ Dispatch     │──│                                      │  │    │
│  │  │              │  │              │  │ • AI Controller (13 Peralatan + OCR) │  │    │
│  │  │ • RequestID  │  │ • Health     │  │ • Report & Archive Controller        │  │    │
│  │  │ • Logger     │  │ • Auth       │  │ • Maintenance Progress & End-Day     │  │    │
│  │  │ • PanicRecov │  │ • AI Endpts  │  │ • Finding & Abnormal Controller      │  │    │
│  │  │ • SecHeaders │  │ • Progress   │  │ • User, Role & Audit Controller      │  │    │
│  │  │ • CORS       │  │ • Findings   │  │ • Voice Session Controller (WS)      │  │    │
│  │  │ • RateLimiter│  │ • Voice / WA │  │ • WhatsApp Cloud Sender Controller   │  │    │
│  │  │ • Auth (JWT) │  │              │  │                                      │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┬───────────────────┘  │    │
│  │                                                         │                      │    │
│  │                                            ┌────────────▼────────────┐         │    │
│  │                                            │     Services Layer      │         │    │
│  │                                            │ (AI Multi-Key Keypool,  │         │    │
│  │                                            │ Voice, Progress, Auth)  │         │    │
│  │                                            └────────────┬────────────┘         │    │
│  │                                            ┌────────────▼────────────┐         │    │
│  │                                            │   Repositories Layer    │         │    │
│  │                                            └────────────┬────────────┘         │    │
│  └─────────────────────────────────────────────────────────┼──────────────────────┘    │
│                                                            │                           │
├────────────────────────────────────────────────────────────┼───────────────────────────┤
│                                                            ▼                           │
│  ┌───────────────────────────────────┐    ┌─────────────────────────────────────────┐  │
│  │       Google Gemini 3.1 API       │    │          Firebase / Firestore           │  │
│  │ • Gemini 3.1 Flash-Lite (Vision)  │    │ • Cloud Firestore Realtime DB           │  │
│  │ • Multi-Key Round-Robin Key Pool  │    │ • Firebase Cloud Storage (PDF/Photos)   │  │
│  │ • Daily AI Limit Tracker Quota    │    │ • Document-Level Security Rules         │  │
│  └───────────────────────────────────┘    └─────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Frontend

| Technology | Versi | Peran & Implementasi |
| :--- | :--- | :--- |
| **React** | `18.3.1` | Antarmuka pengguna komponen reaktif dengan arsitektur modular |
| **TypeScript** | `6.0+` | Strict static typing, type safety untuk seluruh DTO laporan & formulir |
| **Vite** | `6.3.5` | Modern build tooling, fast HMR, dan bundling performa tinggi |
| **Tailwind CSS** | `v4.1.12` | Utility-first styling via `@tailwindcss/vite` |
| **Motion (`motion/react`)** | `12.23.24` | Micro-interactions, transisi modal, dan animasi UI dinamis |
| **Radix UI Primitives** | `Latest` | Komponen UI aksesibel & modular (`components/ui/`) |
| **Material UI (MUI)** | `7.3.5` | Dukungan komponen tambahan dan ikonografi pelengkap |
| **Lucide React** | `0.487.0` | Ikonografi modern, konsisten di seluruh dashboard & modal |
| **docx** | `9.6.1` | Generator dokumen Microsoft Word (.docx) berstandar format korporat |
| **ExcelJS** | `4.4.0` | Dual-sheet Excel export dengan custom borders, dynamic formulas & colors |
| **jsPDF & AutoTable** | `2.5.2` | Generator dokumen PDF presisi A4 dengan auto-pagination |
| **html2canvas** | `1.4.1` | Screenshot capture elemen visual & preview report |
| **Recharts** | `2.15.2` | Visualisasi grafik tren PTW mingguan dan monitoring SLA |
| **Tesseract.js** | `7.0.0` | Client-side Optical Character Recognition untuk digitasi laporan fisik |
| **Sonner** | `2.0.3` | Toast notification performa tinggi menggantikan notification library legacy |

### Backend

| Technology | Versi | Peran & Implementasi |
| :--- | :--- | :--- |
| **Go (Golang)** | `1.24.0` | Bahasa pemrograman utama API backend dengan konkurensi native |
| **Google Gemini API** | `3.1 Flash-Lite` | AI Vision, Multimodal Analyzer, Reasoning, Chat Copilot & Digitasi |
| **Firebase Admin SDK** | `v4.13.0` | Verifikasi server-side JWT token, integrasi Firestore & Storage |
| **Gorilla WebSocket** | `1.5.3` | Komunikasi full-duplex real-time untuk AI Voice Agent |
| **go-playground/validator** | `v10.30.1` | Validasi payload DTO request masuk |
| **WhiskeySockets Baileys** | `7.0.0-rc14` | Integrasi WhatsApp Gateway untuk notifikasi otomatis lapangan |

### Cloud, Keamanan & Infrastruktur

| Layanan | Konfigurasi | Deskripsi |
| :--- | :--- | :--- |
| **Custom Domain** | `dwimitrasystem.com` | Domain resmi ber-SSL penuh dengan CNAME flattening Cloudflare |
| **Cloudflare CDN & WAF** | Enterprise 4-Layer | Geo-blocking (Indonesia only), Bot Fight, Direct IP & UA Defense |
| **Firebase Hosting** | Global Edge | Penyedia hosting statis frontend dengan header CSP & HSTS ketat |
| **Cloud Firestore** | Multi-Region NoSQL | Database real-time dengan audit rules granular per collection |
| **Firebase Cloud Storage** | Secure Bucket | Penyimpanan aman foto dokumentasi, lampiran PTW & berkas arsip |
| **PWA Cache Strategy** | `vite-plugin-pwa` | NetworkFirst untuk data API & CacheFirst untuk aset statis |

---

## 🚀 Key Modules & Features

### 🤖 AI-Powered Service Report, Chat Copilot & Voice Agent

Asisten kecerdasan buatan tingkat korporat berbasis **Google Gemini 3.1 Flash-Lite** yang terintegrasi langsung ke alur kerja operasional teknisi di lapangan:

- **AI Service Report Generator (13 Akun Maintenance)** — Analisis foto otomatis dan pembentukan checklist service report presisi untuk **13 jenis peralatan kritikal**:
  1. **ATS** (*Automatic Transfer Switch*)
  2. **FCU** (*Fan Coil Unit*)
  3. **CT** (*Cooling Tower*)
  4. **PDU** (*Power Distribution Unit*)
  5. **PJU** (*Penerangan Jalan Umum / Taman*)
  6. **Generator / Genset**
  7. **AC Split Wall**
  8. **Trafo** (*Transformator*)
  9. **Busduct**
  10. **Dock Leveler**
  11. **Door** (*Rolling Door / Fire Door*)
  12. **Capacitor Bank**
  13. **LDB / RDB** (*Lighting & Receptacle Distribution Board*)
- **Standar Remarks AI 2–5 Kata Max** — Algoritma pembentukan catatan AI dibatasi secara ketat 2–5 kata (mis. *"Kondisi bersih & terawat"*, *"Baut kencang normal"*) demi kerapian sel tabel laporan cetak A4 dan Excel.
- **AI Voice Agent Hands-Free** — Navigasi dan pengisian data parameter inspeksi lapangan via perintah suara (*Speech-to-Text & Text-to-Speech*) menggunakan WebSocket Go.
- **Multimodal Visual Analyzer & Chatbot** — Floating widget chat cerdas (`AIChatWidget.tsx`) untuk analisis hotspot thermal, pembacaan nameplate, dan konsultasi SOP pemeliharaan data center.
- **Multi-Key Round-Robin & Quota Tracker** — Backend Go mengelola kumpulan API key Google Gemini secara bergilir (*atomic counter*) dan mencatat kuota harian di Firestore `system_status/ai_limit_tracker`.

---

### 📑 Comprehensive Monthly Report Generator (Bab 1–8)

Modul mutakhir (`MonthlyReportGenerator.tsx` & `generateMonthlyReportDOCX.ts`) untuk menyusun Laporan Pemeliharaan Bulanan resmi berstandar korporat NeutraDC:

- **Executive Summary 9 Paragraf Bilingual** — Ringkasan eksekutif komprehensif 9 paragraf dalam Bahasa Indonesia dan Bahasa Inggris yang mencakup ringkasan eksekutif, ketersediaan daya, stabilitas suhu ruang server, efisiensi energi, respon insiden, hingga kepatuhan K3.
- **Modal Setup Periode & Nama Laporan Dinamis** — Dukungan setup nama laporan kustom, pemilihan arsip sebelumnya (*Archive Picker*), dan mode lanjut edit (*Continue Editing*).
- **Sinkronisasi Peralatan PM Otomatis (Bab 4)** — Pemilihan peralatan PM berkala yang secara otomatis menyinkronkan seluruh tabel hilir:
  - **Tabel Sasaran Pemeliharaan (Maintenance Objectives)**
  - **Tabel Kinerja Tugas (Task Performance)**
  - **Tabel 23 Pengamatan & Temuan (Observation & Finding)** dengan sinkronisasi status otomatis bila ditemukan kondisi *Not Good*.
  - **Tabel Analisis Akar Masalah (Root Cause Analysis - RCA)**
  - **Tabel Perbaikan Kritis (Critical Repairs)**
  - **Tabel Alat Ukur & Perkakas (Tools & Equipment)** dengan integrasi BOQ Master Asset.
- **Kalkulasi Kumulatif Metrik SLA & SLG** — Perhitungan otomatis durasi perbaikan, persentase kepatuhan SLA, dan akumulasi performa pemeliharaan lengkap dengan baris total di bagian bawah tabel.
- **Penyimpanan Langsung & Proteksi Duplikasi** — Tombol simpan persisten melayang (*floating persistent save*) dengan pencegahan duplikasi arsip via `activeArchiveId`.
- **Ekspor Dokumen Word (.docx) Berstandar Resmi** — Penataan tipografi ketat berstandar dokumentasi NeutraDC (Heading 11pt, Teks Luar 10pt, Tabel 9pt, Cell Padding 0.15cm).

---

### 🔮 Predictive Maintenance (PdM) & NeutraDC 5-Role Approval Sheet

Modul pemeliharaan prediktif canggih (`PredictiveReportModal.tsx` & `PeriodicPredictiveModal.tsx`) untuk mendeteksi potensi anomali sebelum terjadi *breakdown*:

- **Lembar Pengesahan Resmi 5 Peran (5-Role Approval Sheet)** — Menyelaraskan lembar persetujuan dengan standar resmi NeutraDC:
  - 5 Standby Engineers terpilih dengan dropdown auto-signature.
  - Reviewer terkunci resmi ke Site Manager (Arif Budiman).
  - Kolom persetujuan TDE, CBRE, dan Manajemen Fasilitas.
- **Action Plan Halaman 2 (Page 2)** — Rencana aksi mitigasi teknis terstruktur yang langsung dicetak di halaman kedua dokumen laporan.
- **Kalkulasi RUL (Remaining Useful Life) & Tingkat Urgensi** — Evaluasi AI terhadap sisa masa pakai komponen dan penetapan level urgensi dalam grid visual 2x2.
- **Ekspor Format Ganda (PDF & DOCX)** — Laporan prediktif dapat langsung diekspor ke format PDF siap tanda tangan atau file Word editable.

---

### 📁 Centralized File Management (16 Kategori Folder)

Sistem repositori berkas terpusat (`FileManagement.tsx`) yang terintegrasi pada top navigation bar:

- **16 Folder Pemeliharaan Standar Industri** — Folder terstruktur mencakup seluruh ruang lingkup kerja: *SOP, MOP, Single Line Diagram (SLD), Preventive Maintenance, Corrective Maintenance, Predictive Maintenance, PTW, HSE/K3, BA, Vendor, Inventory, Audit, Dan Lain-lain*.
- **Otorisasi Berkas Berjenjang** — Hak upload dan kelola berkas eksklusif untuk peran **Admin** dan **QC DME**, dengan hak akses *read-only* yang aman untuk Standby Engineer.
- **Optimasi Cache Pembacaan & Manual Refresh** — Mekanisme caching data cerdas untuk meminimalkan pembacaan Firestore, dilengkapi tombol segarkan manual instan.
- **Pencarian Mode DME & Pengurutan Fleksibel** — Filter pencarian lintas folder dengan sakelar mode pencarian DME dan pengurutan multi-kriteria (berdasarkan tanggal, nama, atau ukuran).
- **Ekspor ZIP Terstruktur Otomatis** — Fitur pengunduhan arsip batch yang secara otomatis mengelompokkan berkas ke dalam subfolder sesuai kategori dan tipe pemeliharaan.

---

### 🚨 Abnormal Findings Center & QC DME Workflow

Pusat kendali temuan anomali (`AbnormalFindingsCenter.tsx`) yang diperuntukkan bagi tim Quality Control & Site Management:

- **Dashboard Khusus QC DME (`qcdme@dme.com`)** — Tampilan monitoring menyeluruh atas seluruh temuan abnormal di seluruh area data center.
- **Rekap Bulanan Temuan Abnormal & Ekspor DOCX** — Penyaringan temuan berdasarkan bulan/tahun dengan ekspor berkas Word berlogo ganda (Dwimitra & UTT), deskripsi temuan, tindakan perbaikan, dan galeri foto bukti.
- **Preservasi Aspek Rasio & Auto-Crop Foto Bukti** — Foto temuan abnormal diproses dengan rasio proporsional dan pemotongan otomatis area teks berlebih agar rapi di laporan.
- **Modal Interaktif "Lihat Temuan" & Badge Folder** — Peninjauan detail temuan secara langsung dari arsip dengan badge jumlah temuan abnormal pada setiap folder pemeliharaan.
- **Pusat Manajemen Pengajuan Hapus (*Delete Requests Manager*)** — Alur pengajuan hapus dokumen yang memerlukan persetujuan berjenjang dari tim QC DME sebelum data dihapus permanen.

---

### ⚡ Corrective Maintenance (CM) & SLA 180-Minute Tracking

Modul pemeliharaan korektif (`CorrectiveMaintenance.tsx` & `SLAForm.tsx`) untuk penanganan insiden dan gangguan:

- **Kategorisasi Sparepart Presisi** — Pemisahan status material menjadi *DME Sparepart*, *Consumable Part*, dan *Non-Sparepart* dengan badge visual persisten.
- **Target Pemulihan SLA 180 Menit** — Standar waktu pemulihan (*Restore Time*) 180 menit dengan pemantauan selisih menit, formula Excel dinamis, dan pewarnaan otomatis (*conditional formatting*).
- **Pengurutan Kronologis Ascending (DD/MM/YYYY HH:mm:ss)** — Format waktu dan tanggal terstandarisasi yang diurutkan dari awal bulan ke akhir bulan untuk kepatuhan audit.
- **Heuristik Pencocokan Token & Banner Aksi SLA** — Penghubungan otomatis antara laporan insiden CM dengan berkas SLA terkait untuk memastikan tidak ada insiden tertunda tanpa tindak lanjut.

---

### 📜 PTW (Permit to Work) Dynamic Management

Pengendalian izin kerja operasional berisiko tinggi (`PTWManagement.tsx`):

- **Filter Rentang Tanggal Fleksibel (Date Range Picker)** — Pemfilteran dinamis berdasarkan tanggal mulai dan tanggal selesai pekerjaan di lapangan.
- **Interval Dinamis Minggu 5 (Week 5)** — Pembagian otomatis mingguan (Minggu 1: Tgl 1-7, Minggu 2: Tgl 8-14, Minggu 3: Tgl 15-21, Minggu 4: Tgl 22-28, dan Minggu 5: Tgl 29 hingga melintasi batas awal bulan berikutnya).
- **Grafik Tren Bersih Tanpa Redundansi** — Optimasi grafik mingguan Recharts, legenda, dan ringkasan badge dengan mengeliminasi status 'Open' yang membingungkan.
- **Validasi Dokumen Ditandatangani TDE** — Kewajiban upload berkas izin kerja bertandatangan sebelum izin dinyatakan aktif.

---

### 🦺 HSE, K3 & Attendance Verification with Face Recognition

Manajemen keselamatan kerja terintegrasi (`HSEReportForm.tsx`, `AbsenTBM.tsx`, `AbsenInduction.tsx`):

- **Absensi Toolbox Meeting (TBM) & Safety Induction** — Pencatatan kehadiran digital kegiatan briefing keselamatan kerja harian dan induksi K3 kontraktor.
- **Pengenalan Wajah (*Face Recognition & Registration*)** — Registrasi biometrik wajah teknisi (`FaceRegistrationManagement.tsx`) untuk verifikasi kehadiran otentik di lokasi proyek.
- **Editor Foto K3 & Pembuat Laporan HSE** — Penandaan visual area bahaya pada foto (*annotation*) dan ekspor dokumen keselamatan kerja resmi.

---

### 📋 MOP Workflow, Monitoring & Post Incident Report (PIR)

- **MOP Workflow & Kanban (`MOPWorkflow.tsx`)** — Manajemen alur kerja *Method of Procedure* (MOP) dengan status pengajuan, review OCS, hingga approval TDE.
- **MOP Monitoring Dashboard (`MOPMonitoringDashboard.tsx`)** — Pemantauan pekerjaan berisiko tinggi yang sedang aktif di gedung data center.
- **PIR (Post Incident Report)** — Formulir investigasi insiden komprehensif (`PIRManagement.tsx`) dengan alur kronologis kejadian, mitigasi, dan ekspor PDF resmi.
- **Generator Berita Acara (BA)** — Pembuatan dokumen Berita Acara serah terima pekerjaan (`BeritaAcaraReport.tsx`) berformat Microsoft Word (.docx).

---

### 📷 Smart Camera & GPS Watermarking

Sistem kamera dokumentasi cerdas (`CameraModal.tsx`):

- **Burn-on-Apply Watermarking** — Penyematan permanen metadata teknis ke kanvas foto:
  - Tanggal & Waktu presisi (*Local Time*)
  - Koordinat GPS (Latitude / Longitude)
  - Reverse Geocoding alamat fisik lokasi data center
  - Watermark resmi branding korporat **NEUTRADC** & **DWIMITRA**.

---

### 📄 Paper Report Digitizer & WhatsApp Gateway

- **AI Paper Report Digitizer (`PaperReportDigitizerModal.tsx`)** — Pengambilan foto dokumen kertas fisik checklist lama yang secara otomatis diekstrak datanya via Optical Character Recognition (Tesseract.js / Gemini Multimodal) menjadi laporan digital.
- **Integrasi WhatsApp Gateway (`WAGatewayModal.tsx`)** — Pengiriman ringkasan laporan pekerjaan, eskalasi insiden, dan notifikasi otomatis ke nomor WhatsApp grup atau manajemen fasilitas via engine Baileys.

---

### ✨ Universal UI/UX Enhancements & Modal Scroll Lock

- **Universal Background Scroll Lock (`modalScrollLock.ts`)** — Penguncian scroll latar belakang otomatis saat modal atau pop-up apa pun dibuka, mencegah pergeseran halaman yang mengganggu dan mengembalikan posisi scroll saat modal ditutup.
- **Tombol Tutup Foto Circular Merah** — Aksesibilitas navigasi visual dengan tombol silang merah di sudut kanan atas preview foto.
- **Floating Save Repositioning** — Penempatan tombol simpan melayang yang adaptif agar tidak bertabrakan dengan floating chat AI widget.

---

## 📁 Project Structure

```text
DwimitraSystem/
├── api/
│   └── index.go                  # Serverless cloud handler (Go runtime)
│
├── backend/
│   ├── cmd/api/
│   │   ├── main.go               # Server entry point
│   │   ├── bootstrap.go          # Dependency injection setup
│   │   ├── server.go             # HTTP server configuration
│   │   ├── graceful.go           # Graceful shutdown handler
│   │   └── flags.go              # CLI flags parser
│   ├── core/
│   │   ├── config/               # Firebase config, logger, env helpers
│   │   ├── controllers/
│   │   │   ├── ai_controller.go          # AI multimodal inspection & paper digitizer
│   │   │   ├── auth_controller.go        # Auth, session, proxy login
│   │   │   ├── report_controller.go      # Reports CRUD
│   │   │   ├── user_controller.go        # Users & RBAC management
│   │   │   ├── archive_controller.go     # Report archives
│   │   │   ├── audit_controller.go       # Audit logging
│   │   │   ├── finding_controller.go     # Findings & abnormal data
│   │   │   ├── health_controller.go      # Liveness, readiness, metrics
│   │   │   ├── maintenance_progress_controller.go # Maintenance progress & end-day
│   │   │   ├── voice_controller.go       # AI Voice WebSocket handler
│   │   │   └── wa_controller.go          # WhatsApp Gateway sender
│   │   ├── middlewares/          # Auth, CORS, rate limiter, security headers
│   │   ├── models/               # Go structs, DTOs & data validation rules
│   │   ├── repositories/         # Firestore database data access layer
│   │   ├── routes/               # API routes dispatching & rate tiers
│   │   └── services/             # Core business logic (AI Keypool, Voice, Reports)
│   ├── pkg/
│   │   ├── helpers/              # JSON response helpers, IP utils
│   │   ├── logger/               # Structured logging (slog)
│   │   └── sanitizer/            # Input sanitization (XSS prevention)
│   └── wagateway.js              # Baileys WhatsApp Gateway runner
│
├── frontend/
│   ├── App.tsx                   # Role-based root router
│   ├── main.tsx                  # React entry point
│   ├── api/firebase.ts           # Firebase Web SDK client configuration
│   ├── components/
│   │   ├── AuthContext.tsx        # Global auth state & user session
│   │   ├── MonthlyReportGenerator.tsx # ★ Bab 1-8 Comprehensive Monthly Report Generator
│   │   ├── BOQMasterAsset.tsx     # BOQ Master Asset management
│   │   ├── FileManagement.tsx     # ★ Centralized 16-Folder File Management
│   │   ├── AbnormalFindingsCenter.tsx # ★ QC DME Abnormal Findings Center
│   │   ├── PredictiveReportModal.tsx # ★ PdM Modal with 5-Role NeutraDC Approval Sheet
│   │   ├── PeriodicPredictiveModal.tsx # Periodic PdM Modal
│   │   ├── CorrectiveMaintenance.tsx # ★ CM Module & Sparepart Categorization
│   │   ├── CMReportFormModal.tsx  # Corrective Maintenance Report Form
│   │   ├── SLAForm.tsx            # SLA calculation & 180m restore time tracking
│   │   ├── SLAMonthlyRecapModal.tsx # Monthly SLA Recap Modal (Ascending Sort)
│   │   ├── PTWManagement.tsx      # ★ Permit to Work with dynamic intervals & dates
│   │   ├── AbsenTBM.tsx           # Toolbox Meeting attendance with Face ID
│   │   ├── AbsenInduction.tsx     # Safety Induction attendance with Face ID
│   │   ├── FaceRegistrationManagement.tsx # Biometric Face Registration
│   │   ├── MOPWorkflow.tsx        # Method of Procedure workflow & approval
│   │   ├── MOPMonitoringDashboard.tsx # Realtime MOP monitoring
│   │   ├── PIRManagement.tsx      # Post Incident Report manager
│   │   ├── PIRReportFormModal.tsx # PIR Form modal
│   │   ├── BeritaAcaraReport.tsx  # Berita Acara report generator
│   │   ├── HSEReportForm.tsx      # HSE (K3) report form
│   │   ├── HSEFindingsArchive.tsx # HSE inspection findings archive
│   │   ├── DeleteRequestsManager.tsx # Review tab for document deletion requests
│   │   ├── PaperReportDigitizerModal.tsx # AI Paper report scanner/digitizer
│   │   ├── WAGatewayModal.tsx     # WhatsApp Gateway configuration modal
│   │   ├── AIChatWidget.tsx       # Floating AI Chat Copilot widget
│   │   ├── AIVoiceAgent.tsx       # Floating AI Voice Agent hands-free UI
│   │   ├── CameraModal.tsx        # Smart camera with GPS & NeutraDC watermarking
│   │   ├── DocumentList.tsx       # General reports archive list & search
│   │   ├── ServiceReportContainer.tsx # 13 Accounts dedicated service reports container
│   │   └── ui/                    # Radix & custom UI primitives
│   ├── pages/
│   │   ├── Login.tsx              # Login page with Cloudflare Turnstile CAPTCHA
│   │   ├── MainApp.tsx            # Default Engineer dashboard
│   │   ├── AdminDashboard.tsx     # System administrator dashboard
│   │   ├── SiteManagerDashboard.tsx # Site Manager & Management overview
│   │   ├── DMEDashboard.tsx       # DME workflow & MOP dashboard
│   │   ├── HSEApp.tsx             # HSE & K3 specialist dashboard
│   │   └── DivisionApp.tsx        # Division-specific dashboards (PMO, CBRE, TDE, Direksi)
│   ├── utils/
│   │   ├── generateMonthlyReportDOCX.ts # Word (.docx) generator for Bab 1-8 Monthly Report
│   │   ├── monthlyReportData.ts   # Data templates & calculation engine for Monthly Report
│   │   ├── monthlyReportAI.ts     # AI prompt pipeline for Monthly Report Executive Summary
│   │   ├── AbnormalRecapWordExport.ts # Word (.docx) generator for Abnormal Findings Recap
│   │   ├── PredictiveReportWordExport.ts # Word (.docx) export for Predictive Maintenance
│   │   ├── PredictiveReportPdfExport.ts # PDF export for Predictive Maintenance
│   │   ├── CMReportPdfExport.ts   # Corrective maintenance PDF export
│   │   ├── generateBeritaAcaraDOCX.ts # Berita Acara Word generator
│   │   ├── modalScrollLock.ts     # Universal background scroll lock utility
│   │   ├── excelExport.ts         # Dual-sheet Excel generator with dynamic formulas
│   │   ├── ptwExport.ts           # PTW PDF & Excel export
│   │   ├── aiAgentPipeline.ts     # Client pipeline to Go backend AI endpoints
│   │   ├── faceRecognitionService.ts # Client face recognition & vector matching
│   │   └── draftStorage.ts        # LocalStorage auto-save draft manager
│   ├── types/                     # Comprehensive TypeScript interfaces & DTOs
│   └── themes/                    # UI color palettes & theme configs
│
├── firebase/
│   ├── firestore.rules            # Firestore security rules with RBAC isolation
│   └── firestore.indexes.json     # Composite query indexes
├── firebase.json                  # Firebase Hosting, headers & rewrite rules
├── vite.config.ts                 # Vite config (path alias `@/` -> `./frontend/`)
└── package.json                   # Dependencies, scripts & build pipelines
```

---

## 📡 API Reference

Base URL: `https://dwimitrasystem.com/api` *(atau `http://localhost:8080/api` saat development)*

### Autentikasi API

Seluruh endpoint API privat (kecuali liveness health check) mewajibkan otentikasi Firebase ID Token:
`Authorization: Bearer <firebase_id_token>`

### Ringkasan Endpoint

#### 1. Pemantauan Sistem & Kesehatan

| Method | Endpoint | Deskripsi | Otorisasi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Liveness check server | Public |
| `GET` | `/api/ready` | Readiness check (Firebase connection) | Public |
| `GET` | `/api/metrics` | Metrik runtime Go & memori | Public |

#### 2. Autentikasi Pengguna

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Login pengguna via Turnstile & Firebase | Global (20 rps) |
| `POST` | `/api/auth/logout` | Mengakhiri sesi pengguna | Global (20 rps) |
| `GET` | `/api/auth/me` | Membaca profil & role pengguna aktif | Global (20 rps) |

#### 3. AI Service Reports (13 Akun Peralatan + Analisis Khusus)

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/ats-report` | Analisis foto inspeksi ATS | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/fcu-report` | Analisis foto inspeksi FCU | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/pju-report` | Analisis foto inspeksi PJU | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/pdu-report` | Analisis foto inspeksi PDU | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/ct-report` | Analisis foto Cooling Tower | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/generator-report` | Analisis foto Generator / Genset | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/trafo-report` | Analisis foto Transformator | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/acsplit-report` | Analisis foto AC Split Wall | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/busduct-report` | Analisis foto Busduct | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/dockleveler-report` | Analisis foto Dock Leveler | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/door-report` | Analisis foto Rolling Door | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/capacitorbank-report` | Analisis foto Capacitor Bank | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/ldbrdb-report` | Analisis foto LDB / RDB Panel | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/digitize-paper-report` | Ekstraksi & digitasi checklist kertas fisik | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/validate-form` | Validasi kepatuhan data formulir inspeksi | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/analyze-card` | Analisis visual satuan foto kartu inspeksi | 🔴 Heavy (5 rps) |
| `POST` | `/api/ai/chat` | Chat Copilot teknis data center | 🔴 Heavy (5 rps) |

#### 4. Voice Agent & WhatsApp Gateway

| Method | Endpoint | Deskripsi | Protokol |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/voice/ws` | Sesi real-time suara hands-free | WebSocket Full-Duplex |
| `POST` | `/api/wa/send` | Pengiriman notifikasi via WhatsApp | HTTP (Heavy - 5 rps) |

#### 5. Dokumen, Arsip & Laporan

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/report` | Pembuatan laporan baru beserta foto | 🔴 Heavy (5 rps) |
| `GET` | `/api/reports` | Mengambil daftar laporan operasional | 🟢 Standard (20 rps) |
| `GET` | `/api/report/:id` | Mengambil detail laporan tunggal | 🟢 Standard (20 rps) |
| `DELETE` | `/api/report/:id` | Menghapus laporan operasional | 🔴 Heavy (5 rps) |
| `GET` | `/api/archive` | Daftar arsip laporan tersimpan | 🟢 Standard (20 rps) |
| `GET` | `/api/archive/:id` | Detail arsip laporan tersimpan | 🟢 Standard (20 rps) |
| `DELETE` | `/api/archive/:id` | Hapus permanen berkas arsip | 🔴 Heavy (5 rps) |

#### 6. Temuan & Anomali (Findings)

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/findings` | Mencatat temuan baru di lapangan | 🔴 Heavy (5 rps) |
| `GET` | `/api/findings` | Mengambil seluruh daftar temuan | 🟢 Standard (20 rps) |
| `DELETE` | `/api/findings/:id` | Menghapus catatan temuan | 🔴 Heavy (5 rps) |

#### 7. Progres Pemeliharaan & Ringkasan Harian

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/maintenance-progress` | Daftar progres pemeliharaan triwulan | 🟢 Standard (20 rps) |
| `POST` | `/api/maintenance-progress` | Membuat entri progres pemeliharaan | 🔴 Heavy (5 rps) |
| `GET` | `/api/maintenance-progress/summary` | Ringkasan akumulasi progres | 🟢 Standard (20 rps) |
| `POST` | `/api/maintenance-progress/end-day` | Laporan ringkasan akhir hari (End of Day) | 🔴 Heavy (5 rps) |
| `PATCH` | `/api/maintenance-progress/:id` | Memperbarui progres pemeliharaan | 🔴 Heavy (5 rps) |
| `DELETE` | `/api/maintenance-progress/:id` | Menghapus progres pemeliharaan | 🔴 Heavy (5 rps) |

#### 8. Manajemen Pengguna & Audit Trail

| Method | Endpoint | Deskripsi | Rate Limit Tier |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | Mengambil seluruh daftar pengguna | 🟢 Standard (20 rps) |
| `GET` | `/api/users/:id` | Mengambil profil pengguna spesifik | 🟢 Standard (20 rps) |
| `PATCH` | `/api/users/:id/role` | Memperbarui hak akses/role pengguna | 🔴 Heavy (5 rps) |
| `DELETE` | `/api/users/:id` | Menonaktifkan akun pengguna | 🔴 Heavy (5 rps) |
| `GET` | `/api/audit` | Seluruh catatan jejak audit aktivitas | 🟢 Standard (20 rps) |
| `GET` | `/api/audit/me` | Jejak audit aktivitas akun saya | 🟢 Standard (20 rps) |

---

## 🔒 Security

### 1. Cloudflare WAF Enterprise Shield 4-Layer

Sistem pertahanan lapis empat yang beroperasi langsung di jaringan edge Cloudflare:

- **Layer 1 — Geolocation Defense (`ip.src.country ne "ID"`)**: Otomatis memberlakukan *Managed Challenge* untuk seluruh permintaan dari luar wilayah Indonesia.
- **Layer 2 — Known Bots & Automated Scrapers (`cf.client.bot`)**: Menangkal bot berbahaya, web scrapers tanpa izin, dan tools penetrasi liar.
- **Layer 3 — Empty User-Agent Filtering (`http.user_agent eq ""`)**: Memblokir permintaan otomatis tanpa User-Agent resmi.
- **Layer 4 — Direct IP & Host Header Defense (`http.host ne "dwimitrasystem.com" and http.host ne "www.dwimitrasystem.com"`)**: Menggagalkan serangan penembakan IP server langsung (*Direct IP Scraping*) dan *Host Header Spoofing*.

### 2. Cloudflare Turnstile CAPTCHA

Perlindungan bot cerdas tanpa puzzle yang terpasang pada halaman otentikasi login dan divalidasi langsung di backend Go (`turnstile_service.go`).

### 3. Firestore Security Rules Granular

- **Strict User Authentication**: Akses baca/tulis ditolak total tanpa Firebase ID Token yang valid.
- **Collection-Level Isolation**: Isolasi hak akses terpisah untuk `reports`, `archive`, `hse_reports`, `ptw`, `findings`, dan `maintenance_progress`.
- **System Tracker Protection**: Koleksi `system_status/ai_limit_tracker` diproteksi ketat hanya untuk backend terverifikasi.

### 4. Middleware Pipeline Backend Go

Setiap request yang masuk melalui alur middleware terpadu:

```text
Request → RequestID → Logger (slog) → PanicRecovery → SecurityHeaders → CORS Whitelist → RateLimiter → Auth (JWT) → Route Handler
```

---

## 🚀 Getting Started

### Kebutuhan Awal (Prerequisites)

- **Node.js** v20+ atau v24+
- **Go** v1.24+
- **Firebase CLI** (`npm install -g firebase-tools`)
- **npm** atau **pnpm**

### Instalasi & Setup

```bash
# 1. Clone repositori
git clone https://github.com/gariiriana/utt-report-maintenance.git
cd utt-report-maintenance

# 2. Pasang seluruh dependensi frontend
npm install

# 3. Kompilasi binary backend Go
npm run backend:build
```

### Konfigurasi Environment Variables

Buat file `.env.development` (atau `.env.production`) pada direktori akar proyek:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
VITE_API_URL=http://localhost:8080/api
```

Buat file `.env` pada direktori akar / direktori `backend/`:

```env
PORT=8080
APP_ENV=development
BACKEND_API_SECRET=your_backend_secret
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Konfigurasi Google Gemini AI (menggunakan naming NVIDIA_NIM_* demi backward compatibility)
NVIDIA_NIM_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2
NVIDIA_NIM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
NVIDIA_NIM_VISION_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_REASONING_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_CHAT_MODEL=models/gemini-3.1-flash-lite
```

---

## 📂 Available Scripts

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Frontend (Vite:5173) & Backend (Go:8080) secara bersamaan |
| `npm run build` | Build frontend untuk produksi |
| `npm run build:prod` | Build frontend menggunakan environment mode produksi |
| `npm run build:dev` | Build frontend menggunakan environment mode development |
| `npm run backend` | Menjalankan binary server backend Go saja |
| `npm run backend:build` | Mengompilasi source code Go ke file eksekusi `server.exe` |
| `npm run wagateway` | Menjalankan background service WhatsApp Gateway Baileys |

---

## 🔑 Role System (RBAC)

DwimitraSystem menerapkan kontrol akses berbasis peran (*Role-Based Access Control*) yang mencakup 16+ peran operasional:

| Role | Tingkat Akses | Deskripsi & Ruang Lingkup |
| :--- | :--- | :--- |
| `admin` | 🔴 Full System | Akses tak terbatas, user management, audit logs, file upload, & konfigurasi |
| `qcdme@dme.com` | 🔴 Full Quality | QC DME Dashboard, Abnormal Findings Center, review delete requests, upload berkas |
| `site_manager` | 🟠 High / Approval | Monitoring pemeliharaan menyeluruh, persetujuan MOP/PTW, pengesahan laporan |
| `site_manager_dme` | 🟠 High / Approval | DME Dashboard, MOP Kanban, OCS & TDE Approval, chunk upload monitoring |
| `manager` | 🟠 High | Pemantauan progres pemeliharaan data center & ringkasan operasional |
| `engineer` | 🟢 Standard Operasional | Pembuatan laporan service report, unggah foto, temuan lapangan, smart camera |
| `standby_engineer` | 🟢 Standard Lapangan | Pembuatan laporan cepat di lapangan & akses read-only pada Management File |
| `hse` | 🟡 Modul K3 | Modul HSE, absensi K3 (TBM & Induction), foto editor inspeksi keselamatan |
| `tde` | 🟡 Divisi Teknis | Akses persetujuan divisi Technical Data Center Engineer (TDE) |
| `cbre` | 🟡 Divisi Fasilitas | Tampilan pemantauan operasional divisi CBRE |
| `pmo` | 🟡 Divisi Proyek | Akses pelacakan milestone dan progres pemeliharaan proyek data center |
| `sales` | 🟡 Komersial | Akses khusus pelaporan komersial |
| `presales` | 🟡 Teknis Komersial | Tinjauan kapasitas dan infrastruktur untuk pra-penjualan |
| `purchasing` | 🟡 Pengadaan | Pelacakan kebutuhan sparepart dan material pemeliharaan |
| `dirut` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direktur Utama |
| `direksiSDM` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direksi SDM |
| `DireksiKeuangan` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direksi Keuangan |

---

## 🌐 Deployment

### Firebase Hosting & Functions

Frontend didistribusikan melalui Firebase Hosting dengan domain resmi:

```bash
# Build frontend produksi
npm run build:prod

# Deploy ke Firebase Hosting
firebase deploy --only hosting

# Deploy pembaruan aturan Firestore Security Rules
firebase deploy --only firestore:rules
```

---

## 📄 License

Sistem ini bersifat **privat dan rahasia**, dikembangkan secara eksklusif untuk kebutuhan operasional **PT Dwimitra Ekatama Mandiri** dalam melayani fasilitas data center **PT United Transworld Trading (UTT)** di kawasan **Neutra DC Cikarang**. Seluruh kode sumber, arsitektur, dan dokumentasi ini merupakan properti intelektual yang dilindungi undang-undang.

---

*Built with passion & precision by [Gari Iriana](https://github.com/gariiriana)*
