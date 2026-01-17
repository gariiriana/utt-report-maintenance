## 📋 Deskripsi

**UTT Report Maintenance** adalah aplikasi web modern untuk dokumentasi foto maintenance data center yang dirancang khusus untuk PT United Transworld Trading. Aplikasi ini memungkinkan engineer untuk membuat laporan maintenance dengan foto-foto dokumentasi, lalu mengekspor ke format Excel atau PDF dengan layout profesional dan logo perusahaan.

### 🎯 Tujuan Project

- ✅ Mempermudah engineer dalam membuat laporan maintenance dengan foto
- ✅ Standarisasi format laporan dengan logo dan layout yang konsisten
- ✅ Arsip digital semua dokumen maintenance di cloud (Firestore)
- ✅ Akses mudah untuk re-download dokumen yang pernah dibuat
- ✅ Admin dashboard untuk monitoring semua aktivitas dokumentasi

  ## ✨ Features

### 🔐 Authentication & Authorization
- **Firebase Authentication** - Login dengan email/password
- **Auto-create User Document** - User profile otomatis dibuat saat login pertama
- **Role-based Access Control** - Admin memiliki akses penuh ke semua dokumen
- **Secure Firestore Rules** - User hanya bisa akses dokumen mereka sendiri

### 📝 Create Report
- **Input Metadata** - Nama maintenance, waktu, dan detail spesifik (unit/ruangan)
- **Photo Cards** - Upload foto dengan deskripsi dalam grid layout
- **Drag & Drop** - Upload foto dengan mudah
- **Image Preview** - Preview foto sebelum export
- **Dual Export** - Export ke Excel dan PDF sekaligus

### 📊 Excel Export
- **Professional Layout** - Grid 3 kolom dengan border tebal
- **Dual Logo** - Logo Dwimitra (kiri) dan NeutraDC (kanan)
- **Multi-page Header** - Header lengkap di setiap halaman (setiap 9 foto)
- **Auto-sizing** - Kolom dan row disesuaikan otomatis
- **Base64 Storage** - Foto disimpan dalam format base64 di Firestore

### 📄 PDF Export
- **A4 Portrait** - Format standar untuk printing
- **Professional Header** - Logo + Title + Equipment di setiap halaman
- **Photo Grid** - 3 kolom x 3 baris per halaman (9 foto)
- **Caption Box** - Deskripsi di bawah setiap foto
- **Multi-page** - Otomatis buat halaman baru setiap 9 foto

### 🗂️ Document Archive
- **List View** - Semua dokumen yang pernah dibuat
- **Advanced Filter** - Filter by tanggal, search by nama, sort by terbaru/terlama
- **Document Type Filter** - Filter Excel only atau PDF only
- **Re-generate** - Download ulang Excel/PDF dari database
- **Delete Document** - Hapus dokumen dengan konfirmasi modal
- **Statistics** - Total dokumen, size, dan filter status

### 👨‍💼 Admin Dashboard
- **View All Documents** - Lihat semua dokumen dari semua user
- **User Statistics** - Total users, total dokumen, breakdown Excel/PDF
- **Advanced Filtering** - Search, date filter, type filter
- **Download Anyone's Document** - Admin bisa download dokumen siapa saja
- **Responsive Table** - Desktop table view, mobile card view

### 🎨 UI/UX
- **Modern Design** - Gradient biru dengan glassmorphism effect
- **Smooth Animations** - Motion/Framer Motion untuk animasi halus
- **Responsive** - Mobile-first design, responsive di semua device

  ## 🛠️ Tech Stack

### Frontend
- **⚡ Vite** - Build tool super cepat
- **⚛️ React 18** - UI library
- **🎨 Tailwind CSS v4** - Utility-first CSS framework
- **🔥 TypeScript** - Type safety
- **📦 Motion (Framer Motion)** - Animation library
- **🎯 React Router** - Client-side routing
- **🔔 Sonner** - Toast notifications

### Backend & Database
- **🔥 Firebase Authentication** - User authentication
- **🗄️ Cloud Firestore** - NoSQL database
- **🔒 Firestore Security Rules** - Row-level security

### Libraries & Tools
- **📊 ExcelJS** - Excel file generation
- **📄 jsPDF** - PDF file generation
- **🎭 Lucide React** - Icon library
- **🌐 Vercel** - Hosting & deployment

  ## 🚀 Usage

### 1️⃣ Login
- Gunakan email dan password yang sudah terdaftar
- Atau gunakan **Demo Account** (lihat Credentials di bawah)
- User document otomatis dibuat saat login pertama kali

### 2️⃣ Create Report
1. Klik tab **"Create Report"**
2. Isi form:
   - **Nama Maintenance** (contoh: Preventive Maintenance FCU)
   - **Waktu Maintenance** (pilih tanggal dari calendar)
   - **Detail Spesifik** (optional - contoh: FCU Ruang Server Lantai 2)
3. Tambah foto:
   - Klik card **"Click to upload photo"**
   - Atau drag & drop foto ke card
4. Isi deskripsi foto di setiap card
5. Klik **"Export to Excel"** atau **"Export to PDF"**
6. File otomatis terdownload DAN tersimpan di database

### 3️⃣ Document Archive
1. Klik tab **"Document Archive"**
2. Lihat semua dokumen yang pernah dibuat
3. Gunakan filter:
   - **Search** - Cari by nama maintenance
   - **Date** - Filter by tanggal
   - **Sort** - Terbaru atau terlama
   - **Type** - Excel only atau PDF only
4. Klik **Download** untuk re-generate dari database
5. Klik **Delete** untuk hapus dokumen

### 4️⃣ Admin Dashboard (Admin Only)
1. Login sebagai Admin (lihat credentials di bawah)
2. Klik tab **"Admin Dashboard"**
3. Lihat statistik:
   - Total Documents
   - Total Excel Files
   - Total PDF Files
   - Active Users
4. Filter & search dokumen dari semua user
5. Download dokumen siapa saja
- **Dark Theme** - Tema gelap dengan aksen biru/ungu
- **Toast Notifications** - Feedback real-time dengan Sonner
- **Loading States** - Skeleton dan spinner untuk loading state
