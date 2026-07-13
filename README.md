# 🏢 UTT Report Maintenance

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-AI_Agent-76B900?style=flat-square&logo=nvidia)](https://developer.nvidia.com/)
[![Meta Llama](https://img.shields.io/badge/Meta_Llama_3-LLM-0460A9?style=flat-square&logo=meta)](https://meta.ai/)
[![Firebase](https://img.shields.io/badge/Firebase-Cloud-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Deployed_on-Firebase-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Security](https://img.shields.io/badge/Security-Hardened-brightgreen?style=flat-square&logo=shield)](#-security)

**UTT Report Maintenance** adalah sistem dokumentasi infrastruktur kritikal profesional yang dirancang khusus untuk memfasilitasi pelaporan pemeliharaan data center bagi **PT United Transworld Trading (UTT)**.

> 🔗 **Live Production**: <https://report-utt.web.app/>

---

## 📑 Table of Contents

- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🏗 Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                   │
│                                                               │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Login   │  │ MainApp  │  │ AdminDash  │  │ SiteMgr    │  │
│  │  Page    │  │  Page    │  │  board     │  │ Dashboard  │  │
│  └────┬────┘  └────┬─────┘  └─────┬──────┘  └─────┬──────┘  │
│       └─────────┬──┴──────────────┴────────────────┘         │
│                 │ Firebase Auth Token (Bearer)                │
├─────────────────┼────────────────────────────────────────────┤
│                 ▼                                             │
│         ┌──────────────┐                                     │
│         │ Firebase Edge │  Cloud Functions / Hosting           │
│         └──────┬───────┘                                     │
│                │                                             │
│  ┌─────────────┼────────────────────────────────────────┐    │
│  │        Go Backend (api/index.go)                      │    │
│  │                                                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │    │
│  │  │Middleware │  │ Routes   │  │   Controllers     │   │    │
│  │  │  Chain   │──│ Dispatch │──│                   │   │    │
│  │  │          │  │          │  │  Report / User /  │   │    │
│  │  │• CORS    │  │• Health  │  │  Archive / Audit  │   │    │
│  │  │• Auth    │  │• Auth    │  │  Maintenance /    │   │    │
│  │  │• RateLimit│ │• API     │  │  Findings / HSE   │   │    │
│  │  │• Security│  │          │  │                   │   │    │
│  │  │• Logger  │  │          │  │                   │   │    │
│  │  └──────────┘  └──────────┘  └────────┬──────────┘   │    │
│  │                                       │               │    │
│  │                              ┌────────▼──────────┐    │    │
│  │                              │   Services Layer  │    │    │
│  │                              └────────┬──────────┘    │    │
│  │                              ┌────────▼──────────┐    │    │
│  │                              │  Repositories     │    │    │
│  │                              └────────┬──────────┘    │    │
│  └───────────────────────────────────────┼───────────────┘    │
│                                          │                    │
├──────────────────────────────────────────┼────────────────────┤
│                                          ▼                    │
│                    ┌──────────────────────────┐               │
│                    │   Firebase / Firestore   │               │
│                    │                          │               │
│                    │  • Authentication        │               │
│                    │  • Firestore Database    │               │
│                    │  • Security Rules        │               │
│                    │  • Cloud Storage         │               │
│                    └──────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Frontend

| Technology | Purpose |
| :--- | :--- |
| **React 18** + **TypeScript** | Antarmuka reaktif dengan type-safety |
| **Vite 6** | Build tool generasi terbaru |
| **Tailwind CSS v4** | Utility-first styling |
| **Framer Motion** | Micro-animations & transisi premium |
| **Radix UI** | Komponen aksesibel & berperforma tinggi |
| **MUI (Material UI)** | Komponen UI tambahan |
| **jsPDF** + **ExcelJS** | Export laporan ke PDF & Excel |
| **html2canvas** | Screenshot & capture komponen |

### Backend

| Technology | Purpose |
| :--- | :--- |
| **Go 1.23 (Golang)** | High-performance API server |
| **NVIDIA NIM API** | Enterprise LLM Gateway & model orchestration |
| **Firebase Admin SDK** | Server-side auth & Firestore access |
| **Firebase Functions** | Deployment & serverless backend |

### Cloud & Infrastructure

| Technology | Purpose |
| :--- | :--- |
| **Firebase Authentication** | User auth & session management |
| **Cloud Firestore** | NoSQL real-time database |
| **Firebase Security Rules** | Database-level access control |
| **Firebase Hosting** | CI/CD, SSL, & hosting |
| **Firebase App Check** | Request verification & anti-abuse |
| **PWA Cache Strategy** | Network-First strategy for reliable API data |

---

## 🚀 Features

### 🤖 AI-Powered Assistant & Chat Copilot

Sistem asisten AI interaktif tingkat korporat yang terintegrasi penuh untuk membantu teknisi data center:

- **Interactive DC Chatbot** — Floating widget chat (`AIChatWidget.tsx`) dengan dukungan render markdown penuh, suggestion chip kontekstual, riwayat percakapan, dan fitur upload gambar.
- **Multimodal Visual Analyzer** — Analisis visual cerdas panel listrik, grounding, dan thermal hotspot menggunakan model **`models/gemini-3.1-flash-lite`**.
- **Telemetry Validator & Consolidator** — Pengenalan otomatis parameter teknis dan pembuatan remarks (dalam Bahasa Indonesia) menggunakan model penalaran tingkat tinggi **`models/gemini-3.1-flash-lite`**.
- **Dynamic Load Balancing** — Algoritma *round-robin key pool* kustom pada backend Go (`ai_service.go`) untuk mengatasi pembatasan rate limit API Google Gemini.

### 📷 Smart Camera & Watermarking

Sistem pengambilan foto dokumentasi pintar yang menyematkan metadata teknis secara presisi:

- **Real-time GPS Integration** — Koordinat Latitude/Longitude otomatis
- **Dynamic Address Lookup** — Reverse geocoding koordinat → alamat fisik
- **"Burn-on-Apply" Technology** — Sinkronisasi preview & hasil akhir foto
- **Professional Branding** — Watermark NEUTRADC dengan gradien khusus

### 📝 Report Management

- **Multi-Template Support** — VRV, AHHU, LV ATS Trafo, dan template custom
- **Fluid Photo Upload** — Dokumentasi intuitif dengan preview instan
- **Professional Export** — Excel (.xlsx) dan PDF (A4) siap cetak
- **Auto-pagination** — 9 foto per halaman untuk laporan PDF
- **Draft System** — Simpan draft laporan yang belum selesai

### 📜 PTW (Permit to Work) Management

Sistem manajemen izin kerja terintegrasi untuk kontrol operasional yang aman:

- **Strict Validation** — Kewajiban upload file PTW yang sudah ditandatangani oleh TDE.
- **Week 5 Dynamic Intervals** — Pembagian per 7 hari untuk Minggu 1-4 (Tanggal 1-7, 8-14, 15-21, 22-28) dan pembuatan otomatis **Minggu 5** (Hari 29 hingga melintasi batas awal bulan berikutnya) agar semua data tercatat utuh.
- **Professional PDF & Excel Report** — Layout PDF yang dioptimalkan (tanpa potongan teks legend / tumpang tindih lane garis chart) serta export Excel dinamis.
- **Smart Sorting** — Pengurutan otomatis berdasarkan nomor urut (Sequence Number) untuk kemudahan pelacakan.
- **Large Data Handling** — Optimalisasi untuk menangani ratusan data PTW dengan performa tinggi.
- **Secure Attachments** — Sistem penyimpanan lampiran file (PDF/Image) berbasis Firebase Storage dengan integrasi Firestore.
- **Smooth Navigation & UI** — Fitur *Quick Scroll* (Top & Bottom) untuk navigasi cepat pada daftar data yang panjang serta sticky headers `opaque` agar teks tidak menumpuk saat di-scroll.
- **Data Integrity** — Proteksi penghapusan data dengan sistem konfirmasi ganda dan auto-closed untuk izin yang melebihi masa berlaku.

### 🔧 Corrective Maintenance

Modul khusus untuk mendokumentasikan perbaikan dan pemeliharaan korektif dengan workflow terstruktur.

### 🦺 HSE (Health, Safety, Environment) Reports

Modul pelaporan K3 terintegrasi dengan photo editor dan export PDF profesional.

### 📋 Findings Management

- **Dual-Module Architecture** — Input Temuan (data entry) & Arsip Temuan (history)
- **Advanced Filter** — Pencarian berdasarkan bulan & tahun
- **Multi-Format Export** — PDF dan Microsoft Word (.docx)
- **Interactive Photo Gallery** — Cropping & editing deskripsi foto

### 📊 Site Manager Dashboard

- **Quarterly Progress Tracking** — Q1, Q2, Q3, Q4
- **Maintenance Progress Monitoring** — Real-time status update
- **End-of-Day Reports** — Summary harian otomatis

### 👥 User & Role Management

- **Role-Based Access Control (RBAC)** — 16+ role types
- **Admin Dashboard** — User management, audit logs, analytics
- **Notification Center** — Real-time notifications

### 📦 Inventory & Borrowing

- **Equipment Borrowing** — Request & approval workflow
- **Status Tracking** — Borrowing status list dengan approval chain

---

## 📁 Project Structure

```text
utt-report-maintenance/
├── api/                          # Cloud API entry point
│   └── index.go                  # Main serverless handler (Go runtime)
│
├── backend/
│   ├── cmd/api/                  # Local development server entry
│   ├── core/
│   │   ├── config/               # Firebase, security, app config
│   │   ├── controllers/          # HTTP handlers (Report, User, Auth, etc.)
│   │   ├── middlewares/          # Auth, CORS, rate limiter, security headers
│   │   ├── models/               # Data models & DTOs
│   │   ├── repositories/        # Firestore data access layer
│   │   ├── routes/               # API routing & middleware chain
│   │   └── services/             # Business logic layer
│   └── pkg/
│       ├── helpers/              # Response helpers, validators, IP utils
│       ├── logger/               # Structured logging
│       └── sanitizer/            # Input sanitization (XSS/injection prevention)
│
├── frontend/
│   ├── api/                      # Firebase client config
│   ├── assets/                   # Images, logos, templates
│   ├── components/               # React components
│   │   ├── AuthContext.tsx        # Authentication provider
│   │   ├── ReportForm.tsx         # Main report form
│   │   ├── HSEReportForm.tsx      # HSE report module
│   │   ├── PTWManagement.tsx      # PTW Management module (New)
│   │   ├── CorrectiveMaintenance.tsx  # Corrective maintenance module
│   │   ├── CameraModal.tsx        # Smart camera with watermarking
│   │   ├── FindingManagement.tsx  # Findings input
│   │   ├── FindingArchive.tsx     # Findings archive & export
│   │   ├── DocumentList.tsx       # Report listing & management
│   │   └── ui/                    # Reusable UI primitives
│   ├── config/                   # Report templates configuration
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Page-level components
│   │   ├── Login.tsx              # Authentication page
│   │   ├── MainApp.tsx            # Engineer dashboard
│   │   ├── AdminDashboard.tsx     # Admin control panel
│   │   ├── SiteManagerDashboard.tsx  # Site manager dashboard
│   │   ├── HSEApp.tsx             # HSE module page
│   │   ├── InventoryApp.tsx       # Inventory management
│   │   └── DivisionApp.tsx        # Division-specific views
│   ├── themes/                   # UI theme configuration
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utilities (PDF export, image compression, etc.)
│
├── firebase/
│   ├── firestore.rules           # Firestore security rules
│   └── firestore.indexes.json    # Firestore composite indexes
│
├── firebase.json                 # Firebase hosting & CSP configuration
├── vercel.json                   # Vercel deployment & CORS configuration
├── vite.config.ts                # Vite build configuration
├── docker-compose.yml            # Docker setup (optional)
└── package.json                  # Dependencies & scripts
```

---

## 📡 API Reference

Base URL: `https://report-utt.web.app/api`

### Authentication

All API endpoints (except health checks) require authentication via one of:

- **Firebase Auth Token**: `Authorization: Bearer <firebase_id_token>` (Strict Enforcement)

### Endpoints

#### Health & Monitoring

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Liveness check | ❌ |
| `GET` | `/api/ready` | Readiness check | ❌ |
| `GET` | `/api/metrics` | System metrics | ❌ |

#### Auth Endpoints

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | User login | Global |
| `POST` | `/api/auth/logout` | User logout | Global |
| `GET` | `/api/auth/me` | Get current user | Global |

#### Reports

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/report` | Create report with photos | 🔴 Heavy (5 rps) |
| `GET` | `/api/reports` | List all reports | 🟢 Standard (20 rps) |
| `GET` | `/api/report/:id` | Get single report | 🟢 Standard |
| `DELETE` | `/api/report/:id` | Delete report | 🔴 Heavy |

#### Users

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | List all users | 🟢 Standard |
| `GET` | `/api/users/:id` | Get user profile | 🟢 Standard |
| `PATCH` | `/api/users/:id/role` | Update user role | 🔴 Heavy |
| `DELETE` | `/api/users/:id` | Deactivate user | 🔴 Heavy |

#### Archive

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/archive` | List archives | 🟢 Standard |
| `GET` | `/api/archive/:id` | Get archive detail | 🟢 Standard |
| `DELETE` | `/api/archive/:id` | Permanent delete | 🔴 Heavy |

#### Audit Logs

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | All audit logs | 🟢 Standard |
| `GET` | `/api/audit/me` | My audit logs | 🟢 Standard |

#### Maintenance Progress

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/maintenance-progress` | List all progress | 🟢 Standard |
| `POST` | `/api/maintenance-progress` | Create progress entry | 🔴 Heavy |
| `GET` | `/api/maintenance-progress/summary` | Get summary | 🟢 Standard |
| `POST` | `/api/maintenance-progress/end-day` | End-of-day report | 🔴 Heavy |
| `PATCH` | `/api/maintenance-progress/:id` | Update progress | 🔴 Heavy |
| `DELETE` | `/api/maintenance-progress/:id` | Delete progress | 🔴 Heavy |

#### Findings

| Method | Endpoint | Description | Throttle |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/findings` | Create finding | 🔴 Heavy |
| `GET` | `/api/findings` | List findings | 🟢 Standard |
| `DELETE` | `/api/findings/:id` | Delete finding | 🔴 Heavy |

### Rate Limiting

| Tier | Limit | Burst | Applied To |
| :--- | :--- | :--- | :--- |
| 🌐 **Global** | 20 rps | 40 | All requests |
| 🟢 **Standard** | 20 rps | 40 | GET (read operations) |
| 🔴 **Heavy** | 5 rps | 10 | POST/DELETE/PATCH (write operations) |

---

## 🔒 Security

### Authentication & Authorization

- **Strict Authentication** — Mandatory Firebase ID Token validation for all sensitive operations.
- **Role-Based Access Control (RBAC)** — 16+ roles with granular Firestore & Storage security rules.
- **Infrastructure Hardening** — Deprecated legacy `X-API-Secret` bypass to prevent unauthorized API access.
- **Anti-Enumeration** — Transitioned to high-entropy UUIDs for critical maintenance records.
- **Resource Protection** — Semaphore-based Worker Pools (Concurrent Limit: 5) to prevent function timeouts and database exhaustion.
- **Scoped Data Deletion** — Pengamanan proses penghapusan data massal (Batch Operations) untuk menjaga integritas database.

### Security Headers

| Header | Value |
| :--- | :--- |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Strict whitelist (No `unsafe-inline` / `unsafe-eval`) |
| `Permissions-Policy` | Camera, microphone, geolocation restricted |
| `Cache-Control` | PWA-optimized NetworkFirst for `/api` |

### Data Protection

- **Input Sanitization** — DOMPurify-based sanitizer for XSS/injection prevention
- **CORS Whitelisting** — Only `report-utt.web.app` allowed
- **Firestore Security Rules** — Document-level access control with field validation
- **Default Role Enforcement** — New users forced to `engineer` role (prevents privilege escalation)
- **No Client-Side Secrets** — API secrets never exposed in frontend bundles
- **Error Masking** — Internal errors never leaked to clients

### Infrastructure

- **Git History Cleaned** — Sensitive files purged from all commits via `git-filter-repo`
- **Environment Isolation** — Separate secrets for Production, Preview, and Development
- **Credential Rotation** — Service account keys and API secrets regularly rotated
- **Request ID Tracking** — Every request tagged with unique ID for audit trail

### Middleware Pipeline

```text
Request → RequestID → Logger → PanicRecovery → SecurityHeaders → CORS → RateLimiter → Auth → Route
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **Go** v1.23+
- **Firebase CLI** (`npm install -g firebase-tools`)
- **npm** or **pnpm**

### Installation

```bash
# Clone repository
git clone https://github.com/gariiriana/utt-report-maintenance.git
cd utt-report-maintenance

# Install frontend dependencies
npm install

# Build backend binary
npm run backend:build
```

### Environment Variables

Create `.env.development` in the project root:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
VITE_API_URL=http://localhost:8080/api
```

Create `.env` for backend:

```env
BACKEND_API_SECRET=your_secret_here
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# AI Model Configuration (Google Gemini API - using backward compatible env names)
NVIDIA_NIM_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2
NVIDIA_NIM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
NVIDIA_NIM_VISION_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_REASONING_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_CHAT_MODEL=models/gemini-3.1-flash-lite
```

### Running Development Server

```bash
# Start both frontend (Vite) and backend (Go) concurrently
npm run dev
```

This runs:

- **Frontend**: Vite dev server at `http://localhost:5173`
- **Backend**: Go API server at `http://localhost:8080`

### Build for Production

```bash
# Frontend build
npm run build:prod

# Backend build
npm run backend:build
```

---

## 🌐 Deployment

### Firebase (Production)

The project is deployed on **Firebase** with the following setup:

1. **Frontend** — Static build served via Firebase Hosting
2. **Backend** — Go serverless functions / Cloud Functions
3. **SSL & Domain** — Managed automatically by Firebase

```bash
# Build frontend
npm run build

# Deploy to Firebase
firebase deploy
```

### Firebase (Firestore Rules)

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy hosting (if using Firebase Hosting)
firebase deploy --only hosting
```

### Docker (Optional)

```bash
docker-compose up -d
```

---

## 📂 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start frontend + backend dev servers |
| `npm run build` | Build frontend for production |
| `npm run build:prod` | Build with production env |
| `npm run build:dev` | Build with development env |
| `npm run backend` | Run Go backend server |
| `npm run backend:build` | Compile Go backend to `server.exe` |

---

## 🔑 Role System

| Role | Access Level | Description |
| :--- | :--- | :--- |
| `admin` | 🔴 Full | Semua akses + user management |
| `site_manager` | 🟠 High | Dashboard + maintenance progress |
| `manager` | 🟠 High | Dashboard + maintenance progress |
| `engineer` | 🟢 Standard | Report creation + findings |
| `standby_engineer` | 🟢 Standard | Report creation + inventory borrowing |
| `hse` | 🟡 Module | HSE reports only |
| `tde` | 🟡 Module | Division-specific access |
| `cbre` | 🟡 Module | Division-specific access |
| `pmo` | 🟡 Module | Division-specific access |
| `sales` | 🟡 Module | Division-specific access |
| `presales` | 🟡 Module | Division-specific access |
| `purchasing` | 🟡 Module | Division-specific access |
| `inventory` | 🟡 Module | Inventory management |
| `dirut` | 🟣 Executive | Read-only executive view |
| `direksiSDM` | 🟣 Executive | Read-only executive view |
| `DireksiKeuangan` | 🟣 Executive | Read-only executive view |

---

## 📄 License

Sistem ini bersifat **privat** dan dikembangkan eksklusif untuk kebutuhan operasional **PT United Transworld Trading (UTT)**. Source code dan dokumentasi ini merupakan properti perusahaan yang dilindungi.

---

*Built with ❤️ by [Gari Iriana](https://github.com/gariiriana*)
