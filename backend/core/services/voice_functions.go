package services

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE FUNCTION DECLARATIONS — Gemini Function Calling Schema
// ═══════════════════════════════════════════════════════════════════════════════

// GetVoiceFunctionDeclarations returns all available function declarations
// for the AI Voice Agent. These are sent to Gemini to enable function calling.
func GetVoiceFunctionDeclarations() []GeminiFunctionDeclaration {
	return []GeminiFunctionDeclaration{
		// ─── NAVIGATION ─────────────────────────────────────────────
		{
			Name:        "navigate_to_page",
			Description: "Navigasi user ke halaman tertentu di aplikasi. Gunakan saat user meminta membuka halaman, berpindah menu, atau melihat fitur tertentu.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"page": {
						Type:        "string",
						Description: "Nama halaman tujuan",
						Enum: []string{
							"dashboard",
							"service_report",
							"ats_report",
							"maintenance_progress",
							"findings",
							"document_list",
							"file_management",
							"user_management",
							"audit_log",
							"archive",
							"sla_form",
							"ptw_management",
							"hse_report",
							"corrective_maintenance",
						},
					},
				},
				Required: []string{"page"},
			},
		},

		// ─── REPORT OPERATIONS ──────────────────────────────────────
		{
			Name:        "create_service_report",
			Description: "Buat service report baru. Gunakan saat user meminta membuat laporan baru, report baru, atau service report baru.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"report_type": {
						Type:        "string",
						Description: "Tipe laporan yang akan dibuat",
						Enum:        []string{"service_report", "ats_report"},
					},
				},
				Required: []string{"report_type"},
			},
		},
		{
			Name:        "search_reports",
			Description: "Cari laporan berdasarkan kriteria. Gunakan saat user meminta mencari, menemukan, atau menampilkan laporan tertentu.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"query": {
						Type:        "string",
						Description: "Kata kunci pencarian (nama customer, nomor report, dll)",
					},
					"customer": {
						Type:        "string",
						Description: "Nama customer/perusahaan untuk filter",
					},
					"date_range": {
						Type:        "string",
						Description: "Rentang waktu: today, this_week, this_month, last_month, atau format YYYY-MM-DD",
						Enum:        []string{"today", "this_week", "this_month", "last_month"},
					},
					"status": {
						Type:        "string",
						Description: "Status laporan",
						Enum:        []string{"draft", "submitted", "approved", "rejected"},
					},
				},
			},
		},
		{
			Name:        "open_report",
			Description: "Buka laporan tertentu untuk dilihat atau diedit. Gunakan saat user meminta membuka, melihat, atau mengedit laporan dengan nomor/ID tertentu.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"report_id": {
						Type:        "string",
						Description: "ID atau nomor laporan yang akan dibuka",
					},
					"mode": {
						Type:        "string",
						Description: "Mode: view untuk melihat, edit untuk mengedit",
						Enum:        []string{"view", "edit"},
					},
				},
				Required: []string{"report_id"},
			},
		},
		{
			Name:        "export_pdf",
			Description: "Export laporan aktif atau laporan tertentu sebagai PDF. Gunakan saat user meminta download, export, atau cetak PDF.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"report_id": {
						Type:        "string",
						Description: "ID laporan yang akan di-export. Kosongkan jika ingin export laporan yang sedang aktif.",
					},
				},
			},
		},
		{
			Name:        "delete_report",
			Description: "Hapus laporan tertentu. Gunakan saat user meminta menghapus laporan. SELALU konfirmasi terlebih dahulu sebelum menghapus.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"report_id": {
						Type:        "string",
						Description: "ID laporan yang akan dihapus",
					},
					"confirm": {
						Type:        "string",
						Description: "Apakah user sudah mengonfirmasi penghapusan",
						Enum:        []string{"yes", "no", "ask"},
					},
				},
				Required: []string{"report_id", "confirm"},
			},
		},

		// ─── FORM OPERATIONS ────────────────────────────────────────
		{
			Name:        "fill_form_field",
			Description: "Isi field tertentu pada form yang sedang aktif/terbuka. Gunakan saat user memberikan informasi yang harus diisi ke form.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"field_name": {
						Type:        "string",
						Description: "Nama field yang akan diisi (contoh: customer_name, location, work_description, engineer_name, date, panel_id, dll)",
					},
					"value": {
						Type:        "string",
						Description: "Nilai yang akan diisi",
					},
				},
				Required: []string{"field_name", "value"},
			},
		},
		{
			Name:        "fill_form_bulk",
			Description: "Isi beberapa field form sekaligus. Gunakan saat user memberikan banyak informasi dalam satu kalimat yang harus diisi ke beberapa field.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"fields": {
						Type:        "string",
						Description: "JSON string berisi key-value pairs, contoh: {\"customer_name\":\"PT ABC\",\"location\":\"Jakarta\",\"date\":\"2026-07-20\"}",
					},
				},
				Required: []string{"fields"},
			},
		},
		{
			Name:        "save_changes",
			Description: "Simpan perubahan pada form/laporan yang sedang aktif. Gunakan saat user meminta menyimpan, save, atau submit.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"action": {
						Type:        "string",
						Description: "Tipe penyimpanan",
						Enum:        []string{"save_draft", "submit", "save"},
					},
				},
			},
		},

		// ─── UI OPERATIONS ──────────────────────────────────────────
		{
			Name:        "click_button",
			Description: "Klik tombol tertentu di halaman. Gunakan saat user meminta mengklik tombol tertentu.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"button_id": {
						Type:        "string",
						Description: "ID atau label tombol yang akan diklik (contoh: submit, export, refresh, add_new, delete, cancel)",
					},
				},
				Required: []string{"button_id"},
			},
		},
		{
			Name:        "close_modal",
			Description: "Tutup popup/modal/dialog yang sedang terbuka. Gunakan saat user meminta menutup popup atau dialog.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"modal_id": {
						Type:        "string",
						Description: "ID modal yang akan ditutup. Kosongkan untuk menutup modal teratas.",
					},
				},
			},
		},
		{
			Name:        "filter_data",
			Description: "Filter data di tabel/list berdasarkan kriteria. Gunakan saat user meminta memfilter data berdasarkan customer, tanggal, status, dll.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"filter_type": {
						Type:        "string",
						Description: "Tipe filter",
						Enum:        []string{"customer", "date", "status", "engineer", "location", "search"},
					},
					"value": {
						Type:        "string",
						Description: "Nilai filter",
					},
				},
				Required: []string{"filter_type", "value"},
			},
		},
		{
			Name:        "refresh_data",
			Description: "Refresh/muat ulang data di halaman aktif. Gunakan saat user meminta refresh, reload, atau muat ulang data.",
			Parameters: &GeminiSchema{
				Type:       "object",
				Properties: map[string]GeminiProperty{},
			},
		},
		{
			Name:        "scroll_to_section",
			Description: "Scroll ke bagian tertentu di halaman. Gunakan saat user meminta melihat bagian tertentu dari halaman/form.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"section": {
						Type:        "string",
						Description: "Nama bagian tujuan (contoh: visual_inspection, power_meter, grounding, thermal, summary)",
					},
				},
				Required: []string{"section"},
			},
		},

		// ─── DATA RETRIEVAL ─────────────────────────────────────────
		{
			Name:        "get_report_summary",
			Description: "Ambil ringkasan laporan atau data statistik. Gunakan saat user bertanya tentang jumlah laporan, statistik, atau ringkasan.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"period": {
						Type:        "string",
						Description: "Periode waktu",
						Enum:        []string{"today", "this_week", "this_month", "all"},
					},
				},
			},
		},
		{
			Name:        "ai_analyze_report",
			Description: "Minta AI menganalisis laporan yang sedang aktif menggunakan vision AI. Gunakan saat user meminta analisis foto, auto-fill, atau bantuan AI untuk mengisi laporan.",
			Parameters: &GeminiSchema{
				Type: "object",
				Properties: map[string]GeminiProperty{
					"action": {
						Type:        "string",
						Description: "Tipe analisis",
						Enum:        []string{"auto_fill", "validate", "analyze_photos"},
					},
				},
				Required: []string{"action"},
			},
		},
	}
}
