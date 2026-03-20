package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/pkg/logger"
)

// NotificationPayload is the body sent to a webhook endpoint.
type NotificationPayload struct {
	Event     string                 `json:"event"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// NotificationService sends in-app events and outbound webhooks.
type NotificationService struct {
	webhookURL string
	httpClient *http.Client
}

// NewNotificationService constructs a NotificationService.
// If webhookURL is empty, outbound webhook calls are skipped.
func NewNotificationService(webhookURL string) *NotificationService {
	return &NotificationService{
		webhookURL: webhookURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendWebhook dispatches an event payload to the configured webhook URL.
// The call is async (fire-and-forget) with structured error logging.
func (s *NotificationService) SendWebhook(ctx context.Context, event string, data map[string]interface{}) {
	if s.webhookURL == "" {
		return
	}
	go func() {
		payload := NotificationPayload{
			Event:     event,
			Timestamp: time.Now().UTC(),
			Data:      data,
		}
		body, err := json.Marshal(payload)
		if err != nil {
			logger.Error("notification_service: marshal error", "event", event, "error", err.Error())
			return
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.webhookURL, bytes.NewReader(body))
		if err != nil {
			logger.Error("notification_service: request creation failed", "event", event, "error", err.Error())
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			logger.Warn("notification_service: webhook delivery failed", "event", event, "error", err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			logger.Warn("notification_service: webhook responded with error",
				"event", event,
				"status", resp.StatusCode,
			)
		}
	}()
}

// NotifyReportCreated emits a report.created webhook event.
func (s *NotificationService) NotifyReportCreated(ctx context.Context, collectionName, docID, userUID string) {
	s.SendWebhook(ctx, "report.created", map[string]interface{}{
		"collection": collectionName,
		"doc_id":     docID,
		"user_uid":   userUID,
	})
}

// NotifyReportDeleted emits a report.deleted webhook event.
func (s *NotificationService) NotifyReportDeleted(ctx context.Context, collectionName, docID, userUID string) {
	s.SendWebhook(ctx, "report.deleted", map[string]interface{}{
		"collection": collectionName,
		"doc_id":     docID,
		"user_uid":   userUID,
	})
}

// NotifyUserRoleChanged emits a user.role_changed webhook event.
func (s *NotificationService) NotifyUserRoleChanged(ctx context.Context, uid, oldRole, newRole string) {
	msg := fmt.Sprintf("User %s role changed: %s → %s", uid, oldRole, newRole)
	s.SendWebhook(ctx, "user.role_changed", map[string]interface{}{
		"user_uid": uid,
		"old_role": oldRole,
		"new_role": newRole,
		"message":  msg,
	})
	logger.Info("notification_service: user role changed", "uid", uid, "old_role", oldRole, "new_role", newRole)
}
