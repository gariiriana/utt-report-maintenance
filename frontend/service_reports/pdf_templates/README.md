# 📁 Storage Template PDF Service Report Per Akun Maintenance

Folder ini disiapkan khusus untuk menyimpan **Template PDF Service Report** untuk setiap akun maintenance data center.

## 📌 Penamaan File & Struktur Folder:

Setiap template PDF disimpan dengan nama file sesuai **Email Akun Maintenance**:

```
service_reports/pdf_templates/
├── ats@gmail.com.pdf          <-- Template PDF Service Report ATS
├── fcu@gmail.com.pdf          <-- Template PDF Service Report FCU
├── pju@gmail.com.pdf          <-- Template PDF Service Report PJU
├── README.md                  <-- Panduan ini
└── accounts/
    ├── ats@gmail.com/         <-- (Opsional) Folder spesifik versi/lampiran ATS
    ├── fcu@gmail.com/         <-- (Opsional) Folder spesifik versi/lampiran FCU
    └── pju@gmail.com/         <-- (Opsional) Folder spesifik versi/lampiran PJU
```

## 🔄 Pemetaan Otomatis Sistem (Config Registry):
Pemetaan file template dipantau oleh file registry:
`frontend/config/pdfTemplateRegistry.ts`

Ketika bro memasukkan file PDF baru (misalnya `ats@gmail.com.pdf` atau `fcu@gmail.com.pdf`), sistem akan otomatis membaca dan menggunakannya sebagai acuan Service Report!
