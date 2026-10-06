package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/core/services"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/helpers"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
)

// faceMaxBody: pendaftaran membawa sampai 5 foto JPEG kecil (≤ 80 KB) + 5 descriptor.
const faceMaxBody = 1 << 20

// FaceController: endpoint gerbang scan wajah (POST /api/face/*). Semua butuh login
// password (ID token); endpoint admin juga butuh sesi wajah reviewer. Lihat scanning.md.
type FaceController struct {
	svc *services.FaceService
}

func NewFaceController(svc *services.FaceService) *FaceController {
	return &FaceController{svc: svc}
}

// Route memilih handler berdasarkan path di bawah /api/face/.
func (c *FaceController) Route(w http.ResponseWriter, r *http.Request) {
	caller, ok := faceCaller(r)
	if !ok {
		helpers.SendError(w, "Silakan login dengan email dan password terlebih dahulu.", http.StatusUnauthorized)
		return
	}
	ctx := r.Context()

	switch strings.TrimPrefix(r.URL.Path, "/api/face/") {
	case "state":
		var in struct {
			EnrollmentIDs []string `json:"enrollmentIds"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			list, err := c.svc.State(ctx, in.EnrollmentIDs)
			return map[string]interface{}{"enrollments": list}, err
		})
	case "verify":
		var in struct {
			Descriptors [][]float64 `json:"descriptors"`
			Device      string      `json:"device"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return c.svc.Verify(ctx, caller, in.Descriptors, in.Device)
		})
	case "check-session":
		faceRespond(w, r, nil, func() (interface{}, error) {
			return c.svc.CheckSession(ctx, caller)
		})
	case "enroll":
		var in services.FaceEnrollInput
		faceRespond(w, r, &in, func() (interface{}, error) {
			return c.svc.Enroll(ctx, caller, in)
		})
	case "scan-issue":
		var in struct {
			Issue  string `json:"issue"`
			Device string `json:"device"`
			Detail string `json:"detail"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return map[string]bool{"ok": true}, c.svc.ReportScanIssue(ctx, caller, in.Issue, in.Device, in.Detail)
		})
	case "break-glass":
		var in struct {
			Code string `json:"code"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return c.svc.BreakGlass(ctx, caller, strings.TrimSpace(in.Code))
		})
	case "admin/list":
		faceRespond(w, r, nil, func() (interface{}, error) {
			list, err := c.svc.AdminList(ctx, caller)
			return map[string]interface{}{"profiles": list}, err
		})
	case "admin/audit":
		faceRespond(w, r, nil, func() (interface{}, error) {
			list, err := c.svc.AdminAudit(ctx, caller)
			return map[string]interface{}{"entries": list}, err
		})
	case "admin/review":
		var in struct {
			ID      string `json:"id"`
			Approve bool   `json:"approve"`
			Reason  string `json:"reason"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return map[string]bool{"success": true}, c.svc.AdminReview(ctx, caller, in.ID, in.Approve, in.Reason)
		})
	case "admin/merge":
		var in struct {
			ID     string `json:"id"`
			IntoID string `json:"intoId"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return map[string]bool{"success": true}, c.svc.AdminMerge(ctx, caller, in.ID, in.IntoID)
		})
	case "admin/delete":
		var in struct {
			ID string `json:"id"`
		}
		faceRespond(w, r, &in, func() (interface{}, error) {
			return map[string]bool{"success": true}, c.svc.AdminDelete(ctx, caller, in.ID)
		})
	default:
		helpers.SendError(w, "route not found", http.StatusNotFound)
	}
}

func faceCaller(r *http.Request) (services.FaceCaller, bool) {
	token, ok := middlewares.ClaimsFromContext(r.Context())
	if !ok || token == nil {
		return services.FaceCaller{}, false
	}
	email, _ := token.Claims["email"].(string)
	return services.FaceCaller{
		UID:   token.UID,
		Email: strings.ToLower(email),
		Token: token,
		IP:    helpers.GetClientIP(r),
	}, true
}

// faceRespond membaca body JSON (jika in != nil), menjalankan fn, lalu mengirim hasilnya.
// FaceError dikirim apa adanya (pesan aman untuk user); error lain dicatat dan disamarkan.
func faceRespond(w http.ResponseWriter, r *http.Request, in interface{}, fn func() (interface{}, error)) {
	if in != nil {
		r.Body = http.MaxBytesReader(w, r.Body, faceMaxBody)
		if err := json.NewDecoder(r.Body).Decode(in); err != nil {
			helpers.SendError(w, "Data yang dikirim tidak valid.", http.StatusBadRequest)
			return
		}
	}
	out, err := fn()
	if err != nil {
		var fe *services.FaceError
		if errors.As(err, &fe) {
			helpers.SendError(w, fe.Message, fe.Status)
			return
		}
		logger.Error("face endpoint failed", "path", r.URL.Path, "error", err)
		helpers.SendError(w, "Terjadi kesalahan di server verifikasi wajah. Coba lagi.", http.StatusInternalServerError)
		return
	}
	helpers.SendJSON(w, http.StatusOK, out)
}
