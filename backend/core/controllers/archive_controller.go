package controllers

import (
	"net/http"
	"strings"

	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
	apperrors "github.com/gariiriana/utt-report-maintenance/backend/pkg/errors"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/helpers"
)
type ArchiveController struct {
	ArchiveService *services.ArchiveService
}
func NewArchiveController(archiveSvc *services.ArchiveService) *ArchiveController {
	return &ArchiveController{ArchiveService: archiveSvc}
}
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
