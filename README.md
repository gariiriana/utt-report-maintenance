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
[![JSZip](https://img.shields.io/badge/JSZip-Batch_Archive-FF9800?style=flat-square&logo=zip)](https://stuk.github.io/jszip/)
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
  - [📋 Manajemen SOP & EOP (Standard & Emergency Operating Procedures)](#-manajemen-sop--eop-standard--emergency-operating-procedures)
  - [🚨 Abnormal Findings Center (Checklist PM & Manual Field Input)](#-abnormal-findings-center-checklist-pm--manual-field-input)
  - [⚡ Corrective Maintenance (CM) & SLA 180-Minute Tracking](#-corrective-maintenance-cm--sla-180-minute-tracking)
  - [🔮 Predictive Maintenance (PdM) & NeutraDC 5-Role Approval Sheet](#-predictive-maintenance-pdm--neutradc-5-role-approval-sheet)
  - [📁 Centralized File Management (16 Kategori Folder)](#-centralized-file-management-16-kategori-folder)
  - [📜 PTW (Permit to Work) Dynamic Management](#-ptw-permit-to-work-dynamic-management)
  - [🦺 HSE, K3, Multi-Foto Attendance & ZIP Archive Export](#-hse-k3-multi-foto-attendance--zip-archive-export)
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
│  │ Modul: SOPEOPManagement (14/8 Seksi) | AbnormalFindingsCenter (PM & Manual)      │  │
│  │ FileManagement (16 Folders) | PdM 5-Role Modal | CM SLA 180m | HSE Archive & ZIP │  │
│  │ PTW Management | Face ID Absensi TBM/Induction | MOP Workflow & PIR Manager      │  │
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
│                 └──────────────┬───────────────┘                                        │
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
│  │  └─────────────────────────────────────────────────────────┼──────────────────────┘    │
│  │                                                            │                           │
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
| **JSZip** | `3.10.1` | Ekspor arsip batch multi-file (ZIP) dokumen HSE & repositori berkas |
| **heic2any** | `0.0.4` | Konversi otomatis format foto Apple HEIC ke JPEG di sisi browser |
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

### 📋 Manajemen SOP & EOP (Standard & Emergency Operating Procedures)

Pusat pengelolaan dan penyusunan prosedur operasional berstandar data center tingkat tinggi (`SOPEOPManagement.tsx`):

- **Struktur Standar 14 Seksi SOP & 8 Seksi EOP**:
  - **14 Seksi SOP Lengkap**: Mulai dari Tujuan, Ruang Lingkup, Standar APD/EHS, Dokumen Referensi, Daftar Alat Ukur & Kebutuhan Material, Kualifikasi Personil, Matriks Tanggung Jawab, Persyaratan Awal (*Pre-requisites*), Langkah Prosedur Eksekusi Step-by-Step, Verifikasi & Pengujian Hasil, *Housekeeping & Handover*, hingga Lembar Pengesahan Multi-Pihak.
  - **8 Seksi EOP Tanggap Darurat**: Protokol Reaksi Cepat Kegagalan Sistem (*Power Outage, Chiller Failure, Fire Alarm, Gas Suppression*), Rantai Eskalasi Darurat, Isolasi Sistem Kritis, Tindakan Mitigasi Darurat (*Bypass / Failover*), Pemulihan Normal (*System Normalization*), dan Kontak Darurat Tim Respon Cepat.
- **Bilingual AI Engine (Google Gemini)**:
  - Fitur penerjemahan dwibahasa otomatis (*Indonesian & English*) untuk setiap klausul dan langkah operasional via `sopEopBilingualAI.ts`.
  - Pembuatan draf prosedur otomatis berbasis prompt cerdas yang disesuaikan dengan terminologi baku *critical infrastructure data center*.
- **Parser & Importer Dokumen Word (.docx)**:
  - Kemampuan import dokumen Word SOP/EOP yang sudah ada ke dalam formulir digital (`sopEopDocxImport.ts`).
  - Secara cerdas mengenali tabel sekuens pengujian (*Dry Run sequence, Transformer Interlock, Generator Auto-Start*), blok EHS, dan identitas dokumen.
- **Ekspor Dokumen Korporat Berstandar NeutraDC**:
  - Generator Word (.docx) berkecepatan tinggi (`sopEopDocxExport.ts`) dengan border tabel terstandarisasi, margin korporat, dan proteksi *keep-next pagination rules* agar baris tabel atau tanda tangan tidak terpotong ke halaman berikutnya.
  - Ekspor PDF identik dengan tata letak visual elegan siap cetak.
- **Penyimpanan Terpusat & Riwayat Versi**:
  - Tersimpan aman di Firestore (`sop_documents` & `eop_documents`) dengan riwayat revisi, status pengajuan (*Draft, Under Review, Approved*), dan pelacakan persetujuan bertingkat.

---

### 🚨 Abnormal Findings Center (Checklist PM & Manual Field Input)

Pusat kendali temuan anomali komprehensif (`AbnormalFindingsCenter.tsx` & `FindingManagement.tsx`) yang menggabungkan temuan berkala dan temuan mendadak di lapangan:

- **Pemisahan Tab: Temuan Otomatis PM vs Temuan Abnormal Manual**:
  - **Temuan Otomatis (Checklist PM)**: Agregasi otomatis seluruh catatan inspeksi berkala yang berstatus *Not Good / Abnormal*.
  - **Temuan Abnormal Manual (`ManualAbnormalFinding.tsx`)**: Form input instan bagi teknisi/engineer untuk mendokumentasikan anomali perangkat kapan saja tanpa perlu menunggu jadwal PM rutin.
- **Preset Otomatis Akun Khusus (PJU & Water Softener)**:
  - Sistem secara cerdas mendeteksi akun login khusus (seperti `pju@gmail.com` dan unit water softener) dan langsung mengisi template anomali, deskripsi standar, dan rekomendasi awal secara otomatis.
- **Toolbar Filter Mutakhir & Month Range Picker**:
  - Filter rentang bulan (*Month Range Picker*) yang intuitif untuk evaluasi tren anomali triwulanan atau tahunan.
  - Filter unit/lokasi perangkat dan filter status penyelesaian (*Open, In Progress, Closed*).
- **Pengurutan Realtime Berbasis Upload**:
  - Daftar temuan diurutkan secara stabil berdasarkan waktu upload terbaru tanpa menyebabkan loncatan posisi kartu saat statusnya diperbarui.
- **Format Tanggal Rapi & Anti-Clipping**:
  - Penyajian timestamp yang bersih dan ringkas (bulan & tahun) dengan perlindungan *text-clipping* pada layout kartu responsive.
- **Dukungan Multi-Foto & Single Download**:
  - Dokumentasi sebelum dan sesudah perbaikan (*Before & After*). Akun admin memiliki akses tombol unduh satuan untuk setiap foto bukti.
- **Ekspor Rekap Word & Excel Bersih**:
  - Generator rekap bulanan (`AbnormalRecapWordExport.ts` & Excel) menghasilkan tabel ringkas, bersih, tanpa duplikasi tanda tangan yang membingungkan.
- **Dashboard QC DME & Pengajuan Hapus**:
  - Area khusus tim QC DME (`qcdme@dme.com`) untuk review temuan abnormal lintas fasilitas dan alur persetujuan pengajuan hapus dokumen (*Delete Requests Manager*).

---

### ⚡ Corrective Maintenance (CM) & SLA 180-Minute Tracking

Modul pemeliharaan korektif (`CorrectiveMaintenance.tsx`, `SLAForm.tsx` & `CMMonthlyRecapModal.tsx`) untuk merespon dan menyelesaikan insiden kegagalan perangkat:

- **Pemisahan Sumber Form SLA (CM vs PIR)**:
  - Logika pemisahan tegas antara tiket insiden fasilitas (PIR) dan perbaikan korektif perangkat (CM).
  - Pada formulir SLA tipe CM, input tiket disembunyikan/disederhanakan untuk memusatkan evaluasi pada waktu pemulihan perangkat (*Restore Time*).
- **Field Resolution Time vs Restore Time (Step 4)**:
  - Pemisahan input waktu investigasi tuntas (*Resolution Time*) dari waktu pemulihan operasional (*Restore Time* - target 180 menit) guna memastikan metrik MTTR (*Mean Time to Resolution*) tercatat akurat.
- **Kategorisasi Sparepart Presisi**:
  - Pengelompokan status material menjadi *DME Sparepart*, *Consumable Part*, dan *Non-Sparepart* dengan badge visual persisten.
- **Rekap CM Multi-Bulan & Layout Kompak (`CMMonthlyRecapExport.ts`)**:
  - Tabel rekap multi-bulan diperlebar untuk keterbacaan data maksimal.
  - Pemisahan kolom jenis CM dan status perbaikan.
  - Penataan foto before-after yang hemat halaman saat dicetak ke format Word (.docx) atau diekspor ke Excel.
- **Cascade Delete Konsistensi Database**:
  - Penghapusan data SLA/SLG secara otomatis membersihkan entri relasi CM untuk mencegah *orphan records* dan menjaga kebersihan database Firestore.
- **Pengurutan Kronologis Ascending (DD/MM/YYYY HH:mm:ss)**:
  - Urutan waktu standar dari awal bulan ke akhir bulan untuk kelancaran proses audit operasional.

---

### 🔮 Predictive Maintenance (PdM) & NeutraDC 5-Role Approval Sheet

Modul pemeliharaan prediktif mutakhir (`PredictiveReportModal.tsx` & `PeriodicPredictiveModal.tsx`) untuk mencegah kegagalan fatal melalui analisis anomali berbasis bukti:

- **AI Predictive Agent Evidence-Grounded (`aiPredictiveAgent.ts`)**:
  - Evaluasi analitis AI diperketat hanya berdasarkan bukti nyata (*grounded evidence*) dari data anomali historis dan parameter operasional terukur, mengeliminasi halusinasi AI.
- **Lembar Pengesahan Resmi 5 Peran (5-Role Approval Sheet)**:
  - 5 Standby Engineers terpilih dengan dropdown auto-signature terintegrasi.
  - Reviewer terkunci resmi ke Site Manager (Arif Budiman).
  - Kolom persetujuan berjenjang: TDE, CBRE, dan Manajemen Fasilitas.
- **Pembersihan Antarmuka**:
  - Penghapusan selector status kesehatan manual dan label SLA yang tidak relevan demi fokus pada rencana tindakan teknis.
- **Kop Surat Multi-Halaman & Proteksi Lembar Pengesahan**:
  - Penataan kop surat resmi di setiap halaman (termasuk halaman 2 dst) dan pencegahan pemotongan tanda tangan saat diekspor ke Word (`PredictiveReportWordExport.ts`) atau PDF (`PredictiveReportPdfExport.ts`).
- **Kalkulasi RUL (Remaining Useful Life) & Matriks Urgensi**:
  - Estimasi sisa masa pakai komponen dan penetapan prioritas penanganan dalam grid visual 2x2.

---

### 📁 Centralized File Management (16 Kategori Folder)

Sistem repositori berkas terpusat (`FileManagement.tsx`) yang terintegrasi pada top navigation bar:

- **16 Folder Pemeliharaan Standar Industri** — Folder terstruktur mencakup seluruh ruang lingkup kerja: *SOP, MOP, Single Line Diagram (SLD), Preventive Maintenance, Corrective Maintenance, Predictive Maintenance, PTW, HSE/K3, BA, Vendor, Inventory, Audit, Dan Lain-lain*.
- **Otorisasi Berkas Berjenjang** — Hak upload dan kelola berkas eksklusif untuk peran **Admin** dan **QC DME**, dengan hak akses *read-only* yang aman untuk Standby Engineer.
- **Optimasi Cache Pembacaan & Manual Refresh** — Mekanisme caching data cerdas untuk meminimalkan pembacaan Firestore, dilengkapi tombol segarkan manual instan.
- **Pencarian Mode DME & Pengurutan Fleksibel** — Filter pencarian lintas folder dengan sakelar mode pencarian DME dan pengurutan multi-kriteria (berdasarkan tanggal, nama, atau ukuran).
- **Ekspor ZIP Terstruktur Otomatis** — Fitur pengunduhan arsip batch yang secara otomatis mengelompokkan berkas ke dalam subfolder sesuai kategori dan tipe pemeliharaan via JSZip.

---

### 📜 PTW (Permit to Work) Dynamic Management

Pengendalian izin kerja operasional berisiko tinggi (`PTWManagement.tsx`):

- **Filter Rentang Tanggal Fleksibel (Date Range Picker)** — Pemfilteran dinamis berdasarkan tanggal mulai dan tanggal selesai pekerjaan di lapangan.
- **Interval Dinamis Minggu 5 (Week 5)** — Pembagian otomatis mingguan (Minggu 1: Tgl 1-7, Minggu 2: Tgl 8-14, Minggu 3: Tgl 15-21, Minggu 4: Tgl 22-28, dan Minggu 5: Tgl 29 hingga melintasi batas awal bulan berikutnya).
- **Grafik Tren Bersih Tanpa Redundansi** — Optimasi grafik mingguan Recharts, legenda, dan ringkasan badge dengan mengeliminasi status 'Open' yang membingungkan.
- **Validasi Dokumen Ditandatangani TDE** — Kewajiban upload berkas izin kerja bertandatangan sebelum izin dinyatakan aktif.

---

### 🦺 HSE, K3, Multi-Foto Attendance & ZIP Archive Export

Manajemen keselamatan kerja terpadu (`HSEReportForm.tsx`, `AbsenTBM.tsx`, `AbsenInduction.tsx`, dan `HSEArchiveHub.tsx`):

- **Absensi TBM & Safety Induction Multi-Foto**:
  - Pencatatan kehadiran digital kegiatan briefing keselamatan kerja harian (Toolbox Meeting) dan induksi K3 kontraktor.
  - Setiap slot absensi kini mendukung **multi-foto dokumentasi** per peserta untuk validasi visual yang lebih kuat.
- **Proteksi Limit Ukuran Firestore (1MB limit)**:
  - Kompresi foto otomatis di sisi klien (`imageCompression.ts`) sebelum data disimpan, menjaga ukuran payload tetap aman di bawah batas 1MB per dokumen Firestore.
- **Hub Arsip Dokumen HSE Terpusat (`HSEArchiveHub.tsx`)**:
  - Akses terintegrasi langsung di navbar Admin & Site Manager dengan hak akses baca-saja dan fitur unduhan foto bukti satuan.
- **Fitur Ekspor ZIP Arsip Dokumen HSE**:
  - Pengunduhan massal sekali klik seluruh dokumen HSE dan seluruh lampiran foto dokumentasi ke dalam 1 file ZIP terkompresi menggunakan JSZip.
- **Generator PDF Khusus K3**:
  - Berita Acara TBM (`HSETbmPdfExport.ts`).
  - Formulir Safety Induction (`HSESafetyInductionPdfExport.ts`).
  - Rekap Inspeksi HSE (`HSEInspectionRecapPdfExport.ts`).
  - Formulir Temuan HSE (`HSEFindingPdfExport.ts`).
- **Pengenalan Wajah (*Face Recognition & Registration*)**:
  - Registrasi biometrik wajah teknisi (`FaceRegistrationManagement.tsx`) untuk verifikasi kehadiran otentik di lokasi proyek.

---

### 📋 MOP Workflow, Monitoring & Post Incident Report (PIR)

- **Standarisasi Dokumen PIR Korporat (`PIRManagement.tsx` & `PIRReportPdfExport.ts`)**:
  - Matriks tanda tangan 3-kolom simetris (Dwi Tasmiyadi, Chief Engineer Habib Mulyana, Standby Engineer dropdown) dengan *page-break protection* (tidak terpotong ke halaman baru).
  - Tipografi korporat Century Gothic 10pt sesuai standar resmi fasilitas data center.
  - Grid foto dokumentasi terkompresi tanpa celah kosong dengan tabel tindakan korektif.
- **MOP Workflow & Kanban (`MOPWorkflow.tsx`)** — Manajemen alur kerja *Method of Procedure* (MOP) dengan status pengajuan, review OCS, hingga approval TDE.
- **MOP Monitoring Dashboard (`MOPMonitoringDashboard.tsx`)** — Pemantauan pekerjaan berisiko tinggi yang sedang aktif di gedung data center.
- **Generator Berita Acara (BA)** — Pembuatan dokumen Berita Acara serah terima pekerjaan (`BeritaAcaraReport.tsx` & `generateBeritaAcaraDOCX.ts`) berformat Microsoft Word (.docx).

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
│   │   ├── MainApp.tsx            # Main application navigation & dynamic routing
│   │   ├── SOPEOPManagement.tsx   # ★ SOP (14 Seksi) & EOP (8 Seksi) Manager
│   │   ├── MonthlyReportGenerator.tsx # ★ Bab 1-8 Comprehensive Monthly Report Generator
│   │   ├── BOQMasterAsset.tsx     # BOQ Master Asset management
│   │   ├── FileManagement.tsx     # ★ Centralized 16-Folder File Management
│   │   ├── FindingManagement.tsx  # Finding tab switcher (PM vs Manual)
│   │   ├── ManualAbnormalFinding.tsx # ★ Manual Abnormal Finding field input & presets
│   │   ├── AbnormalFindingsCenter.tsx # ★ QC DME Abnormal Findings Center
│   │   ├── PredictiveReportModal.tsx # ★ PdM Modal with 5-Role NeutraDC Approval Sheet
│   │   ├── PeriodicPredictiveModal.tsx # Periodic PdM Modal
│   │   ├── CorrectiveMaintenance.tsx # ★ CM Module & Sparepart Categorization
│   │   ├── CMReportFormModal.tsx  # Corrective Maintenance Report Form
│   │   ├── CMMonthlyRecapModal.tsx # ★ Multi-month CM recap modal
│   │   ├── SLAForm.tsx            # SLA calculation & 180m restore time tracking
│   │   ├── SLAMonthlyRecapModal.tsx # Monthly SLA Recap Modal (Ascending Sort)
│   │   ├── PTWManagement.tsx      # ★ Permit to Work with dynamic intervals & dates
│   │   ├── AbsenTBM.tsx           # ★ Toolbox Meeting multi-photo attendance with Face ID
│   │   ├── AbsenInduction.tsx     # ★ Safety Induction multi-photo attendance with Face ID
│   │   ├── HSEArchiveHub.tsx      # ★ HSE Document Archive & Bulk ZIP Export
│   │   ├── FaceRegistrationManagement.tsx # Biometric Face Registration
│   │   ├── MOPWorkflow.tsx        # Method of Procedure workflow & approval
│   │   ├── MOPMonitoringDashboard.tsx # Realtime MOP monitoring
│   │   ├── PIRManagement.tsx      # ★ Post Incident Report manager (Century Gothic 10pt)
│   │   ├── PIRReportFormModal.tsx # PIR Form modal
│   │   ├── BeritaAcaraReport.tsx  # Berita Acara report generator
│   │   ├── HSEReportForm.tsx      # HSE (K3) report form
│   │   ├── HSEFindingsArchive.tsx # HSE inspection findings archive
│   │   ├── CameraModal.tsx        # Smart Camera with GPS & corporate watermarks
│   │   ├── PaperReportDigitizerModal.tsx # AI Paper Report OCR digitizer
│   │   └── WAGatewayModal.tsx     # WhatsApp Gateway dashboard
│   ├── utils/
│   │   ├── sopEopDocxExport.ts    # Word (.docx) export for SOP & EOP procedures
│   │   ├── sopEopDocxImport.ts    # Word (.docx) parser & importer for SOP/EOP
│   │   ├── sopEopBilingualAI.ts   # Bilingual AI translator & drafting engine
│   │   ├── generateMonthlyReportDOCX.ts # Word generator for Bab 1-8 Monthly Report
│   │   ├── monthlyReportAI.ts     # AI prompt pipeline for Monthly Report Executive Summary
│   │   ├── AbnormalRecapWordExport.ts # Word (.docx) generator for Abnormal Findings Recap
│   │   ├── PredictiveReportWordExport.ts # Word (.docx) export for Predictive Maintenance
│   │   ├── PredictiveReportPdfExport.ts # PDF export for Predictive Maintenance
│   │   ├── CMReportPdfExport.ts   # Corrective maintenance PDF export
│   │   ├── CMMonthlyRecapExport.ts # Multi-month CM recap export to DOCX & Excel
│   │   ├── HSETbmPdfExport.ts     # PDF generator for Toolbox Meeting (TBM)
│   │   ├── HSESafetyInductionPdfExport.ts # PDF generator for Safety Induction
│   │   ├── HSEInspectionRecapPdfExport.ts # PDF generator for HSE Inspection Recap
│   │   ├── HSEFindingPdfExport.ts # PDF generator for HSE Findings
│   │   ├── engineerSignatures.ts  # Standardized 3-column & 5-role signature matrix
│   │   ├── imageCompression.ts   # Client-side image compression (Firestore 1MB limit safe)
│   │   ├── generateBeritaAcaraDOCX.ts # Berita Acara Word generator
│   │   ├── modalScrollLock.ts     # Universal background scroll lock utility
│   │   ├── excelExport.ts         # Dual-sheet Excel generator with dynamic formulas
│   │   ├── ptwExport.ts           # PTW PDF & Excel export
│   │   ├── aiAgentPipeline.ts     # Client pipeline to Go backend AI endpoints
│   │   ├── faceRecognitionService.ts # Client face recognition & vector matching
│   │   └── draftStorage.ts        # LocalStorage auto-save draft manager
│   ├── types/
│   │   ├── sopEopTypes.ts         # SOP (14 Seksi) & EOP (8 Seksi) interfaces
│   │   ├── hseTbmInductionTypes.ts # TBM, Safety Induction & Multi-photo DTOs
│   │   ├── correctiveReportTypes.ts # Corrective maintenance DTOs & SLA models
│   │   ├── finding.ts             # PM and Manual abnormal findings data model
│   │   ├── pirReportTypes.ts      # PIR chronological incidents & signatures
│   │   └── serviceReportTypes.ts  # 13 maintenance equipment checklist models
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
- **Collection-Level Isolation**: Isolasi hak akses terpisah untuk `reports`, `archive`, `sop_documents`, `eop_documents`, `hse_reports`, `ptw`, `findings`, dan `maintenance_progress`.
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

DwimitraSystem menerapkan kontrol akses berbasis peran (*Role-Based Access Control*) yang mencakup 18+ peran operasional dan akun preset:

| Role | Tingkat Akses | Deskripsi & Ruang Lingkup |
| :--- | :--- | :--- |
| `admin` | 🔴 Full System | Akses tak terbatas, user management, audit logs, file upload, ekspor arsip, & konfigurasi |
| `qcdme@dme.com` | 🔴 Full Quality | QC DME Dashboard, Abnormal Findings Center, review delete requests, upload berkas |
| `site_manager` | 🟠 High / Approval | Monitoring pemeliharaan menyeluruh, persetujuan MOP/PTW, pengesahan laporan Bab 1-8 |
| `site_manager_dme` | 🟠 High / Approval | DME Dashboard, MOP Kanban, OCS & TDE Approval, chunk upload monitoring |
| `manager` | 🟠 High | Pemantauan progres pemeliharaan data center & ringkasan operasional |
| `teknisi` / `maintenance` | 🟢 Standard Lapangan | Akses terarah ke tab Input Temuan Abnormal Manual, pelaporan inspeksi lapangan, manajemen sparepart trouble, dan arsip dokumen |
| `engineer` | 🟢 Standard Operasional | Pembuatan laporan service report, unggah foto, temuan lapangan, smart camera |
| `standby_engineer` | 🟢 Standard Lapangan | Pembuatan laporan cepat di lapangan & akses read-only pada Management File |
| `Engineer_K2` / `engineer_k2` | 🟢 Spesialis UTT K2 | Pelaporan dan inspeksi operasional spesifik perangkat K2 data center |
| `hse` | 🟡 Modul K3 | Modul HSE, absensi K3 (TBM & Induction multi-foto), foto editor inspeksi keselamatan |
| `tde` | 🟡 Divisi Teknis | Akses persetujuan divisi Technical Data Center Engineer (TDE) |
| `cbre` | 🟡 Divisi Fasilitas | Tampilan pemantauan operasional divisi CBRE |
| `pmo` | 🟡 Divisi Proyek | Akses pelacakan milestone dan progres pemeliharaan proyek data center |
| `sales` | 🟡 Komersial | Akses khusus pelaporan komersial |
| `presales` | 🟡 Teknis Komersial | Tinjauan kapasitas dan infrastruktur untuk pra-penjualan |
| `purchasing` | 🟡 Pengadaan | Pelacakan kebutuhan sparepart dan material pemeliharaan |
| `dirut` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direktur Utama |
| `direksiSDM` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direksi SDM |
| `DireksiKeuangan` | 🟣 Eksekutif | Hak akses baca-saja (*read-only*) level Direksi Keuangan |

*Catatan Preset Akun Khusus:*
- Akun seperti `pju@gmail.com` dan akun perangkat water softener secara otomatis memuat template temuan anomali bawaan, deskripsi standar, dan rekomendasi awal saat membuat temuan abnormal manual.

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
