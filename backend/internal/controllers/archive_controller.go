package controllers

import (
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/internal/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)

// ArchiveController handles archive management endpoints.
type ArchiveController struct {
	ArchiveService *services.ArchiveService
}

// NewArchiveController constructs an ArchiveController.
func NewArchiveController(archiveSvc *services.ArchiveService) *ArchiveController {
	return &ArchiveController{ArchiveService: archiveSvc}
}

// GetArchive handles GET /api/archive/{id}.
func (c *ArchiveController) GetArchive(w http.ResponseWriter, r *http.Request) {
	docID := strings.TrimPrefix(r.URL.Path, "/api/archive/")
	if docID == "" {
		helpers.SendAppError(w, apperrors.BadRequest("document ID is required"))
		return
	}

	ctx := r.Context()
	data, err := c.ArchiveService.GetArchive(ctx, docID)
	if err != nil {
		helpers.SendAppError(w, apperrors.NotFound("archived document"))
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "data": data})
}

// ListArchives handles GET /api/archive?collection={name}&limit={n}.
func (c *ArchiveController) ListArchives(w http.ResponseWriter, r *http.Request) {
	collection := r.URL.Query().Get("collection")
	if collection == "" {
		helpers.SendAppError(w, apperrors.BadRequest("collection query parameter is required"))
		return
	}

	ctx := r.Context()
	results, err := c.ArchiveService.ListByCollection(ctx, collection, 50)
	if err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"data":   results,
		"count":  len(results),
	})
}

// PermanentDelete handles DELETE /api/archive/{id} — admin permanently removes archived document.
func (c *ArchiveController) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	docID := strings.TrimPrefix(r.URL.Path, "/api/archive/")
	if docID == "" {
		helpers.SendAppError(w, apperrors.BadRequest("document ID is required"))
		return
	}

	ctx := r.Context()
	if err := c.ArchiveService.PermanentDelete(ctx, docID); err != nil {
		helpers.SendAppError(w, apperrors.Internal(err))
		return
	}
	helpers.SendNoContent(w)
}
