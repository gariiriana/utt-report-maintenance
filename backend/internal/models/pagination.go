package models

import "time"
type PaginationRequest struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
type PaginatedResponse struct {
	Status string      `json:"status"`
	Data   interface{} `json:"data"`
	Meta   PageMeta    `json:"meta"`
}
type PageMeta struct {
	CurrentPage  int   `json:"current_page"`
	PageSize     int   `json:"page_size"`
	TotalItems   int64 `json:"total_items"`
	TotalPages   int   `json:"total_pages"`
	HasNextPage  bool  `json:"has_next_page"`
	HasPrevPage  bool  `json:"has_prev_page"`
}
type CursorPaginationRequest struct {
	Limit      int    `json:"limit"`
	StartAfter string `json:"start_after,omitempty"` // document ID to start after
}
type CursorPaginationResponse struct {
	Status     string      `json:"status"`
	Data       interface{} `json:"data"`
	NextCursor string      `json:"next_cursor,omitempty"`
	HasMore    bool        `json:"has_more"`
	FetchedAt  time.Time   `json:"fetched_at"`
}
