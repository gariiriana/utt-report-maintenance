# 🏢 DwimitraSystem

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-007ACC?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Go](https://img.shields.io/badge/Go-1.27-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Go_Serverless-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_&_Hosting-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Free_Tier-4285F4?style=flat-square&logo=googlegemini)](https://ai.google.dev/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-WAF_&_Turnstile-F38020?style=flat-square&logo=cloudflare)](https://cloudflare.com/)
[![DOCX](https://img.shields.io/badge/DOCX-Word_Export-2B579A?style=flat-square&logo=microsoft-word)](https://github.com/dolanmiu/docx)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-Excel_Export-217346?style=flat-square&logo=microsoft-excel)](https://github.com/exceljs/exceljs)

**DwimitraSystem** adalah sistem terintegrasi untuk dokumentasi pemeliharaan, analisis berbantuan AI, dan pelaporan operasional fasilitas *critical infrastructure* data center. Sistem ini dikembangkan untuk **PT Dwimitra Ekatama Mandiri** yang melayani **PT United Transworld Trading (UTT)** di fasilitas data center **Neutra DC Cikarang**.

> - 🔗 **Domain utama**: <https://dwimitrasystem.com/>
> - 🔄 **Fallback**: <https://report-utt.web.app/> *(otomatis diarahkan ke domain utama)*
> - 📱 **Bisa dipasang sebagai aplikasi** ("Dwimitra System") dan tetap bisa menyimpan data saat sinyal hilang.

---

## 📑 Daftar Isi

- [Pembaruan Terbaru](#-pembaruan-terbaru)
- [Arsitektur](#-arsitektur)
- [Tech Stack](#-tech-stack)
- [Modul & Fitur](#-modul--fitur)
  - [AI Service Report & Chat Copilot](#-ai-service-report--chat-copilot)
  - [Predictive Report dari Laporan PM](#-predictive-report-dari-laporan-pm)
  - [Predictive Maintenance CM & Periodik](#-predictive-maintenance-cm--periodik)
  - [Monthly Report Generator (13 Bab)](#-monthly-report-generator-13-bab)
  - [SOP & EOP](#-sop--eop)
  - [Bilingual MOP & Arsip MOP](#-bilingual-mop--arsip-mop)
  - [MOP Workflow, Monitoring & PIR](#-mop-workflow-monitoring--pir)
  - [Abnormal Findings Center](#-abnormal-findings-center)
  - [Corrective Maintenance, SLA/SLG & Arsip Standby](#-corrective-maintenance-slaslg--arsip-standby)
  - [Management File](#-management-file)
  - [Drafter & Update BOQ per Ruangan](#-drafter--update-boq-per-ruangan)
  - [PTW & Register Nomor PTW](#-ptw--register-nomor-ptw)
  - [HSE & K3](#-hse--k3)
  - [Smart Camera & GPS Watermark](#-smart-camera--gps-watermark)
  - [Upload SR, Paper Digitizer & WhatsApp](#-upload-sr-paper-digitizer--whatsapp)
  - [PWA, Offline & Update Aplikasi](#-pwa-offline--update-aplikasi)
  - [Navigasi & UI/UX](#-navigasi--uiux)
- [Struktur Proyek](#-struktur-proyek)
- [API Reference](#-api-reference)
- [Koleksi Firestore](#-koleksi-firestore)
- [Keamanan](#-keamanan)
- [Getting Started](#-getting-started)
- [Testing](#-testing)
- [Available Scripts](#-available-scripts)
- [Role System (RBAC)](#-role-system-rbac)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🆕 Pembaruan Terbaru

Perubahan sejak pembaruan README terakhir (28 September 2026) sampai 21 Oktober 2026.

| Tanggal | Pembaruan |
| :--- | :--- |
| 21 Okt | **[Predictive Report PM untuk semua akun maintenance](#-predictive-report-dari-laporan-pm)** (ATS, LDB/RDB, LV, MV, Trafo, PDU, UPS, Genset, CRAC, VRV, AHU, Pompa, Lift, X-Ray, PJU, FSS, Water Softener, dan lainnya), tidak lagi hanya FCU. Batas acuan dari standar SR perusahaan dan standar terkait. *Predictive per Quarter* dikelompokkan per akun + jenis unit |
| 15 Okt | Predictive Report PM: **ekspor DOCX** selain PDF, **foto kartu ikut masuk** ke PDF/DOCX, **pilih equipment** yang dianalisis, dan **edit angka** hasil baca AI setelah disimpan |
| 15 Okt | **Voice Agent dihapus** (frontend, endpoint `/api/voice/ws`, dan dependensi WebSocket). Mic *Voice Note* (dikte ke chat) tetap ada |
| 15 Okt | **[Predictive Report dari laporan PM](#-predictive-report-dari-laporan-pm)** (pilot FCU) di Arsip Dokumen: AI membaca foto alat ukur, engineer mengonfirmasi angka, status dan proyeksi dihitung terhadap standar |
| 14 Okt | **[Update aplikasi aman](#-pwa-offline--update-aplikasi)**: draft formulir disimpan sebelum aplikasi dimuat ulang, lalu dipulihkan |
| 14 Okt | **[Navigasi tersinkron dengan riwayat browser](#-navigasi--uiux)**: menu dan folder punya URL sendiri, tombol Back/Forward berfungsi |
| 12 Okt | **[Simpan offline](#-pwa-offline--update-aplikasi)**: data tersimpan di HP saat tanpa sinyal dan terkirim otomatis; penanda offline; upload foto dari HP diperbaiki |
| 9 Okt | HSE Inspection: filter **MSDS** untuk admin. Site Manager DME: navigasi pindah ke **sidebar kiri** |
| 8–9 Okt | **[Bilingual MOP](#-bilingual-mop--arsip-mop)** (EN + ID) dengan terjemahan AI gratis dan **Arsip MOP** |
| 8 Okt | **[Register Nomor PTW](#-ptw--register-nomor-ptw)** berbentuk teks, termasuk import massal dari salinan chat WhatsApp |
| 8–9 Okt | Arsip Standby: **filter Quarter Q1–Q4** di folder SLA/SLG; daftar dimuat tanpa foto agar cepat |
| 7 Okt | Management File: folder **Weekly/Monthly HSE Report** dan **rename berkas** (khusus QC DME) |
| 2–12 Okt | Monthly Report: **Observation & Finding** diambil dari Temuan Abnormal dengan RCA agentic, RCA tanpa foto, profil Water & Fuel Leak di Bab 9, pilihan CI Name dari BOQ |
| 2–9 Okt | SOP & EOP: import/export DOCX sesuai dokumen asli, opsi Word **full Bahasa Indonesia** per dokumen, pilih semua & hapus massal di arsip |
| 1–5 Okt | **[Role Drafter & Update BOQ per ruangan](#-drafter--update-boq-per-ruangan)** dengan kamera langsung, antrean offline, dan ekspor Excel per ruangan |
| 29 Sep | Rekap CM Word: tabel *solved* dan *pending* dipisah, ditambah kolom rekomendasi |
| 2–8 Okt | **Dihapus**: target Firebase Storage (semua berkas kini di Firestore) dan login/registrasi wajah |

---

## 🏗 Arsitektur

```text
Pengguna (browser / PWA terpasang di HP)
  │
  ▼
Cloudflare ── DNS, WAF, Turnstile
  │
  ▼
Frontend SPA (React 18 + Vite 6 + Tailwind v4) ── Firebase Hosting
  │  • Halaman per role: MainApp, SiteManager, DME, HSE, Division, Drafter
  │  • Cache Firestore lokal + antrean tulis offline (IndexedDB)
  │  • Ekspor PDF / DOCX / XLSX / ZIP dibuat di browser
  │
  ├── Firebase Web SDK ──► Firebase (project report-utt)
  │                          • Auth + custom claim role
  │                          • Firestore + Security Rules
  │                          • Foto & berkas disimpan sebagai chunk di subkoleksi Firestore
  │                          • Realtime Database (status online)
  │
  └── HTTPS /api/* + Firebase ID token ──► Backend Go 1.27 (Vercel Function api/index.go)
                                             middleware → routes → controllers → services → repositories
                                             • verifikasi token, Turnstile, kelola user & role
                                             • AI ──► Google Gemini (tier gratis, endpoint OpenAI-compatible,
                                             │        pool multi-key + rotasi model)
                                             • Firestore (Admin SDK)
```

Prinsip utama:

- **Data langsung dari browser.** Sebagian besar baca/tulis memakai Firestore Web SDK dan dijaga Security Rules per koleksi dan role. Backend hanya dipakai untuk hal yang butuh rahasia server: AI, verifikasi Turnstile, pengelolaan user/role, dan WhatsApp.
- **Tanpa Cloud Storage dan Cloud Functions.** Project Firebase memakai paket Spark. Foto dan berkas disimpan sebagai potongan (chunk) di subkoleksi Firestore (`photos`, `chunks`, `assets`) agar tiap dokumen tetap di bawah 1 MiB.
- **Dokumen dibuat di browser.** PDF, Word, Excel, dan ZIP dirender di sisi klien, sehingga backend tetap ringan dan dalam batas fungsi serverless.
- **AI gratis dengan pengaman.** Semua panggilan AI lewat backend dengan pool key Gemini, rotasi model, dan cooldown saat kena limit. Fitur yang menghasilkan angka (predictive) menghitung status secara deterministik; AI hanya membaca foto dan menulis narasi.

---

## 🛠 Tech Stack

### Frontend

| Teknologi | Versi | Peran |
| :--- | :--- | :--- |
| **React** | `18.3.1` | UI berbasis komponen |
| **TypeScript** | `6.0` | Strict typing untuk seluruh DTO laporan dan formulir |
| **Vite** | `6.3.5` | Dev server (proxy `/api` → `:8080`) dan bundler |
| **Tailwind CSS** | `4.1.12` | Styling via `@tailwindcss/vite` |
| **vite-plugin-pwa** | `1.2` | Service worker, manifest "Dwimitra System", update dengan konfirmasi |
| **Firebase Web SDK** | `12.8` | Auth, Firestore (cache lokal persisten), Realtime Database, Analytics |
| **Motion** (`motion/react`) | `12.23` | Animasi dan transisi |
| **Radix UI, MUI 7, Lucide** | — | Komponen UI dan ikon |
| **docx** | `9.6` | Ekspor Microsoft Word |
| **ExcelJS / SheetJS (xlsx)** | `4.4` / `0.18` | Ekspor dan parsing Excel |
| **jsPDF + AutoTable** | `2.5` / `5.0` | Ekspor PDF A4 |
| **pdf.js / pdf-lib** | `5.7` / `1.17` | Membaca dan mengolah PDF |
| **JSZip** | `3.10` | Ekspor ZIP dan olah isi berkas DOCX |
| **Tesseract.js** | `7.0` | OCR di browser (PTW, digitasi laporan kertas) |
| **heic2any** | `0.0.4` | Konversi foto HEIC ke JPEG |
| **Recharts** | `2.15` | Grafik dashboard |
| **Sonner** | `2.0` | Toast notification |

### Backend

| Teknologi | Versi | Peran |
| :--- | :--- | :--- |
| **Go** | `1.27` | API backend |
| **Vercel Functions** | `api/index.go`, maks 60 s | Hosting backend produksi, auto-deploy dari branch `main` |
| **Firebase Admin SDK (Go)** | `v4.13` | Verifikasi ID token, custom claim role, Firestore |
| **Google Gemini API** | endpoint OpenAI-compatible | Vision, reasoning, chat, terjemahan MOP, Predictive Report |
| **go-playground/validator** | `v10.30` | Validasi DTO |

### Cloud & Infrastruktur

| Layanan | Konfigurasi |
| :--- | :--- |
| **Domain & Cloudflare** | `dwimitrasystem.com`, WAF 4 lapis, Turnstile CAPTCHA |
| **Firebase Hosting** | SPA dengan header keamanan (CSP, HSTS, Permissions-Policy); `index.html` dan `sw.js` tanpa cache |
| **Cloud Firestore** | Paket Spark: kuota 50.000 baca/hari, tanpa Cloud Storage dan Cloud Functions |
| **Vercel** | Backend Go serverless (project `utt-report-maintenance`) |

---

## 🚀 Modul & Fitur

### 🤖 AI Service Report & Chat Copilot

- **Analisis foto service report untuk 13 jenis peralatan**: ATS, FCU, PJU, PDU, Cooling Tower, Generator/Genset, Trafo, AC Split, Busduct, Dock Leveler, Door, Capacitor Bank, dan LDB/RDB. Catatan AI dibatasi 2–5 kata agar rapi di tabel cetak.
- **Registry template service report** (`config/serviceReportRegistry.ts`) untuk 24 akun maintenance per peralatan: ATS, MV, Grounding, CRAC, VRV, Lift, X-Ray, PJU, Genset, PDU, Cooling Tower, LV, AC Split, UPS, Gate, Trafo, AHU, Pump, Dock Leveler, Door, Exhaust Fan, FCU, LDB/RDB, dan Busduct.
- **Penerjemah aktivitas kartu foto EN ↔ ID** (`utils/translator.ts`): kamus statis dengan fallback AI.
- **Chat Copilot** (`AIChatWidget.tsx`) untuk semua role kecuali Drafter, dengan mic *Voice Note* untuk mendikte pertanyaan (speech-to-text bawaan browser).
- **Pool key dan kuota**: backend memutar beberapa key Gemini secara bergilir dan mencatat kuota harian di `system_status/ai_limit_tracker`. Klien AI untuk MOP dan predictive juga merotasi model dan memberi cooldown pada key yang kena limit (429).

### 🔮 Predictive Report dari Laporan PM

Predictive report dibuat langsung dari laporan Preventive Maintenance yang diisi engineer di **Buat Laporan**. Satu laporan PM menghasilkan **satu dokumen** dengan **satu bagian per equipment** di dalam unit. Untuk FCU ada 4 bagian: Suplai Listrik FCU, Motor Fan (Blower), Coil & Sirkulasi Chilled Water, serta Evaporator Coil & Aliran Udara. Untuk ATS ada 3: Suplai Tegangan ATS, Beban & Arus ATS, serta Terminasi, Busbar & Pembumian.

**Akun yang didukung.** Semua akun maintenance (role engineer) yang punya profil di `config/pmPredictiveProfiles.ts`: FCU, ATS, LDB/RDB, LV, MV/RMU, Trafo, PDU, Capacitor Bank, Busduct, UPS, Genset, CRAC, VRV, AHU, AC Split, Cooling Tower, Pompa, Exhaust Fan, Lift, X-Ray, PJU, Lighting System, LPS, Grounding, Dock Leveler, Door, Gate, FSS & VESDA, Water Softener, WLD, dan FLD. Akun dikenali dari email persis, lalu dari potongan email seperti pemilihan template di **Buat Laporan** (email memuat `ahu`/`ahhu`, `dock`/`leveler`, `ldb`/`rdb`, atau `watersoftener`), lalu dari nama maintenance (mis. "PM Panel ATS"). Laporan PM yang jenis unitnya tidak dikenali (mis. Chiller) tidak menampilkan tombol predictive, sehingga tidak ada analisis dengan batas yang salah. WLD dan FLD hanya punya kartu visual, sehingga predictive-nya berisi observasi visual saja.

**Alur** (Arsip Dokumen → kartu laporan PM akun maintenance → tombol **Predictive AI**):

1. Isi *Nama unit untuk riwayat* (mis. `FCU-01 Lt.2`, `ATS-01 Power Room A`). Sistem mencari predictive sebelumnya untuk unit yang sama.
2. AI membaca foto kartu: angka display alat ukur, nameplate (petunjuk rating per jenis unit, mis. In panel atau arus sekunder trafo), dan kondisi visual kartu lainnya.
3. Engineer memeriksa dan mengonfirmasi setiap angka (edit, zoom foto, isi manual, atau baca ulang foto yang gagal), lalu **mencentang equipment yang mau dianalisis**. Equipment yang terbaca AI otomatis tercentang; yang tidak dicentang tidak masuk analisis dan riwayatnya tidak bertambah, tetapi angkanya tetap disimpan. Angka baru masuk riwayat setelah dikonfirmasi.
4. Sistem menghitung status, tren, dan proyeksi. AI menulis narasi per equipment dan ringkasan eksekutif.
5. Narasi dan status bisa disunting, lalu disimpan dan diekspor ke **PDF** atau **DOCX**.
6. Predictive yang sudah tersimpan bisa dibuka lagi lewat **Edit angka & equipment**: angka dan pilihan equipment terisi dari dokumen tersimpan (tanpa panggilan AI baca foto), lalu dianalisis ulang. Nomor dokumen dan tanda tangan tetap.

**Prinsip akurasi.** AI hanya membaca foto dan menulis narasi. Status, tren (regresi linier per kuartal), dan proyeksi tanggal mencapai batas dihitung oleh kode (`utils/pmPredictiveEngine.ts`) terhadap batas acuan di profil (`config/pmPredictiveProfiles.ts`):

| Parameter | Batas acuan | Sumber |
| :--- | :--- | :--- |
| Tegangan suplai | 400/230 V, +5% / −10% (peringatan) | SNI 04-0227-2003 |
| Tegangan vs rating motor | ±10% rating nameplate (kritis) | NEMA MG-1 |
| Ketidakseimbangan tegangan | 1 / 2 / 5 % | NEMA MG-1 |
| Ketidakseimbangan arus | 5 / 10 / 20 % | Praktik pemeliharaan |
| Beban vs FLA | 80 / 90 / 100 % | Rating nameplate |
| Getaran | 1,8 / 4,5 mm/s | ISO 10816-1 kelas I |
| Kebisingan | 85 dB(A), atau naik ≥3 dB dari sebelumnya | Permenaker 5/2018 |
| Suhu | 27 / 32 °C | ASHRAE TC 9.9 |
| Kelembapan | 20–60 % normal, >70 % peringatan, >80 % kritis | ASHRAE TC 9.9 |
| Aliran udara | turun 15 / 25 / 40 % dari baseline | Baseline unit |
| ΔP chilled water | berubah 20 / 35 % dari baseline; nilai negatif = peringatan | Baseline unit |

Akun lain memakai blok parameter bersama. Bila service report perusahaan (`sr.md`) mencantumkan kolom *Standard*, nilai itu yang dipakai lebih dulu:

| Parameter | Batas acuan | Sumber |
| :--- | :--- | :--- |
| Tegangan panel & beban IT | 400/230 V +5% / −10%; kritis di luar ±10% | Standar SR, SNI 04-0227-2003, ITI (CBEMA) Curve |
| Tegangan beban motor/kompresor | sama dengan FCU (SNI + ±10% rating nameplate) | SNI 04-0227-2003, NEMA MG-1 |
| Arus panel vs In nameplate | 80 / 100 % | Standar SR (beban ≤80% pengaman) |
| Ketidakseimbangan arus | 5 / 10 / 20 % | Standar SR (deviasi beban 10%) |
| Tegangan N-G | 2 / 5 V | Praktik kualitas daya peralatan IT (batas internal) |
| Suhu sambungan/breaker (thermal imager) | >40 °C peringatan, >70 °C kritis | Standar SR, NETA MTS-2019 Tabel 100.18 |
| Resistans pembumian | <5 ohm (LPS <10 ohm) | Standar SR, IEC 60364 / PUIL 2011; IEC 62305-3 |
| Getaran motor/pompa | awal zona C / D sesuai kelas daya nameplate (I ≤15 kW, II 15-75 kW, III >75 kW) | ISO 10816-1 |
| Getaran genset | naik 25 / 50 % dari baseline | ISO 10816-1 kriteria II |
| Kebisingan motor door/dock leveler | 75 dB(A), atau naik ≥3 dB | Standar SR |
| Frekuensi | 49,8–50,2 Hz | Aturan Jaringan Jawa-Madura-Bali |
| Faktor daya | <0,85 peringatan | Tarif PLN (Permen ESDM 28/2016) |
| THD tegangan | 8 % | IEEE 519-2014 |
| Tegangan 20 kV | +5% / −10% | SPLN 1:1995 |
| Tegangan baterai | turun 2 / 3 / 5 % dari baseline | Kurva tegangan istirahat lead-acid |
| Suhu baterai UPS | 27 / 33 °C | IEEE Std 1188 |
| Beban UPS | 80 / 90 / 100 % | Praktik operasi UPS (batas internal) |
| Iluminasi LED | turun 20 / 30 % dari baseline | IES LM-80/TM-21 (L70) |
| Kapasitansi | berubah 5 / 10 % dari baseline | Standar SR (±10% nameplate) |
| Tekanan R32 AC split | 115–145 psi | Template PM AC Split |
| Leveling lift | 10 / 20 mm | EN 81-20:2014 |
| Kebocoran radiasi X-ray | 0,5 / 5 µSv/jam | Perka BAPETEN 4/2013, 21 CFR 1020.40 |
| Tabung agen FSS | tekanan turun 5 / 10 %, berat agen turun 3 / 5 % dari baseline | NFPA 2001 |
| Kesadahan air hasil softener | >17,1 mg/L (1 gpg) peringatan, >60 mg/L kritis | NSF/ANSI 44, klasifikasi USGS |
| pH air softener | 6,5–8,5 | Permenkes 2/2023 |
| Pressure drop softener | >1 bar (15 psi) peringatan; nilai negatif = peringatan | NSF/ANSI 44 |

Parameter tanpa standar absolut (arus netral, daya kW, arus 20 kV, suhu trafo isolasi, tegangan panel surya, tekanan refrigeran VRV/AHU, aliran sampling VESDA, kesadahan air baku, TDS, tekanan inlet/outlet softener) hanya dipantau trennya atau dibandingkan dengan baseline unit.

**Pemetaan kartu.** Label kartu dicocokkan ke parameter: label persis dulu ("R-S", "Measurement Ampere N"), lalu kata kunci. Kartu pekerjaan (*Cleaning*, *Tightening*, *Lubrication*) tidak pernah dibaca sebagai alat ukur. Bila beberapa kartu cocok ke parameter yang sama, label paling persis yang dipakai ("Capacitance Measurement" mengalahkan "Inspection capacitance values"). Kartu yang tidak dikenali dinilai secara visual. Akun tanpa template kartu (FSS, Water Softener) memakai kata kunci istilah yang lazim ditulis engineer; kartu pertama yang cocok dipakai, jadi kartu spesifik (mis. "Hardness Inlet", "Pressure Outlet") ditaruh sebelum kata kunci umum ("Hardness", "Pressure").

**Per quarter.** Tombol **Predictive per Quarter** di header Arsip Dokumen membuat predictive seluruh laporan PM dalam satu quarter sekaligus (alur sama: baca foto, konfirmasi angka per laporan, analisis urut tanggal), lalu mengunduh satu PDF/DOCX gabungan. Laporan dikelompokkan per **akun + jenis unit**: akun yang punya laporan beberapa jenis unit (mis. ATS dan Genset) memilih kelompoknya dulu, dan setiap kelompok dianalisis dengan profilnya sendiri.

**VRV & AHU.** Unit indoor dan outdoor disimpan sebagai laporan PM terpisah. Beri nama unit berbeda (mis. `VRV-01 Indoor` dan `VRV-01 Outdoor`) agar riwayatnya tidak tercampur.

**Riwayat hemat kuota.** Seluruh deret angka per parameter disimpan di dokumen predictive (`pm_predictive_reports`), sehingga kuartal berikutnya cukup membaca **satu** dokumen predictive sebelumnya, bukan laporan PM lama. Predictive pertama sebuah unit menjadi baseline. Kunci riwayat adalah akun + nama unit, jadi penamaan unit harus konsisten antar kuartal.

**Biaya AI.** Sekitar 8 panggilan per predictive FCU (3 batch baca foto, 4 narasi equipment, 1 ringkasan), memakai pool key Gemini gratis yang sama dengan fitur AI lain. Akun lain bergantung jumlah kartu: satu batch baca per 6 foto, satu narasi per equipment, satu ringkasan (mis. ATS 19 kartu ≈ 4 + 4 + 1 = 9 panggilan; Cooling Tower 37 kartu ≈ 7 + 4 + 1). Bila AI tidak tersedia, angka bisa diisi manual dan narasi dibuat otomatis.

**PDF & DOCX** (`utils/PmPredictivePdfExport.ts`, `utils/PmPredictiveWordExport.ts`, helper bersama `utils/pmPredictiveExportShared.ts`): kop surat di setiap halaman, identitas dan foto nameplate, ringkasan eksekutif (termasuk equipment yang tidak dianalisis), bagian per equipment (nilai, nilai sebelumnya, tren per kuartal, batas acuan, status, proyeksi, narasi, dan **dokumentasi foto** kartu PM yang dipakai beserta angka hasil bacanya), lampiran dasar batas acuan, dan lembar pengesahan. Foto diambil dari laporan PM sumber dan dikecilkan di browser sebelum dimasukkan ke dokumen.

**Menambah jenis unit**: buat profil baru di `config/pmPredictiveProfiles.ts` (akun, potongan email bila perlu (`accountIncludes`), pola nama, pemetaan kartu → parameter, batas acuan beserta sumbernya, pengelompokan equipment, contoh nama unit, petunjuk nameplate). Blok bersama (`VOLTAGE_CARDS`, `voltageParams`, `currentParams`, `EARTH`, `THERMAL`, `vibrationParam`, dan lainnya) bisa dipakai ulang. Id parameter tegangan/arus harus tetap (`v_rs`, `i_r`, ...) karena parameter turunan dihitung dari id tersebut. Mesin hitung dan UI membaca profil tersebut, lalu uji dengan `npm run test:pm-predictive` (`scripts/test-pm-predictive-profiles.mjs` memeriksa integritas profil dan pemetaan kartu template tiap akun).

### 📈 Predictive Maintenance CM & Periodik

- **Predictive dari temuan/CM** (`PredictiveReportModal.tsx`) dan **predictive periodik bulanan & tahunan** (`PeriodicPredictiveModal.tsx`).
- **AI berbasis bukti** (`aiPredictiveAgent.ts`, `aiPeriodicPredictiveAgent.ts`) lewat backend `/api/ai/chat`, dengan fallback heuristik bila AI tidak tersedia.
- **Lembar pengesahan 5 peran**, reviewer Site Manager, persetujuan berjenjang TDE, CBRE, dan Manajemen Fasilitas.
- **Kop surat di setiap halaman** dan proteksi agar lembar pengesahan tidak terpotong di Word (`PredictiveReportWordExport.ts`) maupun PDF (`PredictiveReportPdfExport.ts`).
- **RUL (Remaining Useful Life)** dan matriks urgensi 2×2.

### 📑 Monthly Report Generator (13 Bab)

Menu **Monthly Report (1-Klik)** untuk DME, Site Manager DME, dan `dwimitra@co.id` (`MonthlyReportGenerator.tsx`, `generateMonthlyReportDOCX.ts`).

- **13 bab DOCX**: Executive Summary, Key Highlight, General Information, Maintenance Objectives, Equipment and System Details, Scope of Work, Observation and Finding, Repairs/Replacement & Services, Testing & Validation, Challenges/Mitigation & Lesson Learned, Recommendations & Future Action, Photo & Documentation Log, dan Appendices.
- **Observation & Finding (Bab 7)** memakai sumber data yang sama dengan Pusat Temuan Abnormal (`abnormalFindingsData.ts`), sehingga jumlah temuan per bulan selalu identik, lengkap dengan RCA agentic dari AI. RCA boleh tanpa foto.
- **AI menyusun** Executive Summary, Bab 9 (metode uji & validasi, termasuk profil Water & Fuel Leak), Bab 10 (tantangan, mitigasi, lesson learned), dan Bab 11 (rekomendasi).
- **Pilihan CI Name dari BOQ** dan sinkronisasi tabel peralatan PM ke tabel turunan.
- **Arsip aman ukuran**: gambar besar dipindah ke subkoleksi `monthly_reports/{id}/assets` (satu dokumen per gambar). Tersedia setup periode, archive picker, lanjut edit, dan tombol simpan melayang anti-duplikasi.
- **Format NeutraDC**: cover, lembar pengesahan 6 orang, heading 11 pt, teks 10 pt, tabel 9 pt.

### 📋 SOP & EOP

Pusat penyusunan prosedur (`SOPEOPManagement.tsx`) untuk akun Dwimitra dan Site Manager DME.

- **Struktur standar**: SOP 14 seksi dan EOP 8 seksi.
- **Import DOCX sesuai dokumen asli** (`sopEopDocxImport.ts`): judul diambil dari nama file, tabel peralatan mempertahankan kolom dokumen asli, checklist Section 4 tampil sebagai grid kotak.
- **Export DOCX** (`sopEopDocxExport.ts`) identik dengan master dokumen NeutraDC/DME, dengan pilihan **bilingual EN + ID** atau **full Bahasa Indonesia** per dokumen. Ekspor PDF juga tersedia.
- **Terjemahan AI** lewat backend `/api/ai/chat`; teks netral bahasa (angka, kode, nama alat) tidak dianggap gagal.
- **Arsip** di koleksi `sop_eop_documents` dengan pilih semua dan hapus massal.

### 🌐 Bilingual MOP & Arsip MOP

Menu **Bilingual MOP** (`MOPBilingual.tsx`) untuk akun `dwimitra@co.id`, `johansmdme@dwimitra.id`, dan QC DME. Daftar akun ini harus sama di tiga tempat: `utils/mopBilingualAccess.ts`, `backend/core/controllers/mop_controller.go`, dan `firebase/firestore.rules`.

1. Upload satu file Word MOP (maks 15 MB).
2. AI tier gratis menerjemahkan seluruh dokumen dan menandai baris yang perlu dicek.
3. Review dan edit berdampingan EN | ID.
4. Simpan DOCX bilingual ke **Arsip MOP** (`mop_bilingual` + subkoleksi `chunks`).

Hasilnya mempertahankan layout asli: baris Indonesia (miring, abu-abu) disisipkan di bawah tiap paragraf Inggris, termasuk isi sel tabel, dan judul section EN/ID sejajar di semua varian template. Label formulir, baris pilihan frekuensi bercentang, dan isi tabel aset Section 2 MOP PM sengaja tidak diterjemahkan.

Backend: `POST /api/mop/translate`, model dari `MOP_TRANSLATE_MODELS` (default `gemini-3-flash-preview`, lalu `gemini-3.5-flash`). Key yang kena batas kuota langsung diganti.

### 🗂 MOP Workflow, Monitoring & PIR

- **MOP Workflow** (`MOPWorkflow.tsx`): Kanban 4 kolom (Draft, Review OCS, Review TDE, Completed), upload PDF ber-chunk ke Firestore, catatan inline, dan pelacakan progres.
- **MOP Monitoring** (`MOPMonitoringDashboard.tsx`): distribusi status, tren bulanan, dan tabel ringkasan.
- **Post Incident Report** (`PIRManagement.tsx`, `PIRReportPdfExport.ts`): wizard multi-langkah, matriks tanda tangan 3 kolom anti terpotong, tipografi Century Gothic 10 pt, grid foto dan tabel tindakan korektif.
- **Berita Acara** (`BeritaAcaraReport.tsx`, `generateBeritaAcaraDOCX.ts`): pilih equipment dan CI Name dari BOQ, lalu buat DOCX; arsip di `berita_acara`.

### 🚨 Abnormal Findings Center

- **Temuan otomatis dari checklist PM** dan **temuan manual** (`ManualAbnormalFinding.tsx`) dalam satu pusat (`AbnormalFindingsCenter.tsx`).
- **Catat abnormal dari Arsip Dokumen** (`AbnormalReportModal.tsx`) dengan foto bukti opsional, dan kembalikan status ke Normal bila kendala selesai.
- **Preset akun khusus** (mis. `pju@gmail.com`, water softener) mengisi template temuan, deskripsi, dan rekomendasi awal.
- **Filter rentang bulan**, filter unit/lokasi/status, urutan stabil berdasarkan waktu upload, dan foto *before/after*.
- **Ekspor rekap Word & Excel** (`AbnormalRecapWordExport.ts`).
- **Badge jumlah** dihitung dengan `getCountFromServer` dan diperbarui tiap 5 menit agar hemat kuota.

### ⚡ Corrective Maintenance, SLA/SLG & Arsip Standby

- **Laporan CM 3 halaman** (`CMReportFormModal.tsx`) dan audit **SLA/SLG**: response time dan resolution time per prioritas, dengan *Restore Time* target 180 menit dipisah dari *Resolution Time*.
- **Kategori sparepart**: DME Sparepart, Consumable Part, dan Non-Sparepart.
- **Rekap CM multi-bulan** (`CMMonthlyRecapExport.ts`) ke Word dan Excel: tabel *solved* dan *pending* terpisah, kolom rekomendasi, dan foto before-after yang hemat halaman.
- **Arsip Standby**: filter Quarter Q1–Q4 di folder SLA/SLG dan filter status revisi. Daftar dimuat lewat Firestore REST dengan field mask (`firestoreRestQuery.ts`), jadi foto tidak ikut diunduh dan daftar terbuka cepat.
- **Cascade delete**: menghapus SLA/SLG ikut membersihkan entri CM terkait.

### 📁 Management File

Repositori berkas terpusat (`FileManagement.tsx`) yang tersedia untuk hampir semua role.

- **22 kategori folder** (`config/fileFolders.ts`), termasuk Laporan Harian/Bulanan, Checklist Alat/APD, JSEA, MOP, Risk Register, D-DAY, BA, Report CM, Form SLA/SLG, Report PIR, SLD, Layout, Service Report (dan versi Approved), Predictive Report, serta **Weekly HSE Report** dan **Monthly HSE Report**.
- **46 jenis maintenance** dan pengelompokan per Quarter Q1–Q4.
- **Upload ber-chunk ke Firestore** untuk berkas PDF/Excel besar. Upload membutuhkan internet.
- **Rename berkas** khusus QC DME. Role lain mengajukan hapus, dan QC DME menyetujui hapus permanen di menu **Pengajuan Hapus**.
- **Ekspor ZIP** per kategori dan notifikasi berkas baru di Notification Center.

### 📐 Drafter & Update BOQ per Ruangan

Role **Drafter** (`DrafterApp.tsx`) hanya melihat **Management File** dan **Update BOQ** (`BOQUpdate.tsx`). Detail lengkap ada di [`docs/drafter-boq.md`](docs/drafter-boq.md).

- **Per ruangan**: daftar ruangan → aset per kategori → halaman item. Baseline berasal dari spreadsheet *Progres PM Q3 - 2026* (2.652 item, 41 tabel aset), dibundel di `frontend/data/boqItems.json`.
- **Foto dengan kamera langsung** (watermark nama aset, ruangan, waktu, GPS) sampai resolusi 4096×3072, atau upload dari galeri.
- **Field yang bisa diedit**: CI Name, CI Description, Capacity, Serial Number, Production Year, Manufacturer, Asset ID, TAG, dan Model/Version. Item yang diubah diberi badge "Diedit".
- **Antrean offline** (`utils/boqOutbox.ts`): semua perubahan disimpan dulu di IndexedDB lalu dikirim ulang otomatis dengan backoff. Foto diunggah per chunk 256 KB dan bisa dilanjutkan bila terputus. Konflik teks digabung per field; field yang diubah dua pihak ditampilkan untuk dipilih.
- **Ekspor Excel per ruangan** dengan foto dan sel yang diedit diberi warna (`boqDrafterExcelExport.ts`).
- Firestore `boq_items/{itemId}` hanya menyimpan perubahan; foto di `boq_items/{itemId}/photos/{sha256}`.
- Menu **Master Asset & BOQ** (`BOQMasterAsset.tsx`) untuk DME, Site Manager DME, admin, dan Dwimitra menampilkan inventaris aset dan sparepart.

### 📜 PTW & Register Nomor PTW

- **PTW** (`PTWManagement.tsx`): filter rentang tanggal, pembagian minggu 1–5, grafik tren mingguan, dan kewajiban upload dokumen bertanda tangan TDE.
- **Parser PDF PTW** (`ptwPdfParser.ts`): ekstraksi teks dengan pdf.js, OCR Tesseract untuk hasil scan.
- **Register Nomor PTW** (`PTWNumberRegister.tsx`, khusus admin): pencatatan nomor PTW berbentuk teks tanpa PDF, di koleksi `ptw_numbers` dengan ID `{tahun}-{nomor}`. Input lewat form (Equipment, Quarter, Nomor PTW) atau **import massal dari salinan chat WhatsApp** (`ptwTextImport.ts`).

### 🦺 HSE & K3

Role HSE memakai `HSEApp.tsx`: Buat Inspeksi, Absen TBM, Safety Induction, Input Temuan K3, Arsip Temuan HSE, Arsip Dokumen HSE, dan Management File.

- **Absensi TBM dan Safety Induction multi-foto** dengan kompresi foto di browser (`imageCompression.ts`, termasuk HEIC).
- **Generator PDF**: Berita Acara TBM, Safety Induction, Rekap Inspeksi HSE, dan Temuan HSE (varian kop NeutraDC dan UTT).
- **Filter MSDS** di laporan HSE Inspection untuk admin.
- **Arsip K3 & HSE** (`HSEArchiveHub.tsx`) dengan unduhan foto satuan dan ekspor ZIP massal.
- **Tautan publik laporan HSE**: `https://dwimitrasystem.com/hse/<id>` membuka viewer laporan tanpa login.

### 📷 Smart Camera & GPS Watermark

`CameraModal.tsx` menyematkan tanggal & waktu, koordinat GPS, alamat hasil reverse geocoding, serta branding NEUTRADC dan DWIMITRA ke foto. Senter memakai beberapa strategi constraint kamera dengan fallback layar putih (*screen flash*). Mode resolusi penuh dipakai untuk foto BOQ.

### 📄 Upload SR, Paper Digitizer & WhatsApp

- **Upload Service Report** (`UploadSRModal.tsx`): Excel (.xlsx/.xls) diparsing ke format service report (`excelSrParser.ts`) dan dirender ke PDF A4 yang mengikuti tampilan cetak Excel aslinya (`excelToPdfConverter.ts`). PDF siap jadi juga bisa diunggah.
- **Paper Report Digitizer** (`PaperReportDigitizerModal.tsx`): foto checklist kertas diekstrak dengan Tesseract.js atau Gemini menjadi laporan digital.

### 📱 PWA, Offline & Update Aplikasi

- **Bisa dipasang** sebagai aplikasi "Dwimitra System" di HP dan desktop.
- **Simpan tanpa sinyal** (`utils/offlineWrite.ts`): tulisan Firestore masuk antrean lokal dan terkirim otomatis begitu sinyal kembali, termasuk setelah aplikasi ditutup dan dibuka lagi. Tombol Simpan langsung lepas saat offline (toast "Tersimpan di HP") dan paling lama ±6 detik saat sinyal lemah. Berlaku untuk form CM, SLA, PIR, HSE, TBM, Safety Induction, temuan, PTW baru, absensi, progres Site Manager, Upload SR, dan Input Abnormal Manual. Catatan lengkap ada di [`docs/offline-save-notes.md`](docs/offline-save-notes.md).
- **Penanda offline** (`OfflineBanner.tsx`) dan peringatan saat logout bila masih ada data yang belum terkirim.
- **Update aplikasi aman** (`AppUpdateDialog.tsx`, `utils/appUpdate.ts`, `utils/updateRecovery.ts`): versi baru tidak langsung me-reload halaman. Aplikasi menunggu pekerjaan aktif selesai, menyimpan draft formulir yang terbuka, memuat ulang, lalu memulihkan draft tersebut (berlaku 24 jam).
- **Tombol Back Android** (`utils/pwaBackGuard.ts`): menutup popup dulu, bukan langsung keluar aplikasi.
- **Draft laporan** disimpan di IndexedDB (`draftStorage.ts`, `offlineReportStorage.ts`).

### 🧭 Navigasi & UI/UX

- **URL sebagai sumber navigasi** (`utils/appNavigation.ts`, `hooks/useAppNavigation.ts`): setiap menu dan folder punya path sendiri (mis. `/arsip-dokumen`), state tambahan disimpan di query `nav.*`, dan tombol Back/Forward browser berfungsi. Satu interaksi menghasilkan satu entri riwayat.
- **Sidebar** (`AppSidebar.tsx`) dengan pengelompokan Monitoring & Kontrol, Operasional & K3, Dokumentasi & Laporan, serta Standar & Aset; bisa diciutkan di desktop dan menjadi drawer di HP.
- **Kunci scroll latar** saat modal terbuka (`modalScrollLock.ts`).
- **Toast di HP** muncul di bawah top bar agar tombol menu tidak tertutup.

---

## 📁 Struktur Proyek

```text
DwimitraSystem/
├── api/index.go                  # Entry Vercel Function: semua /api/* → router Go
├── backend/
│   ├── cmd/api/                  # Entry server lokal (main, bootstrap, server, graceful, flags)
│   ├── core/
│   │   ├── config/               # Firebase, env helper, logger
│   │   ├── controllers/          # ai, auth, report, user, archive, audit, finding, health,
│   │   │                         # maintenance_progress, mop, pm_predictive
│   │   ├── middlewares/          # RequestID, logger, panic recovery, security headers, CORS, rate limit, auth
│   │   ├── models/               # DTO & validasi
│   │   ├── repositories/         # Akses Firestore
│   │   ├── routes/               # routes.go (dependency injection) & api_routes.go (dispatch + throttle)
│   │   └── services/             # ai_service (key pool + kuota), mop_translate_*, pm_predictive_service,
│   │                             # turnstile, report, user, dll.
│   └── pkg/                      # helpers, logger (slog), sanitizer
├── frontend/
│   ├── App.tsx                   # Routing per role + viewer publik HSE (/hse/<id>)
│   ├── main.tsx                  # Entry React + registrasi service worker
│   ├── api/                      # firebase.ts (SDK client), boq.ts
│   ├── pages/                    # MainApp, AdminDashboard, SiteManagerDashboard, DMEDashboard,
│   │                             # HSEApp, DivisionApp, DrafterApp, Login
│   ├── components/               # Modul UI + ui/ (primitive Radix)
│   ├── config/                   # fileFolders, pmPredictiveProfiles, serviceReportRegistry,
│   │                             # pdfTemplateRegistry, templates
│   ├── hooks/                    # useAppNavigation, useAppUpdateDraft, usePresence, ...
│   ├── service_reports/          # Generator PDF/Excel service report per jenis peralatan
│   ├── types/                    # DTO per modul
│   ├── utils/                    # Ekspor dokumen, klien AI, offline & PWA, navigasi, predictive engine
│   ├── data/                     # boqItems.json (baseline BOQ), boqAssetData.ts, monthlyReportBoqData.ts (BOQ Monthly Report, scripts/sync_monthly_report_boq.cjs)
│   └── themes/                   # Tailwind & tema
├── firebase/
│   ├── firestore.rules           # Security Rules per koleksi & role
│   └── firestore.indexes.json
├── scripts/                      # Tes (test-*.mjs), import BOQ, set role drafter, skrip audit data
├── docs/                         # drafter-boq.md, offline-save-notes.md, Guidelines.md
├── firebase.json                 # Hosting (header keamanan, cache SW) & Firestore
├── vercel.json                   # Vercel Function api/index.go (maxDuration 60 s) & rewrite /api
├── vite.config.ts                # Alias @/ → frontend/, manifest PWA, proxy /api → :8080
└── package.json
```

---

## 📡 API Reference

Base URL produksi diatur lewat `VITE_API_URL` (saat ini `https://utt-report-maintenance.vercel.app`). Saat development `VITE_API_URL` dikosongkan, dan Vite meneruskan `/api` ke backend lokal `http://localhost:8080`.

Semua endpoint kecuali health check mewajibkan `Authorization: Bearer <firebase_id_token>`.

Tier throttle: 🔴 **Heavy** 5 rps (burst 10), 🟢 **Standard** 20 rps (burst 40). Di atasnya ada rate limiter global 20 rps (burst 40).

| Method | Endpoint | Deskripsi | Tier |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health`, `/api/ready`, `/api/metrics` | Liveness, readiness, metrik runtime (publik) | — |
| `POST` | `/api/auth/login` | Login (Turnstile + Firebase) | Global |
| `POST` | `/api/auth/proxy-login` | Login lewat backend bila jaringan memblokir Firebase | Global |
| `POST` | `/api/auth/logout` | Akhiri sesi | Global |
| `GET` | `/api/auth/me` | Profil & role pengguna aktif | Global |
| `POST` | `/api/ai/{ats,fcu,pju,pdu,ct,generator,trafo,acsplit,busduct,dockleveler,door,capacitorbank,ldbrdb}-report` | Analisis foto service report per jenis peralatan | 🔴 |
| `POST` | `/api/ai/digitize-paper-report` | Digitasi checklist kertas | 🔴 |
| `POST` | `/api/ai/validate-form` | Validasi isi formulir inspeksi | 🔴 |
| `POST` | `/api/ai/analyze-card` | Analisis satu foto kartu inspeksi | 🔴 |
| `POST` | `/api/ai/chat` | Chat Copilot (juga dipakai SOP/EOP & predictive CM) | 🔴 |
| `POST` | `/api/ai/pm-predictive/extract` | Baca angka display, nameplate, dan kondisi visual dari foto kartu PM (maks 8 foto per request) | 🔴 |
| `POST` | `/api/ai/pm-predictive/analyze` | Narasi per equipment dan ringkasan Predictive Report | 🔴 |
| `POST` | `/api/mop/translate` | Terjemahan segmen MOP EN → ID (akun Bilingual MOP) | 🔴 |
| `POST` | `/api/report` | Buat laporan beserta foto | 🔴 |
| `GET` | `/api/reports`, `/api/report/:id` | Daftar & detail laporan | 🟢 |
| `DELETE` | `/api/report/:id` | Hapus laporan | 🔴 |
| `GET` | `/api/archive`, `/api/archive/:id` | Daftar & detail arsip | 🟢 |
| `DELETE` | `/api/archive/:id` | Hapus permanen arsip | 🔴 |
| `POST` | `/api/findings` | Catat temuan | 🔴 |
| `GET` | `/api/findings` | Daftar temuan | 🟢 |
| `DELETE` | `/api/findings/:id` | Hapus temuan | 🔴 |
| `GET` | `/api/maintenance-progress`, `/api/maintenance-progress/summary` | Progres PM & ringkasannya | 🟢 |
| `POST` | `/api/maintenance-progress`, `/api/maintenance-progress/end-day` | Buat progres & laporan akhir hari | 🔴 |
| `PATCH` / `DELETE` | `/api/maintenance-progress/:id` | Ubah / hapus progres | 🔴 |
| `GET` | `/api/users`, `/api/users/:id` | Daftar & profil pengguna | 🟢 |
| `PATCH` | `/api/users/:id/role` | Ubah role (profil + custom claim) | 🔴 |
| `DELETE` | `/api/users/:id` | Nonaktifkan akun | 🔴 |
| `GET` | `/api/audit`, `/api/audit/me` | Jejak audit | 🟢 |

Batas fungsi Vercel: 60 detik per request dan body maksimal 4,5 MB. Karena itu foto predictive dikirim per batch dan dikompresi di browser.

---

## 🗄 Koleksi Firestore

| Koleksi | Isi |
| :--- | :--- |
| `users` | Profil dan role pengguna |
| `pdf_documents`, `excel_documents` (+ `photos`) | Laporan PM/service report engineer (Arsip Dokumen) |
| `service_reports` (+ `chunks`), `service_report_templates` | Service report dan template PDF per akun |
| `pm_predictive_reports` | Predictive Report dari laporan PM (ID = ID laporan PM sumber) |
| `predictive_reports`, `periodic_predictive_reports` | Predictive CM dan periodik |
| `findings` | Temuan abnormal manual |
| `corrective_reports`, `sparepart_logs` | Corrective Maintenance dan sparepart |
| `maintenance_progress` | Progres PM harian (Site Manager) |
| `monthly_reports` (+ `assets`) | Arsip Monthly Report |
| `sop_eop_documents` | SOP dan EOP |
| `mop_workflows`, `draft_chunks`, `ocs_approved_chunks`, `tde_approved_chunks` | MOP Workflow dan berkasnya |
| `mop_bilingual` (+ `chunks`) | Arsip MOP bilingual |
| `ptw_records` (+ `chunks`), `ptw_numbers` | PTW dan register nomor PTW |
| `hse` (+ `photos`, `chunks`), `hse_findings` | Laporan dan temuan HSE |
| `absen_tbm`, `absen_induction`, `absen_induction_chunks` | Absensi TBM dan Safety Induction |
| `files` (+ `chunks`), `uploaded_files` | Management File |
| `boq_items` (+ `photos`, `chunks`) | Perubahan BOQ dari Drafter |
| `berita_acara` | Berita Acara |
| `notifications` | Notification Center |
| `system_status`, `standby_kpi_inputs` | Kuota AI harian dan input KPI standby |

---

## 🔒 Keamanan

### Cloudflare WAF & Turnstile

- WAF 4 lapis di edge Cloudflare: *Managed Challenge* untuk trafik luar Indonesia, blokir bot dan scraper, blokir request tanpa User-Agent, dan tolak akses langsung ke IP atau host header palsu.
- Turnstile CAPTCHA di halaman login, diverifikasi di backend (`turnstile_service.go`).

### Firestore Security Rules

- Akses memerlukan login, kecuali pembacaan publik yang memang disengaja (mis. tautan laporan HSE).
- Hak akses ditentukan per koleksi dan role. Role diambil dari custom claim dan profil pengguna.
- Drafter diisolasi dari koleksi yang tidak berkaitan dengan BOQ dan Management File.
- Hapus permanen hanya oleh QC DME; role lain mengajukan hapus.
- Validasi bentuk data, misalnya batas jumlah field, ID predictive harus sama dengan ID laporan sumber, dan `revision` BOQ harus naik tepat satu.

### Backend

```text
Request → RequestID → Logger (slog) → PanicRecovery → SecurityHeaders → CORS Whitelist → RateLimiter → Firebase Auth → Route
```

Endpoint AI dan predictive menolak role Drafter. Ukuran body dan jumlah foto divalidasi sebelum diteruskan ke AI.

### Rahasia & variabel `VITE_*`

- Key AI hanya disimpan di environment backend (Vercel, tipe Secret).
- Jangan menaruh rahasia di variabel `VITE_*`. Semua variabel `VITE_*` yang dibaca kode frontend ikut tertanam di file JavaScript publik saat build. Layanan berbayar yang butuh key (seperti TTS) harus dipanggil lewat backend.

---

## 🚀 Getting Started

### Prasyarat

- **Node.js 24** (dipakai juga oleh tes `node --test` yang mengimpor file TypeScript)
- **Go 1.26+** (`toolchain go1.27.3` di `go.mod` diunduh otomatis)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Vercel CLI** (opsional, `npx vercel`)

### Instalasi

```bash
git clone https://github.com/gariiriana/utt-report-maintenance.git
cd utt-report-maintenance
npm install
npm run backend:build   # compile backend/server.exe
npm run dev             # Vite :5173 + backend Go :8080
```

`npm run backend` menjalankan `backend\server.exe`, jadi build ulang dengan `npm run backend:build` setiap ada perubahan backend.

### Environment Variables

Frontend (`.env.development`, `.env.production`):

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key

# Kosongkan saat development (pakai proxy Vite). Produksi: https://utt-report-maintenance.vercel.app
VITE_API_URL=
```

Backend (lokal: `.env` atau `.env.local` di akar proyek; produksi: Environment Variables di Vercel):

```env
PORT=8080
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=report-utt
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
TURNSTILE_SECRET_KEY=your_turnstile_secret
LOG_LEVEL=info

# AI. Nama NVIDIA_NIM_* dipertahankan demi kompatibilitas; di produksi mengarah ke Gemini.
NVIDIA_NIM_API_KEYS=gemini_key_1,gemini_key_2
NVIDIA_NIM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
NVIDIA_NIM_VISION_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_REASONING_MODEL=models/gemini-3.1-flash-lite
NVIDIA_NIM_CHAT_MODEL=models/gemini-3.1-flash-lite

# Opsional: urutan model untuk fitur tertentu (dipisah koma)
MOP_TRANSLATE_MODELS=models/gemini-3-flash-preview,models/gemini-3.5-flash
PM_PREDICTIVE_MODELS=models/gemini-3-flash-preview,models/gemini-3.5-flash
```

---

## 🧪 Testing

| Perintah | Cakupan |
| :--- | :--- |
| `npx tsc --noEmit` | Type check seluruh frontend |
| `npm run test:navigation` | Navigasi URL dan riwayat browser |
| `npm run test:pm-predictive` | Mesin Predictive Report: profil, pemetaan kartu, konversi satuan, batas SNI/NEMA, tren, proyeksi, narasi otomatis |
| `node --test scripts/test-sop-eop-docx.mjs <SOP.docx> <EOP.docx>` | Regresi import/export DOCX SOP & EOP (contoh dokumen Lobby Door) |
| `go test ./backend/...` | Backend Go: AI service, MOP translate, PM predictive, progres, report |

UI sebaiknya diuji dengan Firebase Emulator agar tidak memakai kuota baca Firestore produksi.

---

## 📂 Available Scripts

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Frontend (Vite :5173) dan backend Go (:8080) bersamaan |
| `npm run build` | Build frontend |
| `npm run build:prod` / `npm run build:dev` | Build frontend mode produksi / development |
| `npm run export:prod` / `npm run export:dev` | Build ke folder `export/production` / `export/development` |
| `npm run backend` | Jalankan `backend\server.exe` |
| `npm run backend:build` | Compile backend Go ke `backend\server.exe` |
| `npm run test:navigation` | Tes navigasi |
| `npm run test:pm-predictive` | Tes mesin Predictive Report |

---

## 🔑 Role System (RBAC)

Setiap role diarahkan ke halaman tersendiri oleh `App.tsx`. Menu di dalamnya mengikuti aturan `show` per role, dan akses data dijaga Firestore Rules.

| Role | Halaman | Ruang lingkup utama |
| :--- | :--- | :--- |
| `admin` | MainApp | Dashboard admin, Absen TBM/Induction, PTW & Register Nomor PTW, Arsip Standby, Arsip K3 & HSE, Master Asset & BOQ, BA Report, Management File |
| `qc_dme` (`qcdme@dme.com`) | MainApp | Pengajuan Hapus (hapus permanen), Temuan Abnormal lintas akun, rename berkas, Bilingual MOP |
| `engineer` | MainApp | Buat Laporan, Arsip Dokumen (termasuk Predictive AI untuk akun FCU), PTW, Arsip Temuan, Management File |
| `standby_engineer` | MainApp | Corrective Maintenance, SLA/SLG, Arsip Standby, Arsip Temuan, Management File |
| `Engineer_K2` / `engineer_k2` | MainApp | Buat Laporan, Arsip Dokumen, Report PIR |
| `DME` | MainApp | PM Schedule, Monthly Report (1-Klik), Master Asset & BOQ, BA Report, detail laporan |
| `site_manager_dme` | DMEDashboard | Monitoring, Arsip Standby, Monthly Report, MOP Workflow, SOP & EOP, Bilingual MOP, Management File |
| `site_manager` / `manager` | SiteManagerDashboard | Ringkasan progres PM, input data progres, Management File |
| `hse` | HSEApp | Inspeksi, Absen TBM, Safety Induction, temuan K3 dan arsipnya, Arsip Dokumen HSE, Management File |
| `drafter` | DrafterApp | Hanya Management File dan Update BOQ (tanpa Chat Copilot) |
| `pmo`, `sales`, `presales`, `purchasing` | DivisionApp | Dokumen ISO per divisi |
| `dirut`, `direksiSDM`, `DireksiKeuangan` | DivisionApp | Registri eksekutif (baca) |
| `tde`, `cbre` | MainApp | Sesuai menu dan rules |

Akun khusus:

- **Akun maintenance per peralatan** (`ats@gmail.com`, `fcu@gmail.com`, ...): role `engineer` dengan template service report per akun. Akun yang punya profil di `config/pmPredictiveProfiles.ts` mendapat tombol Predictive AI di Arsip Dokumen.
- **`dwimitra@co.id`**: SOP & EOP, Monthly Report, BA Report, Arsip Standby, Bilingual MOP.
- **`johansmdme@dwimitra.id`**: Bilingual MOP.
- **`pju@gmail.com` dan akun water softener**: preset template temuan abnormal manual.

Role harus diset di profil Firestore **dan** custom claim Firebase Auth (lihat `scripts/set-drafter-role.cjs` atau `PATCH /api/users/:id/role`). Pengguna perlu login ulang agar claim baru terbaca.

---

## 🌐 Deployment

Untuk fitur yang menyentuh rules dan backend, deploy dengan urutan berikut agar frontend baru tidak memanggil sesuatu yang belum ada:

```bash
# 1. Firestore Security Rules (dan indexes bila berubah)
firebase deploy --only firestore:rules --project report-utt
firebase deploy --only firestore:indexes --project report-utt

# 2. Backend Go → Vercel (otomatis saat push ke main)
git push origin main
npx vercel ls            # pastikan deployment Production berstatus Ready

# 3. Frontend → Firebase Hosting
npm run build:prod
firebase deploy --only hosting --project report-utt
```

Setelah hosting baru dirilis, aplikasi yang sedang terbuka menampilkan dialog update dan memuat ulang setelah draft disimpan.

Batas operasional:

- **Firestore (Spark)**: 50.000 baca per hari, reset tengah malam waktu Pasifik (sekitar 14.00–15.00 WIB). Error `resource-exhausted` / 429 berarti kuota harian habis.
- **Vercel Functions**: 60 detik per request dan body maksimal 4,5 MB.
- **Gemini tier gratis**: kuota harian per key dipakai bersama oleh semua fitur AI.

---

## 📄 License

Sistem ini bersifat **privat dan rahasia**, dikembangkan secara eksklusif untuk kebutuhan operasional **PT Dwimitra Ekatama Mandiri** dalam melayani fasilitas data center **PT United Transworld Trading (UTT)** di kawasan **Neutra DC Cikarang**. Seluruh kode sumber, arsitektur, dan dokumentasi ini merupakan properti intelektual yang dilindungi undang-undang.

---

*Built with passion & precision by [Gari Iriana](https://github.com/gariiriana)*
