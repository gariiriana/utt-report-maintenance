export interface PDFTemplateConfig {
  accountEmail: string;
  templateName: string;
  templateFileName: string;
  templatePath: string;
  maintenanceType: string;
  description: string;
}

/**
 * Registry pemetaan template PDF Service Report berdasarkan Email Akun Maintenance.
 * Nama file PDF secara otomatis mengikuti email akun (misal: ats@gmail.com.pdf).
 */
export const PDF_TEMPLATE_REGISTRY: Record<string, PDFTemplateConfig> = {
  'ats@gmail.com': {
    accountEmail: 'ats@gmail.com',
    templateName: 'Service Report Automatic Transfer Switch (ATS)',
    templateFileName: 'ats@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/ats@gmail.com.pdf',
    maintenanceType: 'ATS',
    description: 'Template PDF Service Report khusus unit ATS Neutra DC Cikarang',
  },
  'fcu@gmail.com': {
    accountEmail: 'fcu@gmail.com',
    templateName: 'Service Report Fan Coil Unit (FCU)',
    templateFileName: 'fcu@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/fcu@gmail.com.pdf',
    maintenanceType: 'FCU',
    description: 'Template PDF Service Report khusus unit FCU Neutra DC Cikarang',
  },
  'pju@gmail.com': {
    accountEmail: 'pju@gmail.com',
    templateName: 'Service Report Street Lighting and Garden Lighting (PJU)',
    templateFileName: 'pju@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/pju@gmail.com.pdf',
    maintenanceType: 'PJU',
    description: 'Template PDF Service Report khusus PJU (Solar Cell & Lampu Taman) Neutra DC Cikarang',
  },
  'pdu@gmail.com': {
    accountEmail: 'pdu@gmail.com',
    templateName: 'Service Report Panel PDU',
    templateFileName: 'pdu@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/pdu@gmail.com.pdf',
    maintenanceType: 'PDU',
    description: 'Template PDF Service Report khusus Panel PDU Neutra DC Cikarang',
  },
  'coolingtower@gmail.com': {
    accountEmail: 'coolingtower@gmail.com',
    templateName: 'Service Report Cooling Tower (CT)',
    templateFileName: 'coolingtower@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/coolingtower@gmail.com.pdf',
    maintenanceType: 'Cooling Tower',
    description: 'Template PDF Service Report khusus Cooling Tower (CT) Neutra DC Cikarang',
  },
  'generator@gmail.com': {
    accountEmail: 'generator@gmail.com',
    templateName: 'Service Report Genset (Generator)',
    templateFileName: 'generator@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/generator@gmail.com.pdf',
    maintenanceType: 'Generator',
    description: 'Template PDF Service Report khusus Genset / Generator Neutra DC Cikarang',
  },
  'acsplit@gmail.com': {
    accountEmail: 'acsplit@gmail.com',
    templateName: 'Service Report Split Wall AC',
    templateFileName: 'acsplit@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/acsplit@gmail.com.pdf',
    maintenanceType: 'AC Split',
    description: 'Template PDF Service Report khusus Split Wall AC Neutra DC Cikarang',
  },
  'trafo@gmail.com': {
    accountEmail: 'trafo@gmail.com',
    templateName: 'Service Report Transformator (2 Format)',
    templateFileName: 'trafo@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/trafo@gmail.com.pdf',
    maintenanceType: 'Transformator',
    description: 'Template PDF Service Report khusus Transformator (2 Berkas PDF) Neutra DC Cikarang',
  },
  'busduct@gmail.com': {
    accountEmail: 'busduct@gmail.com',
    templateName: 'Service Report Panel Busduct',
    templateFileName: 'busduct@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/busduct@gmail.com.pdf',
    maintenanceType: 'Busduct',
    description: 'Template PDF Service Report khusus Panel Busduct Neutra DC Cikarang',
  },
  'dockleveler@gmail.com': {
    accountEmail: 'dockleveler@gmail.com',
    templateName: 'Service Report Dock Leveler',
    templateFileName: 'dockleveler@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/dockleveler@gmail.com.pdf',
    maintenanceType: 'Dock Leveler',
    description: 'Template PDF Service Report khusus Dock Leveler Neutra DC Cikarang',
  },
  'door@gmail.com': {
    accountEmail: 'door@gmail.com',
    templateName: 'Service Report Door / Rolling Door',
    templateFileName: 'door@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/door@gmail.com.pdf',
    maintenanceType: 'Door',
    description: 'Template PDF Service Report khusus Door / Rolling Door Neutra DC Cikarang',
  },
  'capacitorbank@gmail.com': {
    accountEmail: 'capacitorbank@gmail.com',
    templateName: 'Service Report Panel APFCR (Capacitor Bank)',
    templateFileName: 'capacitorbank@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/capacitorbank@gmail.com.pdf',
    maintenanceType: 'Capacitor Bank',
    description: 'Template PDF Service Report khusus Panel APFCR / Capacitor Bank Neutra DC Cikarang',
  },
  'ldbrdb@gmail.com': {
    accountEmail: 'ldbrdb@gmail.com',
    templateName: 'Service Report Panel LDB & RDB',
    templateFileName: 'ldbrdb@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/ldbrdb@gmail.com.pdf',
    maintenanceType: 'Panel LDB & RDB',
    description: 'Template PDF Service Report khusus Panel LDB & RDB Neutra DC Cikarang',
  },
  'ldb/rdb@gmail.com': {
    accountEmail: 'ldb/rdb@gmail.com',
    templateName: 'Service Report Panel LDB & RDB',
    templateFileName: 'ldbrdb@gmail.com.pdf',
    templatePath: '/templates/pdf_service_reports/ldbrdb@gmail.com.pdf',
    maintenanceType: 'Panel LDB & RDB',
    description: 'Template PDF Service Report khusus Panel LDB & RDB Neutra DC Cikarang',
  },
};

/**
 * Mendapatkan konfigurasi template PDF Service Report berdasarkan email akun.
 */
export function getPDFTemplateByAccount(email?: string | null): PDFTemplateConfig | null {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  return PDF_TEMPLATE_REGISTRY[cleanEmail] || null;
}
