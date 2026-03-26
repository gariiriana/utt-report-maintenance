package models

import "time"
type AuditAction string

const (
	ActionCreate AuditAction = "CREATE"
	ActionRead   AuditAction = "READ"
	ActionUpdate AuditAction = "UPDATE"
	ActionDelete AuditAction = "DELETE"
	ActionLogin  AuditAction = "LOGIN"
	ActionLogout AuditAction = "LOGOUT"
	ActionExport AuditAction = "EXPORT"
	ActionDeny   AuditAction = "ACCESS_DENIED"
)
type AuditLog struct {
	ID          string      `json:"id" firestore:"id"`
	Action      AuditAction `json:"action" firestore:"action"`
	UserUID     string      `json:"user_uid" firestore:"user_uid"`
	UserEmail   string      `json:"user_email,omitempty" firestore:"user_email,omitempty"`
	UserRole    string      `json:"user_role,omitempty" firestore:"user_role,omitempty"`
	ResourceID  string      `json:"resource_id,omitempty" firestore:"resource_id,omitempty"`
	Collection  string      `json:"collection,omitempty" firestore:"collection,omitempty"`
	RequestID   string      `json:"request_id,omitempty" firestore:"request_id,omitempty"`
	RemoteIP    string      `json:"remote_ip,omitempty" firestore:"remote_ip,omitempty"`
	UserAgent   string      `json:"user_agent,omitempty" firestore:"user_agent,omitempty"`
	Success     bool        `json:"success" firestore:"success"`
	ErrorDetail string      `json:"error_detail,omitempty" firestore:"error_detail,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty" firestore:"metadata,omitempty"`
	Timestamp   time.Time   `json:"timestamp" firestore:"timestamp"`
}
func NewAuditLog(action AuditAction, userUID, userEmail, role, collection, resourceID, requestID, remoteIP string, success bool) AuditLog {
	return AuditLog{
		Action:     action,
		UserUID:    userUID,
		UserEmail:  userEmail,
		UserRole:   role,
		Collection: collection,
		ResourceID: resourceID,
		RequestID:  requestID,
		RemoteIP:   remoteIP,
		Success:    success,
		Timestamp:  time.Now().UTC(),
	}
}
type AuditLogFilter struct {
	UserUID    string      `json:"user_uid,omitempty"`
	Action     AuditAction `json:"action,omitempty"`
	Collection string      `json:"collection,omitempty"`
	DateFrom   time.Time   `json:"date_from,omitempty"`
	DateTo     time.Time   `json:"date_to,omitempty"`
}
