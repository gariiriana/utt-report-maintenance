import { useCallback } from 'react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════════
// useVoiceCommands — Executes AI function calls on the frontend
// Maps function names from the AI to actual React/DOM actions.
// ═══════════════════════════════════════════════════════════════════════════════

interface UseVoiceCommandsReturn {
  executeCommand: (name: string, args: Record<string, unknown>) => Promise<{ success: boolean; result: string }>;
  getAppState: () => Record<string, unknown>;
}

// Map of page names to navigation paths/actions
const PAGE_MAP: Record<string, string> = {
  dashboard: 'admin',
  admin: 'admin',
  service_report: 'report',
  report: 'report',
  ats_report: 'report',
  documents: 'documents',
  document_list: 'documents',
  archive: 'documents',
  files: 'files',
  file_management: 'files',
  corrective: 'corrective',
  corrective_maintenance: 'corrective',
  corrective_archive: 'corrective_archive',
  findings: 'findings',
  finding_archive: 'finding_archive',
  ptw: 'ptw',
  ptw_management: 'ptw',
  absen_tbm: 'absen_tbm',
  absen_induction: 'absen_induction',
  user_management: 'admin',
  audit_log: 'admin',
};

export function useVoiceCommands(): UseVoiceCommandsReturn {

  const executeCommand = useCallback(async (
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result: string }> => {
    try {
      switch (name) {
        case 'navigate_to_page':
          return handleNavigate(args);

        case 'create_service_report':
          return handleCreateReport(args);

        case 'search_reports':
          return handleSearchReports(args);

        case 'open_report':
          return handleOpenReport(args);

        case 'export_pdf':
          return handleExportPDF(args);

        case 'delete_report':
          return handleDeleteReport(args);

        case 'fill_form_field':
          return handleFillFormField(args);

        case 'fill_form_bulk':
          return handleFillFormBulk(args);

        case 'save_changes':
          return handleSaveChanges(args);

        case 'click_button':
          return handleClickButton(args);

        case 'close_modal':
          return handleCloseModal(args);

        case 'filter_data':
          return handleFilterData(args);

        case 'refresh_data':
          return handleRefreshData();

        case 'scroll_to_section':
          return handleScrollToSection(args);

        case 'get_report_summary':
          return handleGetReportSummary(args);

        case 'ai_analyze_report':
          return handleAIAnalyze(args);

        default:
          return { success: false, result: `Unknown function: ${name}` };
      }
    } catch (err: any) {
      console.error(`Voice command ${name} failed:`, err);
      return { success: false, result: err.message || 'Command execution failed' };
    }
  }, []);

  const getAppState = useCallback((): Record<string, unknown> => {
    const path = window.location.pathname + window.location.hash;
    let currentPage = 'dashboard';

    const activeTab = document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab');
    if (activeTab) currentPage = activeTab;

    const openModals: string[] = [];
    document.querySelectorAll('[role="dialog"][data-state="open"], .fixed[class*="z-[9"]').forEach(el => {
      const id = el.getAttribute('data-modal-id') || el.id || 'unknown_modal';
      openModals.push(id);
    });

    const activeForm: Record<string, unknown> = {};
    const formInputs = document.querySelectorAll('form input, form textarea, form select');
    formInputs.forEach(input => {
      const el = input as HTMLInputElement;
      const name = el.name || el.id;
      if (name && el.value) {
        activeForm[name] = el.value;
      }
    });

    return {
      current_page: currentPage,
      url: path,
      open_modals: openModals,
      active_form: Object.keys(activeForm).length > 0 ? activeForm : null,
    };
  }, []);

  return { executeCommand, getAppState };
}

// ─── Command Handlers ───────────────────────────────────────────────────────

function handleNavigate(args: Record<string, unknown>): { success: boolean; result: string } {
  let rawPage = ((args.page as string) || '').toLowerCase().trim();
  let page = rawPage;

  if (rawPage.includes('ptw')) page = 'ptw';
  else if (rawPage.includes('dash') || rawPage.includes('admin')) page = 'admin';
  else if (rawPage.includes('buat') || rawPage.includes('service') || rawPage.includes('ats')) page = 'report';
  else if (rawPage.includes('arsip') || rawPage.includes('dokumen')) page = 'documents';
  else if (rawPage.includes('file') || rawPage.includes('manajemen file')) page = 'files';
  else if (rawPage.includes('corrective') || rawPage.includes('cm')) page = 'corrective';
  else if (rawPage.includes('temuan') || rawPage.includes('finding')) page = 'findings';
  else if (rawPage.includes('tbm')) page = 'absen_tbm';
  else if (rawPage.includes('induction')) page = 'absen_induction';

  const targetTab = PAGE_MAP[page] || page;

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'navigate', page: targetTab },
  }));

  toast.info(`JARVIS: Membuka halaman ${targetTab}...`);
  return { success: true, result: `Navigasi ke halaman ${targetTab} berhasil.` };
}

function handleCreateReport(args: Record<string, unknown>): { success: boolean; result: string } {
  const reportType = (args.report_type as string) || 'service_report';

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'create_report', report_type: reportType },
  }));

  toast.info('Membuat laporan baru...');
  return { success: true, result: `Form laporan ${reportType} baru telah dibuka.` };
}

function handleSearchReports(args: Record<string, unknown>): { success: boolean; result: string } {
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'search_reports', ...args },
  }));

  const query = args.query || args.customer || args.date_range || '';
  toast.info(`Mencari laporan: ${query}...`);
  return { success: true, result: `Pencarian laporan dengan filter "${query}" telah dilakukan.` };
}

function handleOpenReport(args: Record<string, unknown>): { success: boolean; result: string } {
  const reportId = args.report_id as string;
  if (!reportId) {
    return { success: false, result: 'ID laporan tidak disebutkan.' };
  }

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'open_report', report_id: reportId, mode: args.mode || 'view' },
  }));

  return { success: true, result: `Membuka laporan ${reportId}.` };
}

function handleExportPDF(args: Record<string, unknown>): { success: boolean; result: string } {
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'export_pdf', report_id: args.report_id },
  }));

  toast.info('Mengexport PDF...');
  return { success: true, result: 'Export PDF sedang diproses.' };
}

function handleDeleteReport(args: Record<string, unknown>): { success: boolean; result: string } {
  const confirm = args.confirm as string;
  if (confirm === 'ask' || confirm === 'no') {
    return { success: false, result: 'Penghapusan dibatalkan. User belum mengonfirmasi.' };
  }

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'delete_report', report_id: args.report_id },
  }));

  return { success: true, result: `Laporan ${args.report_id} telah dihapus.` };
}

function handleFillFormField(args: Record<string, unknown>): { success: boolean; result: string } {
  const fieldName = args.field_name as string;
  const value = args.value as string;

  if (!fieldName || value === undefined) {
    return { success: false, result: 'Nama field dan nilai harus disebutkan.' };
  }

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'fill_form_field', field_name: fieldName, value },
  }));

  return { success: true, result: `Field "${fieldName}" diisi dengan "${value}".` };
}

function handleFillFormBulk(args: Record<string, unknown>): { success: boolean; result: string } {
  let fields: Record<string, string>;
  try {
    fields = typeof args.fields === 'string' ? JSON.parse(args.fields as string) : args.fields as Record<string, string>;
  } catch {
    return { success: false, result: 'Format data fields tidak valid.' };
  }

  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'fill_form_bulk', fields },
  }));

  const count = Object.keys(fields).length;
  return { success: true, result: `${count} field berhasil diisi.` };
}

function handleSaveChanges(args: Record<string, unknown>): { success: boolean; result: string } {
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'save_changes', save_type: args.action || 'save' },
  }));

  toast.info('Menyimpan perubahan...');
  return { success: true, result: 'Perubahan telah disimpan.' };
}

function handleClickButton(args: Record<string, unknown>): { success: boolean; result: string } {
  const buttonId = args.button_id as string;

  // Try to find button by various selectors
  const selectors = [
    `button[data-voice-id="${buttonId}"]`,
    `button#${buttonId}`,
    `[data-voice-id="${buttonId}"]`,
    `button[title*="${buttonId}" i]`,
    `button:has(> span:contains("${buttonId}"))`,
  ];

  for (const selector of selectors) {
    try {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button && !button.disabled) {
        button.click();
        return { success: true, result: `Tombol "${buttonId}" diklik.` };
      }
    } catch { /* selector mungkin invalid */ }
  }

  // Fallback: dispatch event for the app to handle
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'click_button', button_id: buttonId },
  }));

  return { success: true, result: `Perintah klik tombol "${buttonId}" dikirim.` };
}

function handleCloseModal(_args: Record<string, unknown>): { success: boolean; result: string } {
  // Try to close the topmost modal
  const closeButtons = document.querySelectorAll(
    '[role="dialog"] button[aria-label="Close"], ' +
    '[role="dialog"] button[title*="Tutup"], ' +
    '[role="dialog"] button[title*="Close"], ' +
    '.fixed button[title*="Tutup"]'
  );

  if (closeButtons.length > 0) {
    (closeButtons[closeButtons.length - 1] as HTMLButtonElement).click();
    return { success: true, result: 'Modal ditutup.' };
  }

  // Dispatch ESC key as fallback
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { success: true, result: 'Perintah tutup modal dikirim.' };
}

function handleFilterData(args: Record<string, unknown>): { success: boolean; result: string } {
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'filter_data', filter_type: args.filter_type, value: args.value },
  }));

  return { success: true, result: `Filter ${args.filter_type}: "${args.value}" diterapkan.` };
}

function handleRefreshData(): { success: boolean; result: string } {
  window.dispatchEvent(new CustomEvent('voice-agent-command', {
    detail: { action: 'refresh_data' },
  }));

  toast.info('Memuat ulang data...');
  return { success: true, result: 'Data sedang dimuat ulang.' };
}

function handleScrollToSection(args: Record<string, unknown>): { success: boolean; result: string } {
  const section = args.section as string;

  const element = document.querySelector(
    `[data-section="${section}"], #${section}, [id*="${section}"]`
  );

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return { success: true, result: `Scroll ke bagian ${section}.` };
  }

  return { success: false, result: `Bagian "${section}" tidak ditemukan di halaman ini.` };
}

function handleGetReportSummary(_args: Record<string, unknown>): { success: boolean; result: string } {
  // Count visible report items in the DOM
  const reportCards = document.querySelectorAll('[data-report-id], [data-report-card]');
  const count = reportCards.length;

  return {
    success: true,
    result: `Terdapat ${count} laporan yang ditampilkan di halaman saat ini.`,
  };
}

function handleAIAnalyze(args: Record<string, unknown>): { success: boolean; result: string } {
  const action = args.action as string;

  // Map to existing AI agent command events
  const actionMap: Record<string, string> = {
    auto_fill: 'AUTO_FILL_ATS',
    validate: 'VALIDATE_ATS',
    analyze_photos: 'AUTO_FILL_ATS',
  };

  const mappedAction = actionMap[action] || action;

  window.dispatchEvent(new CustomEvent('ai-agent-command', {
    detail: { action: mappedAction },
  }));

  toast.info('AI sedang menganalisis...');
  return { success: true, result: `Analisis AI (${action}) sedang diproses.` };
}
