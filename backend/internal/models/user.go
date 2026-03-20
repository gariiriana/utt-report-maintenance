package models

import "time"

// UserRole defines the set of roles a user may have in the system.
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleHSE       UserRole = "hse"
	RoleDirector  UserRole = "director"
	RoleEngineer  UserRole = "engineer"
	RoleGuest     UserRole = "guest"
)

// User represents a user record as stored in Firestore under the "users" collection.
type User struct {
	UID           string    `json:"uid" firestore:"uid"`
	Email         string    `json:"email" firestore:"email"`
	DisplayName   string    `json:"display_name" firestore:"display_name"`
	PhotoURL      string    `json:"photo_url,omitempty" firestore:"photo_url,omitempty"`
	Role          UserRole  `json:"role" firestore:"role"`
	Department    string    `json:"department,omitempty" firestore:"department,omitempty"`
	IsActive      bool      `json:"is_active" firestore:"is_active"`
	EmailVerified bool      `json:"email_verified" firestore:"email_verified"`
	LastLoginAt   time.Time `json:"last_login_at" firestore:"last_login_at"`
	CreatedAt     time.Time `json:"created_at" firestore:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" firestore:"updated_at"`
}

// UpdateUserRequest is the request body for updating a user's role/department.
type UpdateUserRequest struct {
	Role       UserRole `json:"role"`
	Department string   `json:"department,omitempty"`
	IsActive   *bool    `json:"is_active,omitempty"`
}

// UserProfile is the safe public view of a user (no sensitive fields).
type UserProfile struct {
	UID         string   `json:"uid"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	PhotoURL    string   `json:"photo_url,omitempty"`
	Role        UserRole `json:"role"`
	Department  string   `json:"department,omitempty"`
}

// ToProfile converts a full User to a public UserProfile.
func (u *User) ToProfile() UserProfile {
	return UserProfile{
		UID:         u.UID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		PhotoURL:    u.PhotoURL,
		Role:        u.Role,
		Department:  u.Department,
	}
}

// IsAdmin returns true when the user's role is admin.
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// AllowedRoles returns a slice of all valid UserRole values.
func AllowedRoles() []string {
	return []string{
		string(RoleAdmin),
		string(RoleHSE),
		string(RoleDirector),
		string(RoleEngineer),
		string(RoleGuest),
	}
}
