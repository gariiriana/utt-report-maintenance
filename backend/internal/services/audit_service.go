package services

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/models"
	"github.com/gariiriana/utt-report-maintenance/backend/internal/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

// AuditService creates and queries structured audit log entries.
type AuditService struct {
	Repo *repositories.AuditRepository
}

// NewAuditService constructs a new AuditService.
func NewAuditService(repo *repositories.AuditRepository) *AuditService {
	return &AuditService{Repo: repo}
}

// Log creates an audit log entry in Firestore.
// This is best-effort: failures are logged to stderr but not propagated.
func (s *AuditService) Log(ctx context.Context, entry models.AuditLog) {
	data := map[string]interface{}{
		"action":       string(entry.Action),
		"user_uid":     entry.UserUID,
		"user_email":   entry.UserEmail,
		"user_role":    entry.UserRole,
		"collection":   entry.Collection,
		"resource_id":  entry.ResourceID,
		"request_id":   entry.RequestID,
		"remote_ip":    entry.RemoteIP,
		"user_agent":   entry.UserAgent,
		"success":      entry.Success,
		"error_detail": entry.ErrorDetail,
		"timestamp":    entry.Timestamp,
	}
	if err := s.Repo.Save(ctx, data); err != nil {
		logger.Error("audit_service: failed to save audit log", "error", err.Error())
	}
}

// LogAction is a convenience builder that creates and persists an audit entry from components.
func (s *AuditService) LogAction(ctx context.Context, action models.AuditAction, uid, email, role, collection, resourceID, requestID, remoteIP string, success bool, errDetail string) {
	entry := models.NewAuditLog(action, uid, email, role, collection, resourceID, requestID, remoteIP, success)
	entry.ErrorDetail = errDetail
	s.Log(ctx, entry)
}

// GetByUser retrieves audit entries for a specific user.
func (s *AuditService) GetByUser(ctx context.Context, userUID string, limit int) ([]map[string]interface{}, error) {
	snaps, err := s.Repo.ListByUser(ctx, userUID, limit)
	if err != nil {
		return nil, fmt.Errorf("AuditService.GetByUser: %w", err)
	}
	return snapsToMaps(snaps), nil
}

// GetAll retrieves all audit entries (admin only).
func (s *AuditService) GetAll(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	snaps, err := s.Repo.ListAll(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("AuditService.GetAll: %w", err)
	}
	return snapsToMaps(snaps), nil
}

// snapsToMaps converts a slice of Firestore document snapshots to raw data maps,
// enriching each with the document's ID.
func snapsToMaps(snaps []*firestore.DocumentSnapshot) []map[string]interface{} {
	results := make([]map[string]interface{}, 0, len(snaps))
	for _, snap := range snaps {
		if snap == nil || !snap.Exists() {
			continue
		}
		d := snap.Data()
		d["id"] = snap.Ref.ID
		results = append(results, d)
	}
	return results
}

// SecurityEvent logs a security-relevant event specifically (always success=false).
func (s *AuditService) SecurityEvent(ctx context.Context, event, uid, remoteIP, requestID, detail string) {
	entry := models.AuditLog{
		Action:      models.ActionDeny,
		UserUID:     uid,
		RemoteIP:    remoteIP,
		RequestID:   requestID,
		ErrorDetail: fmt.Sprintf("[%s] %s", event, detail),
		Success:     false,
		Timestamp:   time.Now().UTC(),
	}
	s.Log(ctx, entry)
}
