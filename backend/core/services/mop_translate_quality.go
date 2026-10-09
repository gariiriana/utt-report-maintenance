// ============================================================================
// FILE: backend/core/services/mop_translate_quality.go
// Deskripsi: Pemeriksaan otomatis hasil terjemahan MOP per baris. Menangkap
//            pola "ngawur" khas model AI: kalimat setengah Inggris, angka/kode
//            yang berubah atau hilang, penomoran hilang, kalimat terpotong,
//            komentar tambahan, dan baris yang dibiarkan tidak diterjemahkan.
// ============================================================================

package services

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	mopWordRe          = regexp.MustCompile(`[A-Za-z][A-Za-z'’-]*`)
	mopNumberRe        = regexp.MustCompile(`\d+(?:[.,]\d+)*`)
	mopAbbrevRe        = regexp.MustCompile(`\b[A-Z]{2,6}\b`)
	mopListMarkerRe    = regexp.MustCompile(`^(\d{1,2}|[a-z])\.\s`)
	mopSectionRe       = regexp.MustCompile(`^Section\s+(\d+)\b`)
	mopOrdinalRe       = regexp.MustCompile(`^\d+(st|nd|rd|th)$`)
	mopForeignScriptRe = regexp.MustCompile(`[\p{Han}\p{Hiragana}\p{Katakana}\p{Hangul}\p{Cyrillic}\p{Thai}\p{Arabic}]`)
	mopCommentaryRe    = regexp.MustCompile(`(?i)^(terjemahan|translation)\b[^:]{0,20}:`)
	mopIndexLeftoverRe = regexp.MustCompile(`^\[\d+\]\s*`)
)

// Kata gramatikal Inggris yang tidak pernah muncul di kalimat Indonesia (huruf kecil saja,
// sehingga label panel seperti "ON/OFF" tidak terhitung). "a", "as", dan "per" sengaja
// tidak dimasukkan karena juga dipakai dalam bahasa Indonesia/penomoran.
var mopEnglishStopwords = setOf(
	"the", "and", "of", "to", "with", "for", "from", "by", "is", "are", "was", "were", "be", "been",
	"into", "onto", "before", "after", "during", "that", "this", "these", "those", "which", "when",
	"while", "each", "all", "any", "has", "have", "had", "will", "shall", "should", "must", "can",
	"could", "may", "not", "its", "their", "there", "than", "then", "until", "using", "between",
	"without", "within", "above", "below", "under", "over", "through", "on", "in", "at", "or", "an",
	"if", "it", "ensure", "check", "verify", "remove", "install", "open", "close", "clean", "record",
)

// Istilah teknis yang memang lazim dibiarkan dalam bahasa Inggris oleh teknisi data center.
var mopKeepTerms = setOf(
	"chiller", "chillers", "cooling", "tower", "towers", "nozzle", "nozzles", "spray", "header", "headers",
	"breaker", "breakers", "harness", "lanyard", "lanyards", "lifeline", "logsheet", "sump", "basin",
	"catwalk", "fill", "media", "pack", "starter", "valve", "butterfly", "drain", "seal", "tape", "strap",
	"gauge", "tachometer", "drift", "loss", "approach", "delta", "swirl", "spiral", "cone", "toolbox",
	"meeting", "inlet", "outlet", "bypass", "plug", "blind", "panel", "motor", "filter", "manual", "vendor",
	"standby", "handwheel", "padlock", "lockout", "tagout", "chilled", "water", "flushing", "sensor",
	"genset", "busbar", "plant", "control", "room", "hand-tight", "arrest", "fall", "full", "body",
)

// Kata-kata yang menandakan teks perlu diterjemahkan walaupun ditulis dengan huruf kapital
// (judul kolom/bagian). Teks tanpa kata seperti ini dan tanpa kata berhuruf kecil dianggap
// nama/merek/kode/jabatan yang boleh tidak diberi baris Indonesia.
var mopTranslatableWords = setOf(
	"method", "procedure", "procedures", "document", "title", "purpose", "number", "location", "work",
	"section", "overview", "information", "equipment", "sparepart", "spareparts", "serial", "manufacturer",
	"schedule", "execution", "date", "reference", "referenced", "ticket", "executed", "name", "job",
	"affected", "system", "attachment", "environmental", "health", "safety", "requirements", "requirement",
	"prerequisites", "time", "initial", "maintenance", "period", "instruction", "instructions", "conditions",
	"condition", "status", "action", "actions", "expected", "outcome", "back", "approval", "signature",
	"additional", "measuring", "instrument", "calibration", "brand", "author", "creation", "revision",
	"preventive", "corrective", "quantity", "description", "remarks", "note", "notes", "step", "steps",
	"result", "results", "checklist", "item", "items", "type", "capacity", "area", "risk", "hazard",
	"mitigation", "emergency", "contact", "responsible", "person", "team", "tools", "materials", "phase",
	"activity", "activities", "duration", "start", "finish", "end", "impact", "rollback", "summary",
)

// Kata kapital umum (label tombol/panel) yang tidak diperlakukan sebagai singkatan wajib.
var mopCommonCapsWords = setOf(
	"ON", "OFF", "AUTO", "LOCAL", "REMOTE", "MANUAL", "STOP", "START", "OPEN", "CLOSE", "CLOSED", "RUN",
	"TRIP", "RESET", "NOTE", "WARNING", "CAUTION", "DANGER", "OK", "YES", "NO", "AND", "OR", "THE", "FOR",
	"OF", "TO", "IN", "AT", "BY", "ALL", "NEW", "OLD",
)

// Satuan berhuruf kecil di depan ("2500 kVA") bukan kata Inggris yang perlu diterjemahkan.
var mopUnitWords = setOf("kva", "kvar", "kvah", "kwh", "mwh", "rpm", "psi", "mbar", "kpa", "mpa", "kgf", "mva", "mvar")

// Singkatan yang memang punya padanan Indonesia baku.
var mopAbbrevEquivalents = map[string]string{"PPE": "APD"}

func setOf(words ...string) map[string]bool {
	m := make(map[string]bool, len(words))
	for _, w := range words {
		m[w] = true
	}
	return m
}

// mopNeedsIDLine: false bila teks hanya nama orang/perusahaan, merek, kode, tanggal, atau jabatan,
// sehingga jawaban kosong ("tidak diterjemahkan") dari AI dapat diterima.
func mopNeedsIDLine(source string) bool {
	for _, w := range mopWordRe.FindAllString(source, -1) {
		lw := strings.ToLower(w)
		if mopUnitWords[lw] {
			continue
		}
		if mopEnglishStopwords[lw] || mopTranslatableWords[lw] {
			return true
		}
		if r, _ := utf8.DecodeRuneInString(w); unicode.IsLower(r) && utf8.RuneCountInString(w) >= 3 {
			return true
		}
	}
	return false
}

func normalizeForCompare(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func numberSet(s string) map[string]bool {
	set := make(map[string]bool)
	for _, n := range mopNumberRe.FindAllString(s, -1) {
		set[strings.ReplaceAll(n, ",", ".")] = true
	}
	return set
}

// codeTokens: token yang memuat huruf dan angka sekaligus (CT-02, UPS-01, 29°C, N+1).
func codeTokens(s string) []string {
	var codes []string
	for _, field := range strings.Fields(s) {
		token := strings.Trim(field, `.,;:()[]"'“”‘’`)
		if token == "" || mopOrdinalRe.MatchString(token) {
			continue
		}
		hasLetter, hasDigit := false, false
		for _, r := range token {
			hasLetter = hasLetter || unicode.IsLetter(r)
			hasDigit = hasDigit || unicode.IsDigit(r)
		}
		if hasLetter && hasDigit {
			codes = append(codes, token)
		}
	}
	return codes
}

func mostlyUppercase(s string) bool {
	upper, letters := 0, 0
	for _, r := range s {
		if unicode.IsLetter(r) {
			letters++
			if unicode.IsUpper(r) {
				upper++
			}
		}
	}
	return letters > 0 && float64(upper)/float64(letters) > 0.6
}

// checkMOPTranslation merapikan satu terjemahan dan mengembalikan masalah yang ditemukan
// ("" bila lolos). Terjemahan kosong berarti baris itu sengaja tidak diberi baris Indonesia.
func checkMOPTranslation(source, translation string) (string, string) {
	text := strings.Join(strings.Fields(translation), " ")
	text = mopIndexLeftoverRe.ReplaceAllString(text, "")
	if len(text) >= 2 && strings.HasPrefix(text, `"`) && strings.HasSuffix(text, `"`) && !strings.HasPrefix(source, `"`) {
		text = strings.TrimSpace(text[1 : len(text)-1])
	}

	needsID := mopNeedsIDLine(source)
	if text == "" || normalizeForCompare(text) == normalizeForCompare(source) {
		if needsID {
			return "", "Belum diterjemahkan (kosong atau masih sama dengan teks Inggris)"
		}
		return "", ""
	}

	if mopForeignScriptRe.MatchString(text) {
		return text, "Mengandung huruf asing di luar bahasa Indonesia"
	}
	if mopCommentaryRe.MatchString(text) {
		return text, "Berisi komentar/penjelasan, bukan terjemahan murni"
	}

	// Penomoran langkah ("a.", "1.") wajib tetap di awal; bila hilang, kembalikan secara otomatis.
	if m := mopListMarkerRe.FindString(source); m != "" && !strings.HasPrefix(text, strings.TrimSpace(m)) {
		text = m + text
	}
	if m := mopSectionRe.FindStringSubmatch(source); m != nil && !strings.HasPrefix(text, "Bagian "+m[1]) {
		return text, fmt.Sprintf(`Judul bagian harus diawali "Bagian %s"`, m[1])
	}
	if strings.Contains(source, "___") && !strings.Contains(text, "___") {
		return text, "Garis isian ____ hilang"
	}

	translatedNumbers := numberSet(text)
	for n := range numberSet(source) {
		if !translatedNumbers[n] {
			return text, fmt.Sprintf("Angka %s pada teks asli tidak ada di terjemahan", n)
		}
	}
	for _, code := range codeTokens(source) {
		if !strings.Contains(text, code) {
			return text, fmt.Sprintf("Kode/satuan %s berubah atau hilang", code)
		}
	}
	if !mostlyUppercase(source) {
		for _, abbr := range mopAbbrevRe.FindAllString(source, -1) {
			if mopCommonCapsWords[abbr] || strings.Contains(text, abbr) {
				continue
			}
			if eq, ok := mopAbbrevEquivalents[abbr]; ok && strings.Contains(text, eq) {
				continue
			}
			return text, fmt.Sprintf("Singkatan %s hilang dari terjemahan", abbr)
		}
	}

	// Kalimat campuran: kata gramatikal Inggris atau banyak kata Inggris yang tidak diterjemahkan.
	sourceWords := make(map[string]bool)
	for _, w := range mopWordRe.FindAllString(source, -1) {
		sourceWords[strings.ToLower(w)] = true
	}
	words := mopWordRe.FindAllString(text, -1)
	stopwords, lowerWords, untranslated := 0, 0, 0
	for _, w := range words {
		if r, _ := utf8.DecodeRuneInString(w); !unicode.IsLower(r) {
			continue // nama diri, merek, singkatan
		}
		if mopEnglishStopwords[w] {
			stopwords++
		}
		if utf8.RuneCountInString(w) >= 4 {
			lowerWords++
			if sourceWords[w] && !mopKeepTerms[w] {
				untranslated++
			}
		}
	}
	if stopwords >= 2 || (stopwords == 1 && len(words) <= 5) {
		return text, "Masih bercampur kata bahasa Inggris"
	}
	if untranslated >= 3 && float64(untranslated) >= 0.5*float64(lowerWords) {
		return text, "Sebagian besar kata belum diterjemahkan"
	}

	// Terjemahan Indonesia umumnya 0,9–1,4x panjang teks Inggris.
	srcLen, idLen := utf8.RuneCountInString(source), utf8.RuneCountInString(text)
	if srcLen >= 40 && float64(idLen) < 0.5*float64(srcLen) {
		return text, "Terjemahan terlalu pendek, kemungkinan ada bagian yang terlewat"
	}
	if srcLen >= 20 && float64(idLen) > 2.5*float64(srcLen)+20 {
		return text, "Terjemahan terlalu panjang, kemungkinan ada tambahan yang tidak ada di teks asli"
	}
	return text, ""
}
