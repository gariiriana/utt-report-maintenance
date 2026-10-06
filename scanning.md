# Scan Wajah (2FA) untuk Akun Bersama

**Status:** logika server ada di backend Go (Vercel), karena project Firebase `report-utt` memakai paket Spark dan tidak bisa menjalankan Cloud Functions. Sudah dites di Firebase Emulator dengan server Go sungguhan: 59 tes alur lulus, ditambah tes approval duplikat dan tes sesi kedaluwarsa. Deploy production dimulai 7 Oktober 2026. Batas kecocokan wajah sudah diketatkan, tetapi belum dites ulang dengan dua orang sungguhan. Kamera dan GPU di perangkat sungguhan belum dites (lihat *Kompatibilitas perangkat*).
**Keputusan:** Gari Iriana, 6 Oktober 2026.

## Kenapa

Akun dipakai bersama per role (misalnya `ats@gmail.com` dipakai banyak teknisi). Personel yang sudah resign masih tahu passwordnya. Scan wajah memastikan yang masuk adalah personel yang masih terdaftar, tanpa harus mengganti password semua orang setiap ada yang resign.

**Wajah didaftarkan sekali per orang dan berlaku untuk semua akun.** Password menentukan akun mana yang dibuka. Wajah memastikan orangnya masih personel aktif.

## Alur

**Registrasi**
1. User login dengan email dan password yang benar, lalu muncul layar *Verifikasi Wajah*.
2. User memilih "Wajah saya belum terdaftar", mengisi nama dan perusahaan (keduanya wajib), mencentang persetujuan data wajah (UU PDP), lalu kamera mengambil sampel: wajah lurus, toleh ke dua sisi, lalu lurus lagi. Tidak ada kedip, karena landmark mata model ringan tidak andal. Keaslian orang dipastikan QC saat meninjau foto.
3. Status pengajuan: menunggu. User belum bisa masuk. Di layar ini ada tombol **Minta Approval via WhatsApp** ke QC DME (0857-2337-5324, konstanta `QC_WHATSAPP` di `FaceGate.tsx`), dengan pesan siap kirim berisi nama, perusahaan, dan akun login. Setiap pendaftaran selalu membuat pengajuan milik pendaftar sendiri. Nama orang lain tidak pernah ditampilkan ke pendaftar. Jika wajahnya mirip wajah lain (yang sudah aktif atau masih menunggu), QC melihat peringatan "Wajahnya mirip X" dan wajib membandingkan fotonya. Jika wajahnya sudah aktif, pendaftar hanya diminta scan untuk masuk.
4. QC DME membuka **Pusat Biometrik**, melihat foto, nama, perusahaan, akun, perangkat, dan waktu, lalu memilih *Setujui* atau *Tolak*. Data wajah yang ditolak langsung dihapus.
5. Jika pengajuan mirip wajah yang **sudah aktif** dan dari fotonya orangnya sama (misalnya daftar lagi dari laptop karena kamera laptop gagal mencocokkan wajah yang didaftarkan dari HP), QC memilih *Gabungkan*. Sampel dari perangkat baru ditambahkan ke profil yang sudah ada. Satu orang tetap satu profil, jadi *Hapus (resign)* mencabut akses dari semua perangkatnya.

**Login**
1. User login dengan password, lalu scan wajah: cukup hadap kamera, 3 sampel wajah lurus diambil otomatis. Tidak ada kedip atau toleh (keputusan Gari, 6 Oktober 2026). Saat pendaftaran hanya ada toleh kiri dan kanan.
2. Server (backend Go, `POST /api/face/verify`) mencocokkan sampel dengan **semua** wajah yang sudah disetujui, dari akun mana pun. Datanya ada di `face_profiles` dan tidak bisa dibaca client. Wajah dianggap cocok jika jaraknya di bawah 0,42 (lihat *Batas kecocokan*). Log audit mencatat siapa masuk ke akun mana beserta jarak wajahnya.
3. Jika cocok, server menerbitkan custom token untuk uid yang sama dengan klaim `faceUntil` (12 jam) dan `facePerson`. Klaim ini menempel ke **sesi perangkat itu saja**, jadi rekan lain yang memakai akun yang sama tetap harus scan wajahnya sendiri.
4. Jika tidak cocok, user hanya bisa mencoba lagi, mengajukan pendaftaran, atau keluar. Setelah 10 kali gagal dalam 15 menit, akun dikunci 15 menit.

**Resign**
- QC menekan *Hapus (resign)* pada wajah personel tersebut. Foto dan data wajahnya terhapus permanen.
- Aksesnya langsung dicabut di semua akun, **hanya untuk orang itu**. Rekan di akun yang sama tidak ikut keluar (keputusan Gari: cabut langsung, 7 Oktober 2026). Caranya ada tiga:
  - Rules memeriksa `face_profiles/{faceId}` (dari klaim token) pada setiap akses data Firestore, sehingga aksesnya ditolak saat itu juga.
  - Backend Go memeriksa status yang sama, dengan cache 60 detik per instance.
  - Aplikasi memanggil `POST /api/face/check-session` saat dibuka, setiap 5 menit, dan saat tab dibuka kembali. Jika wajahnya sudah dihapus, perangkat itu di-logout. Jika sesi 12 jamnya yang habis, user cukup scan ulang tanpa login password lagi.

**Pengecualian**
- `qcdme@dme.com` tidak wajib scan wajah (keputusan Gari, 6 Oktober 2026). Daftarnya ada di `FaceExemptEmails` (`backend/core/middlewares/auth.go`), `FACE_EXEMPT_EMAILS` (`frontend/types/faceAuthTypes.ts` dan `functions/src/face-session.ts`), dan rules. Keempatnya harus sama.
- Risikonya: akun ini paling berkuasa dan sekarang hanya dilindungi password. Lihat catatan password di bagian *Saat deploy ke production*.

**Akses darurat**
- Akun QC DME atau admin bisa memakai kode di env `FACE_BREAKGLASS_CODE` (Vercel, tipe Secret, environment Production). Sesi darurat berlaku 2 jam dan tercatat di log audit.

**Mode**
- Scan wajah **selalu wajib**. Mode "boleh dilewati" sudah dihapus, karena rules dan backend tetap menolak akses tanpa sesi wajah, sehingga mode itu hanya membuka tampilan kosong.

## Penegakan di server

Layar scan saja **tidak cukup**, karena siapa pun yang tahu password bisa memakai Firebase SDK langsung. Penegakannya ada di:

1. **`firebase/firestore.rules`**: semua `request.auth != null` diganti `authed()`. Firebase Storage tidak dipakai aplikasi (semua file disimpan sebagai chunk di Firestore), jadi `storage.rules` tidak diubah. Artinya login, lalu (email di daftar pengecualian **atau** `faceUntil` masih berlaku **dan** `face_profiles/{faceId}` masih `approved`, atau `faceId == 'break-glass'`). Pengecualiannya:
   - baca dan buat dokumen `users/{uid}` milik sendiri
   - `hse` get publik (link WhatsApp)
2. **`registered_faces`** (koleksi lama, sempat publik dan berisi `accountPassword`) ditutup total. Isinya perlu dihapus.
3. **Backend Go**: `RequireFirebaseAuth` memanggil `HasValidFaceSession` dengan logika yang sama. Yang dikecualikan hanya `/api/auth/me|login` dan gerbang `/api/face/*` (endpoint admin di dalamnya mengecek sesi wajah reviewer sendiri). WebSocket voice dicek ulang setiap 30 detik dan diputus bila wajah dihapus atau sesinya habis. `/api/auth/logout` tidak lagi mencabut refresh token (pada akun bersama, itu ikut mengeluarkan semua rekan).
4. **Cloud Functions lama** (`analyzeATSReport`, callable WhatsApp) memakai `requireFaceSession` (`functions/src/face-session.ts`), untuk berjaga jika suatu saat project pindah ke Blaze. Saat ini functions tidak ter-deploy.
5. **Rate limit** scan dan kode darurat: atomik (transaksi), dengan kunci per akun + IP. Mantan karyawan tidak bisa mengunci scan rekannya dari lokasi lain.
6. **Realtime Database** (presence): rules dikelola di Console. Rules RTDB tidak bisa membaca Firestore, jadi hanya klaim `faceUntil` yang dicek.

Biaya (kuota gratis Spark: 50 ribu baca per hari):
- Rules: setiap akses Firestore dari client menambah 1 baca (`face_profiles/{faceId}`). Firebase menghitungnya sekali per request, bukan per dokumen.
- Backend Go: status wajah di-cache 60 detik per `faceId`, dan daftar wajah yang disetujui di-cache 30 detik untuk scan dan pendaftaran. Cache dibuang saat QC menyetujui, menggabung, atau menghapus wajah di instance yang sama.
- Cek sesi dari aplikasi: setiap 5 menit per perangkat yang terbuka.

## Komponen

| File | Isi |
|---|---|
| `backend/core/services/face_service.go` | logika server: state, verify, check-session, enroll, scan-issue, break-glass, admin list/audit/review/merge/delete |
| `backend/core/controllers/face_controller.go` | routing `POST /api/face/*` |
| `backend/core/middlewares/auth.go` | `FaceSessionState` / `HasValidFaceSession` untuk API Go |
| `frontend/api/faceApi.ts` | `callFace()`: memanggil `/api/face/*` dengan ID token |
| `frontend/utils/faceRecognitionService.ts` | `@vladmandic/face-api` (descriptor ResNet 128-D), estimasi tolehan kepala |
| `frontend/components/FaceScanner.tsx` | kamera dan langkah-langkah scan |
| `frontend/components/FaceGate.tsx` | gerbang setelah login |
| `frontend/components/BiometricManager.tsx` | Pusat Biometrik (QC DME / admin) |
| `public/models/face/` | bobot model (±7 MB, dimuat saat layar scan dibuka) |

Koleksi Firestore yang hanya diakses lewat backend Go (client ditolak rules): `face_profiles`, `face_audit`, `face_rate`.

Backend Go membuat custom token dengan service account dari env `FIREBASE_SERVICE_ACCOUNT`, jadi tidak perlu pengaturan IAM tambahan. `GET /api/health` mengembalikan `checks.face2fa = "enabled"` sebagai penanda bahwa versi ini sudah live.

## Batas kecocokan

Jarak wajah dihitung dari descriptor 128-D. Makin kecil, makin mirip.

| Batas | Nilai | Dipakai untuk |
|---|---|---|
| `MATCH_THRESHOLD` | 0,42 | Login, "wajah sudah terdaftar", dan penolakan approval duplikat. Mayoritas sampel **dan** rata-ratanya harus di bawah batas. |
| `LOOKALIKE_THRESHOLD` | 0,55 | Hanya peringatan "Wajahnya mirip X" di Pusat Biometrik. Tidak pernah dipakai untuk login. |

Asal angka ini, dari tes 6 Oktober 2026:
- Login asli Gari tercatat di jarak 0,20 sampai 0,32.
- Batas awal 0,5 sempat menganggap wajah Gari mirip Rifal, padahal mereka orang berbeda. Karena itu batasnya diketatkan ke 0,42.
- Model ini (turunan dlib) dikenal lebih mudah tertukar pada wajah Asia.

Untuk memantau, log audit di Pusat Biometrik menampilkan jarak setiap login. Untuk login yang gagal, ditampilkan juga wajah terdaftar yang paling mirip. Ada dua pola yang perlu diwaspadai:
- Login gagal dengan jarak 0,42 sampai 0,5 ke wajah orang lain: itu wajah mirip yang nyaris lolos. Pertimbangkan menurunkan batas lagi.
- Personel asli sering gagal dengan jarak sedikit di atas 0,42 (misalnya kamera laptop berbeda dengan kamera saat daftar): batasnya terlalu ketat. Naikkan sedikit, jangan melebihi 0,45.

Sebelum rilis, tes dengan 2 sampai 3 orang berbeda di emulator. Setiap orang harus ditolak saat memakai wajah orang lain, dan diterima saat memakai wajahnya sendiri, baik dari HP maupun laptop.

## Kompatibilitas perangkat

Scan wajah berjalan di browser, jadi hasilnya bergantung pada kamera, GPU, browser, dan jam perangkat. Yang sudah diantisipasi di kode:

| Masalah di perangkat | Penanganan |
|---|---|
| WebGL (GPU) gagal diinisialisasi, misalnya driver diblokir browser atau akselerasi hardware mati | Otomatis pakai CPU. Sebelumnya fallback ini tidak pernah jalan, karena `setBackend` mengembalikan `false`, bukan melempar error. |
| GPU tanpa presisi float32 (sebagian HP lama atau iOS 14 ke bawah), sehingga descriptor wajah bisa melenceng | Otomatis pakai CPU, supaya hasilnya sama di semua perangkat. Lebih lambat, tapi tetap di bawah batas waktu 30 detik. |
| GPU error di tengah scan (konteks WebGL hilang di HP RAM kecil) | Setelah 3 kali error berturut-turut, pindah ke CPU dan lanjut scan. |
| Kamera menolak syarat resolusi atau kamera depan (kamera/driver lama) | Dicoba ulang sekali tanpa syarat. |
| Browser memblokir autoplay video (misalnya iPhone mode hemat daya) | Muncul tombol "Ketuk untuk menyalakan kamera". |
| Izin kamera ditolak, kamera tidak ada, kamera dipakai aplikasi lain, browser tidak mendukung kamera (misalnya dibuka dari dalam WhatsApp atau Instagram) | Pesan berbeda untuk tiap penyebab, berisi langkah perbaikannya. |
| Model 7 MB diunduh ulang di lokasi bersinyal lemah | Setelah unduhan pertama, model disimpan service worker (cache `face-models-v1`). |
| Jam perangkat salah (misalnya maju sehari) | Sesi wajah dihitung dengan jam server (klaim `iat`), bukan jam perangkat. Sebelumnya HP yang jamnya maju lebih dari 12 jam akan terus kembali ke layar scan. |
| Kamera laptop jauh berbeda dengan kamera HP saat daftar, sehingga login dari laptop gagal | Daftar lagi dari laptop, lalu QC memilih *Gabungkan*. |

**Pemantauan:** setiap login mencatat perangkatnya (misalnya "Chrome 129 di Android 14"). Setiap kendala teknis (kamera, model, GPU, waktu habis) dilaporkan ke Log Audit Pusat Biometrik sebagai "Scan gagal (teknis)", lengkap dengan perangkat dan detail errornya. Jadi kalau perangkat D, E, F gagal, penyebabnya kelihatan tanpa harus menunggu laporan dari lapangan.

**Yang tetap tidak bisa:**
- PC tanpa webcam tidak bisa scan wajah sama sekali.
- Browser yang sangat lama (misalnya iOS 13 ke bawah) mungkin gagal memuat model. Pesannya muncul dan tercatat di log audit.

**Tes sebelum rilis** lewat link tunnel emulator, minimal di:

| Perangkat | Browser |
|---|---|
| HP Android kelas bawah atau lama | Chrome |
| HP Android Samsung | Samsung Internet |
| iPhone | Safari, dan juga sebagai aplikasi PWA yang di-install |
| Laptop Windows | Chrome atau Edge |
| PC kantor yang biasa dipakai | Browser yang biasa dipakai |

Di tiap perangkat, tes daftar (atau gabung) dan login. Setelah itu cek Log Audit untuk melihat jarak wajah dan kendala yang tercatat.

## Tes lokal (Firebase Emulator)

Butuh Java 11+ (untuk emulator Firestore dan RTDB).

```
npm run emulators         # terminal 1 (UI emulator: http://127.0.0.1:4000)
npm run emulators:seed    # terminal 2: akun tes qcdme@dme.com / ats@gmail.com / admin@test.local, password tes12345
# terminal 3: backend Go di port 8090 yang memakai emulator (jalankan dari folder di luar repo agar .env production tidak terbaca)
#   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
#   FIREBASE_SERVICE_ACCOUNT=<service account palsu>  FACE_BREAKGLASS_CODE=<kode tes>  PORT=8090
npm run dev:emulator      # terminal 4: aplikasi pakai emulator, /api diproxy ke localhost:8090
cloudflared tunnel --url http://localhost:5173   # opsional: link HTTPS untuk tes dari HP (sesuaikan port Vite)
```

**Hati-hati:** `vite` biasa (tanpa `--mode emulator`) dan `backend\server.exe` di port 8080 memakai Firebase **production**. Tes jangan diarahkan ke sana.

Di mode emulator, semua layanan Firebase diproxy lewat Vite (origin yang sama), sehingga link tunnel HTTPS juga jalan di HP. Kamera wajib HTTPS. Turnstile memakai site key tes Cloudflare (`1x00000000000000000000AA`, selalu lolos). HMR dimatikan, jadi refresh manual setelah mengubah kode. Storage belum diemulasikan.

## Saat deploy ke production

- Isi `FACE_BREAKGLASS_CODE` (minimal 12 karakter) di Vercel → Settings → Environment Variables, tipe **Secret**, environment Production. Sudah diisi 7 Oktober 2026. Jika diganti, perlu redeploy agar terbaca.
- Password `qcdme@dme.com` **tidak diganti** (keputusan Gari, 6 Oktober 2026), padahal password lama ada di riwayat git yang sudah di-push ke GitHub (commit `21441256`). Risikonya: siapa pun yang pernah melihat repo bisa masuk sebagai QC tanpa scan wajah. Mitigasinya: repo harus private dan aksesnya hanya untuk orang aktif. Script di `scripts/*.cjs` sekarang membaca `DWIMITRA_SCRIPT_EMAIL` dan `DWIMITRA_SCRIPT_PASSWORD` dari environment.
- **Backend Go wajib live paling awal.** Gerbang wajah sepenuhnya bergantung pada `/api/face/*`. Jika hosting atau rules di-deploy sebelum backend live, tidak ada yang bisa masuk kecuali `qcdme@dme.com`. Push ke `main` otomatis men-deploy Vercel. Tunggu sampai `https://utt-report-maintenance.vercel.app/api/health` menampilkan `"face2fa":"enabled"`.
- Urutan deploy: push (backend Go di Vercel), lalu `firebase deploy --only hosting`, lalu `firebase deploy --only firestore:rules`, lalu rules RTDB di Console (opsional). Jangan deploy `functions` (project Spark, dan `scheduledWAReminderH60` akan mengirim WhatsApp). Mode default sudah WAJIB, jadi siapkan QC untuk menyetujui wajah begitu rilis.

## Batasan yang diketahui

- Login tidak memakai cek liveness. Foto wajah personel yang sudah disetujui (misalnya dari foto profil WhatsApp), ditambah password akun, bisa lolos scan. Ini risiko yang diterima demi kemudahan login.

- Descriptor wajah dihitung di browser. Orang yang punya foto rekan kerja dan cukup paham teknis secara teori bisa membuat descriptor dari foto itu dan memanggil `/api/face/verify` langsung, karena liveness hanya dicek di client. Untuk ancaman "mantan karyawan iseng" ini cukup. Jika perlu lebih ketat, langkah berikutnya adalah mengirim frame ke server dan menghitung descriptor serta liveness di sana.
