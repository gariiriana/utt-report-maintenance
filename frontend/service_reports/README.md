# 📑 Template PDF Service Report Per Maintenance

Folder ini dikhususkan untuk menyimpan seluruh **Template PDF Service Report** untuk setiap unit maintenance.

## 📁 Struktur Folder:
- `ats/` : Template & PDF Generator untuk **ATS (Automatic Transfer Switch)**
- `fcu/` : Template & PDF Generator untuk **FCU (Fan Coil Unit)**
- `common/` : Helper, utilitas kompresi, dan formatting bersama untuk PDF Service Report

## 🚀 Penggunaan:
```typescript
import { generateATSServiceReportPDF, generateFCUServiceReportPDF } from '@/service_reports';
```
