package models

import "time"
type UserRole string

const (
	RoleAdmin       UserRole = "admin"
	RoleQCDME       UserRole = "qc_dme"
	RoleHSE         UserRole = "hse"
	RoleDirector    UserRole = "director"
	RoleEngineer    UserRole = "engineer"
	RoleSiteManager UserRole = "site_manager"
	RoleManager     UserRole = "manager"
	RoleGuest       UserRole = "guest"
)
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
type UpdateUserRequest struct {
	Role       UserRole `json:"role"`
	Department string   `json:"department,omitempty"`
	IsActive   *bool    `json:"is_active,omitempty"`
}
type UserProfile struct {
	UID         string   `json:"uid"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	PhotoURL    string   `json:"photo_url,omitempty"`
	Role        UserRole `json:"role"`
	Department  string   `json:"department,omitempty"`
}
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
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin || u.Role == RoleQCDME
}
func AllowedRoles() []string {
	return []string{
		string(RoleAdmin),
		string(RoleQCDME),
		string(RoleHSE),
		string(RoleDirector),
		string(RoleEngineer),
		string(RoleSiteManager),
		string(RoleGuest),
	}
}
