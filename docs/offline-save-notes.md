# Catatan implementasi simpan offline

Status: sudah di-commit. Diuji 2026-10-12 di Firebase Emulator + Playwright
(Chrome, 390px, mode aplikasi terpasang) memakai form Input Abnormal Manual — 18/18 lulus:
- offline: tombol Simpan aktif lagi dalam ±60 ms, toast "Tersimpan di HP", form dikosongkan,
  penanda offline menyebut data tersimpan di HP, modal logout memperingatkan data belum terkirim;
- aplikasi ditutup saat offline lalu dibuka lagi dengan sinyal: data terkirim, tidak dobel, sesi login tetap;
- sinyal kembali di sesi yang sama: toast "sudah terkirim ✓", data tepat satu, penanda hilang;
- sinyal lemah (online tapi server tidak menjawab): tombol lepas setelah ±6 detik, data terkirim saat pulih.
Form lain memakai helper yang sama tetapi belum diuji satu per satu secara offline.

## Perubahan

- `trackWrite` langsung melepas penantian saat offline atau sudah ada antrean.
  Penantian pertama ketika online tetap dibatasi 6 detik.
- Handler simpan CM, SLA, PIR, HSE, TBM, Safety Induction, HSE Findings, PTW baru,
  absensi TBM/Induction, progres Site Manager, Upload SR, ATS, dan helper update
  Corrective Maintenance memakai wrapper antrean pada jalur yang aman.
- Pembuatan dokumen memakai ID yang dibuat lokal melalui `doc(collection(...))`
  sebelum `setDoc`, sehingga penulisan foto/relasi tidak perlu menunggu server.
- Toast sukses penyimpanan ditunda selama antrean masih berjalan. Toast loading
  terkait ditutup; penolakan server sesudah antre tetap diberitahukan.
- Pemantauan antrean yang dipulihkan tidak menampilkan sukses jika penantiannya
  dibatalkan atau gagal.
- Upload FileManagement saat offline ditolak dengan `Upload berkas butuh internet`.
- Import tidak terpakai di ReportForm dihapus. Toast penyimpanannya mengikuti
  status antrean.

## Pengecualian yang dipertahankan

Instruksi awal melarang perubahan transaksi, alur yang membaca ulang data server
setelah menulis, dan alur yang memanggil backend setelah menulis.

- Edit HSEReportForm, HSETbmForm, dan HSESafetyInductionForm tetap menunggu server
  karena sesudah menulis dokumen, alurnya membaca dan mengganti foto lama.
- Edit PTW tetap memakai alur asli: beberapa tahap chunk membaca ulang data
  setelah penulisan sebelumnya. Jalur pembuatan PTW sudah dikonversi.
- Edit sesi dokumentasi AbsenInduction tetap memakai alur asli karena penggabungan
  sesi membaca ulang chunk setelah menulis.
- Penggantian nama personil AbsenTBM tetap memakai alur asli karena membaca
  riwayat absensi setelah memperbarui personil.
- Sinkronisasi cadangan lama ReportForm serta pembacaan foto pada edit ReportForm
  tidak direstrukturisasi. Jalur edit tersebut masih dapat menunggu pembacaan
  Firestore; wrapper penulisannya telah ada sebelum pekerjaan ini dimulai.
- Transaksi, proses backend, dan inisialisasi personil otomatis tidak dikonversi.

Backend Go tidak diubah.
