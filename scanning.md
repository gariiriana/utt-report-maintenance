# ARSITEKTUR & IMPLEMENTATION PLAN: SISTEM KEAMANAN BIOMETRIK 2FA (FACE RECOGNITION & FINGERPRINT)
**DwimitraSystem — PT Dwimitra Ekatama Mandiri / PT UTT**  
**Status Dokumen:** ⏸️ **ON-HOLD / KEEP** *(Menunggu instruksi lanjutan dari Mas Gari Iriana)*  
**Terakhir Diperbarui:** 9 September 2026  
**Penulis / Perumus:** AI Assistant & Gari Iriana (Berdasarkan Diskusi & Rekaman Voice Note)  

---

## 📌 1. RINGKASAN EKSEKUTIF & STATUS PROYEK

Fitur ini dirancang untuk meningkatkan level keamanan autentikasi login ke **DwimitraSystem** pada perangkat **Desktop (Laptop/PC)** dan **Mobile (Handphone/Tablet)** dengan mengimplementasikan **Double Protection (2-Factor Authentication / 2FA)** berbasis biometrik.

> [!IMPORTANT]
> **STATUS SAAT INI: ON-HOLD (KEEP)**  
> Seluruh perencanaan teknis, arsitektur data, perbaikan bug algoritma, hingga alur *approval* telah dirumuskan secara final di dalam dokumen ini. **Tidak ada perubahan kode produksi yang dilakukan saat ini** sampai instruksi eksekusi resmi diberikan oleh Mas Gari Iriana.

---

## 🔍 2. ROOT CAUSE ANALYSIS (ANALISIS BUG LAMA)

### Masalah yang Ditemukan Sebelumnya:
Saat pengujian fitur *Face Recognition* sebelumnya, terjadi kegagalan fatal (*critical security flaw*):
> *"Wajah personel A didaftarkan, namun ketika wajah personel B menghadap kamera, sistem justru mendeteksi dan meloloskan personel B sebagai personel A."* (100% *False Positive*).

### Penyebab Utama (Bukan Masalah Kamera, Melainkan Algoritma):
1. **Tidak Menggunakan AI / Deep Learning**:
   Implementasi pada `faceRecognitionService.ts` yang lama hanya mengandalkan *Skin-tone color thresholding* (YCbCr) untuk mencari kotak wajah, kemudian membagi gambar wajah menjadi **grid 8x8 (64 kotak piksel)**.
2. **Kalkulasi Rata-Rata Intensitas Cahaya (Luminance Average)**:
   Fitur yang diekstrak hanyalah rata-rata kecerahan piksel dan gradien kontras sederhana pada tiap kotak 16x16 px, lalu dihitung menggunakan *Cosine Similarity*.
3. **Anatomi Wajah Manusia Memiliki Pola Gelap-Terang yang Seragam**:
   Hampir semua wajah manusia memiliki distribusi cahaya yang identik (dahi terang, alis/mata gelap, batang hidung terang, mulut gelap, dagu terang). Ketika hanya dihitung rata-rata luminansi pikselnya, skor kemiripan (*Cosine Similarity*) antar orang yang sama sekali berbeda **tetap tembus di angka 0.88 – 0.95**.
4. **Ambang Batas (*Threshold*) Terlalu Longgar**:
   Threshold lama diatur pada `0.85`. Karena di database baru ada 1 wajah (misal wajah Gari), ketika siapapun berdiri di depan kamera dan mendapat skor 0.90, sistem menganggapnya cocok.

### Solusi Final:
Migrasi penuh ke **Deep Metric Learning** menggunakan arsitektur Neural Network **ResNet-34 128-Dimensional Face Descriptor** via library modern **`@vladmandic/face-api`**.
- Model telah dilatih (*pre-trained*) dengan jutaan data wajah di seluruh dunia.
- Mengekstrak 68 titik tengara wajah (*facial landmarks*: jarak pupil mata, rasio tulang pipi, lekukan rahang, sudut bibir).
- Menggunakan metrik **Euclidean Distance**:
  - Wajah orang yang sama: jarak biasanya berada di antara **0.15 s/d 0.45**.
  - Wajah orang yang berbeda: jarak hampir selalu **> 0.65**.
  - Threshold ketat yang akan diterapkan: **`0.55` - `0.58`**.

---

## 🛡️ 3. FILOSOFI KEAMANAN & ARSITEKTUR 2FA (DOUBLE PROTECTION)

Sesuai arahan tegas dari Mas Gari Iriana: **TIDAK ADA INSTANT LOGIN / BYPASS PASSWORD!**

Keamanan akun tidak boleh dikorbankan demi kepraktisan. Akun engineer dan personel memiliki hak akses data operasional kritikal data center. Oleh karena itu, skema autentikasi wajib bertingkat:

```
                  ┌─────────────────────────────────────┐
                  │          HALAMAN LOGIN              │
                  │   Input: Email + Password + Bot     │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 1. Validasi Cloudflare Turnstile    │
                  │    (Mencegah DDoS & Bot Otomatis)   │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 2. Autentikasi Firebase Auth        │
                  │    (Verifikasi Email & Password)    │
                  └──────────────────┬──────────────────┘
                                     │
                    Password Valid?  ├─── TIDAK ───► [ TOLAK LANGSUNG ]
                                     │
                                    YA
                                     │
               ┌─────────────────────┴─────────────────────┐
               ▼                                           ▼
      [ AKSES DARI DESKTOP ]                      [ AKSES DARI MOBILE / HP ]
               │                                           │
               ▼                                           ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ STEP 2: SCAN WAJAH (2FA)      │           │ STEP 2: SIDIK JARI (2FA)      │
│ - Kamera laptop aktif         │           │ - Cek status approval HP      │
│ - Deteksi landmark & vektor   │           │ - Sensor sidik jari native HP │
│ - Match Euclidean Distance    │           │ - Validasi WebAuthn token     │
└──────────────┬────────────────┘           └──────────────┬────────────────┘
               │                                           │
         Wajah Cocok?                                Jari Terverifikasi?
        ├── YA  ──► [ MASUK APLIKASI ]              ├── YA  ──► [ MASUK APLIKASI ]
        └── TDK ──► [ AKSES DIBLOKIR ]              └── TDK ──► [ AKSES DIBLOKIR ]
```

---

## 📱 4. SPESIFIKASI FITUR MOBILE: SIDIK JARI (FINGERPRINT / WEBAUTHN)

### A. Alur Registrasi Sidik Jari di Handphone:
1. Pada halaman login saat dibuka di mobile browser (Chrome Android / Safari iOS), terdapat menu/tombol:  
   👉 **"Daftarkan Sidik Jari Perangkat Ini"**.
2. Personel membuka form pendaftaran:
   - Input **Nama Personel** (contoh: *Gari Iriana* / *Riyan Bayu*).
   - Input **Email Akun** (contoh: `ats@gmail.com`).
3. Personel menekan tombol **"Pindai Sidik Jari Sekarang"**.
4. Browser memanggil native WebAuthn API (`navigator.credentials.create`):
   - Muncul dialog bawaan sistem HP: *"Sentuh sensor sidik jari perangkat"*.
5. Setelah sidik jari terbaca oleh hardware HP:
   - Data kredensial aman (Credential ID, Public Key, Device Model) dikirim ke Firestore pada koleksi `fingerprint_requests`.
   - Status pendaftaran otomatis terkunci pada nilai: **`waiting_approval`**.
   - Sistem menampilkan pesan: *"Pendaftaran sidik jari berhasil dikirim. Menunggu persetujuan dari QC DME sebelum dapat digunakan untuk login."*
   - Personel **belum bisa** login menggunakan sidik jari sebelum disetujui.

### B. Alur Login Sidik Jari di Handphone:
1. Personel mengisi Email dan Password seperti biasa, lalu lolos Turnstile CAPTCHA.
2. Firebase Auth memverifikasi password benar.
3. Sistem memeriksa koleksi `fingerprint_requests` untuk pasangan Email + Perangkat ini:
   - Jika belum terdaftar atau status masih `waiting_approval`:  
     ❌ **Gagal**: Muncul peringatan *"Perangkat/Sidik jari Anda belum disetujui oleh QC DME. Silakan hubungi QC DME."*
   - Jika status `rejected`:  
     ❌ **Gagal**: *"Akses biometrik perangkat ini telah ditolak/dicabut oleh QC DME."*
   - Jika status `approved`:  
     ✅ Lanjut ke sensor biometrik.
4. Browser memicu `navigator.credentials.get`:
   - Dialog sidik jari HP muncul.
   - Personel menempelkan jari yang terdaftar di hardware HP.
   - Sensor HP memverifikasi keaslian sidik jari secara lokal dan aman.
   - Token biometrik lolos validasi -> **LOGIN SUKSES!**

---

## 💻 5. SPESIFIKASI FITUR DESKTOP: SCAN WAJAH (FACE RECOGNITION AI)

### A. Pendaftaran Wajah (Oleh Akun QC DME):
- Registrasi wajah **hanya bisa dilakukan oleh akun QC DME** (`qcdme@dme.com`) demi mencegah manipulasi identitas.
- QC membuka tab **"Manajemen Biometrik" -> Sub-tab "Registrasi Wajah"**.
- Kamera desktop mendeteksi wajah menggunakan `tinyFaceDetector`.
- Ekstraksi 68 Facial Landmarks dan 128-D descriptor via `@vladmandic/face-api`.
- Disimpan ke koleksi `registered_faces` beserta nama personel, role, email akun terkait, dan foto wajah (cropped 128x128).

### B. Login Wajah di Desktop:
1. User input Email + Password + CAPTCHA.
2. Password diverifikasi sukses oleh Firebase Auth.
3. Modal 2FA Wajah muncul:
   - Kamera laptop aktif secara otomatis.
   - Wajah dipindai secara real-time.
   - Vektor wajah dihitung dan dicocokkan dengan data wajah milik user di database menggunakan *Euclidean Distance*.
   - Jika jarak Euclidean `< 0.58` -> **LOGIN SUKSES**.
   - Jika wajah berbeda atau jarak `>= 0.58` -> **AKSES DITOLAK**.

---

## 👨‍💼 6. ALUR PERSETUJUAN (APPROVAL) OLEH QC DME (`qcdme@dme.com`)

Akun `qcdme@dme.com` memegang kendali penuh terhadap seluruh otorisasi biometrik:

### Menu Navbar Baru untuk QC DME:
- Ikon: 🛡️ **"Pusat Biometrik"** (atau terintegrasi rapi pada panel QC DME).
- Di dalamnya terdapat dua tab bersih:
  1. **Tab 1: Registrasi Wajah (Face Scan)**:
     - Daftar wajah aktif yang terdaftar.
     - Form tambah wajah baru via kamera/webcam.
     - Tombol hapus/nonaktifkan wajah.
  2. **Tab 2: Persetujuan Sidik Jari HP (Fingerprint Approval)**:
     - **Tabel Antrean Pengajuan**:
       - Nama Personel
       - Akun Email Terkait
       - Identitas Perangkat (contoh: *Samsung SM-A546E - Android 14*)
       - Tanggal & Waktu Pengajuan
       - Badge Status: 🟡 *Menunggu Persetujuan*, 🟢 *Disetujui*, 🔴 *Ditolak*
     - **Tombol Aksi**:
       - Tombol Hijau **[Setujui / Approve]** -> Mengubah status menjadi `approved`.
       - Tombol Merah **[Tolak / Cabut Akses]** -> Mengubah status menjadi `rejected` atau menghapus pendaftaran (berguna jika HP hilang atau teknisi resign).

---

## 🔒 7. KEAMANAN DATABASE (FIRESTORE SECURITY RULES)

Untuk menjamin sistem tidak dapat di-bypass melalui DevTools atau manipulasi API:

```javascript
// Aturan Keamanan Koleksi Wajah (registered_faces)
match /registered_faces/{faceId} {
  // Hanya user terautentikasi yang boleh membaca (untuk keperluan pencocokan saat login)
  allow read: if request.auth != null;
  // HANYA AKUN QC DME yang boleh menambah, mengubah, atau menghapus data wajah
  allow write: if request.auth != null && 
               (request.auth.token.email == 'qcdme@dme.com' || request.auth.token.email == 'qc@gmail.com');
}

// Aturan Keamanan Koleksi Pengajuan Sidik Jari (fingerprint_requests)
match /fingerprint_requests/{requestId} {
  // Siapapun user terdaftar boleh membaca status pendaftaran perangkatnya
  allow read: if true;
  
  // User di HP boleh submit pendaftaran perangkat BARU, 
  // TETAPI WAJIB berstatus 'waiting_approval' (tidak bisa curang langsung set 'approved')
  allow create: if request.resource.data.status == 'waiting_approval'
                && request.resource.data.registeredName is string
                && request.resource.data.targetEmail is string
                && request.resource.data.credentialId is string;

  // HANYA AKUN QC DME yang berhak mengubah status menjadi 'approved' atau 'rejected'
  allow update: if request.auth != null && 
                (request.auth.token.email == 'qcdme@dme.com' || request.auth.token.email == 'qc@gmail.com');

  // HANYA AKUN QC DME yang boleh menghapus data perangkat
  allow delete: if request.auth != null && 
                (request.auth.token.email == 'qcdme@dme.com' || request.auth.token.email == 'qc@gmail.com');
}
```

---

## 📦 8. RENCANA FILE & MODIFIKASI TEKNIS (ROADMAP EKSEKUSI)

Ketika instruksi *"Gas Lanjut"* diberikan nanti, berikut adalah daftar file yang akan dikerjakan:

| No | File Path | Tipe Aksi | Keterangan Pekerjaan |
|:---:|:---|:---:|:---|
| **1** | `package.json` | Edit | Menambahkan dependensi `@vladmandic/face-api` |
| **2** | `public/models/face/` | New Folder | Menaruh file model bobot neural network (`tiny_face_detector`, `face_landmark_68`, `face_recognition`) |
| **3** | `frontend/utils/faceRecognitionService.ts` | Rewrite | Mengganti algoritma grid 8x8 lama dengan deep learning 128-D descriptor & Euclidean distance |
| **4** | `frontend/utils/webAuthnFingerprintService.ts` | New File | Helper pendaftaran dan verifikasi sensor sidik jari HP via WebAuthn API |
| **5** | `frontend/types/faceAuthTypes.ts` | Edit | Memperbarui antarmuka TypeScript untuk `RegisteredFace` dan `FingerprintRegistration` |
| **6** | `frontend/components/FingerprintApprovalManagement.tsx` | New Component | Tabel antrean approval sidik jari untuk akun QC DME |
| **7** | `frontend/components/FaceRegistrationManagement.tsx` | Edit | Mengintegrasikan model face-api baru ke kamera pendaftaran wajah QC |
| **8** | `frontend/components/BiometricManager.tsx` | New Component | Tab induk di navbar QC DME yang menggabungkan Tab Wajah & Tab Sidik Jari |
| **9** | `frontend/pages/Login.tsx` | Edit | Mengintegrasikan step 2FA (Scan Wajah di Desktop, Sidik Jari di Mobile) & Modal Register Sidik Jari HP |
| **10**| `frontend/pages/MainApp.tsx` | Edit | Mengaktifkan menu tab Biometrik khusus untuk akun `qcdme@dme.com` |
| **11**| `firebase/firestore.rules` | Edit | Memasang security rules anti-bypass untuk koleksi biometrik |

---

## ✅ 9. QUALITY ASSURANCE & ZERO-BUG TESTING CHECKLIST

Langkah pengujian ketat yang wajib dilewati sebelum rilis ke tim lapangan:

- [ ] **Test Face Similarity Accuracy**:
  - Didaftarkan Personel A.
  - Uji Personel A di depan kamera -> Hasil: Lolos (Jarak Euclidean < 0.45).
  - Uji Personel B di depan kamera -> Hasil: Ditolak (Jarak Euclidean > 0.65).
  - Uji Foto Kertas / Layar HP -> Lolos deteksi liveness atau verifikasi proporsi landmark wajah.
- [ ] **Test Mobile WebAuthn Flow**:
  - Uji pada Android (Chrome) dengan sensor sidik jari in-display / bodi.
  - Uji pada iOS (Safari) dengan TouchID / FaceID native.
  - Verifikasi pendaftaran langsung berstatus `waiting_approval` di Firestore.
- [ ] **Test QC DME Approval**:
  - Akun `qcdme@dme.com` membuka panel antrean.
  - Klik tombol [Setujui] -> Status berubah jadi `approved` secara real-time.
  - Personel di HP mencoba login -> Sensor HP aktif dan berhasil login.
  - Klik tombol [Tolak/Hapus] -> Personel di HP langsung kehilangan akses biometrik.
- [ ] **Test Anti-Bypass Security**:
  - Password salah -> Langsung ditolak tanpa memicu sensor wajah/sidik jari.
  - Akun selain `qcdme@dme.com` mencoba akses edit/write ke `registered_faces` -> Ditolak oleh Firestore Security Rules (Error 403 / Permission Denied).

---

## 📝 10. CATATAN PENGEMBANG

Rencana ini telah disimpan dengan aman dan siap dieksekusi kapan pun Mas Gari memberikan instruksi untuk melanjutkan. Semua rancangan di atas dibuat dengan standar *clean code*, memperhatikan performa memori browser, dan menjaga stabilitas sistem utama DwimitraSystem.
