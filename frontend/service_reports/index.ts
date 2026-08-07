// ============================================================================
// FILE: frontend/service_reports/index.ts
// Deskripsi: Export Hub Terpusat Seluruh Generator Laporan PDF Perangkat (Service Reports).
//            Meng-export modul-modul generator PDF resmi per jenis perangkat Data Center:
//            - Electrical: ATS, Trafo, PDU, Busduct, Capacitor Bank, LDB/RDB
//            - HVAC: AC Split, FCU, Cooling Tower (CT)
//            - Utility & Mechanical: Generator, PJU, Dock Leveler, Automatic Door
// ============================================================================

export { generateATSServiceReportPDF } from './ats/generateATSReportPDF';
export { generateFCUServiceReportPDF } from './fcu/generateFCUReportPDF';
export { generatePJUServiceReportPDF } from './pju/generatePJUReportPDF';
export { generatePDUServiceReportPDF } from './pdu/generatePDUReportPDF';
export { generateCTReportPDF } from './ct/generateCTReportPDF';
export { generateGeneratorReportPDF } from './generator/generateGeneratorReportPDF';
export { generateACSplitReportPDF } from './acsplit/generateACSplitReportPDF';
export { generateTrafoReportPDF } from './trafo/generateTrafoReportPDF';
export { generateBusductReportPDF } from './busduct/generateBusductReportPDF';
export { generateDocklevelerReportPDF } from './dockleveler/generateDocklevelerReportPDF';
export { generateDoorReportPDF } from './door/generateDoorReportPDF';
export { generateCapacitorbankReportPDF } from './capacitorbank/generateCapacitorbankReportPDF';
export { generateLdbrdbReportPDF } from './ldbrdb/generateLdbrdbReportPDF';
export { getPDFTemplateByAccount, PDF_TEMPLATE_REGISTRY } from '@/config/pdfTemplateRegistry';
