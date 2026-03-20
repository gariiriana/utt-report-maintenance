package pagination

import (
	"math"
	"net/http"
	"strconv"
)

const (
	DefaultPage     = 1
	DefaultPageSize = 20
	MaxPageSize     = 100
	MinPageSize     = 1
)

// Request holds pagination parameters parsed from an HTTP query string.
type Request struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

// Response wraps a paginated result set with metadata.
type Response struct {
	Data        interface{} `json:"data"`
	Total       int64       `json:"total"`
	Page        int         `json:"page"`
	PageSize    int         `json:"page_size"`
	TotalPages  int         `json:"total_pages"`
	HasPrevPage bool        `json:"has_prev_page"`
	HasNextPage bool        `json:"has_next_page"`
}

// ParseRequest extracts and validates pagination parameters from an HTTP request.
// Falls back to sensible defaults on invalid or missing values.
func ParseRequest(r *http.Request) Request {
	page := queryInt(r, "page", DefaultPage)
	pageSize := queryInt(r, "page_size", DefaultPageSize)

	if page < 1 {
		page = DefaultPage
	}
	if pageSize < MinPageSize {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}

	return Request{Page: page, PageSize: pageSize}
}

// Offset calculates the Firestore / database offset for the current page.
func (p Request) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// Limit returns the page size (alias for clarity in query building).
func (p Request) Limit() int {
	return p.PageSize
}

// BuildResponse constructs a paginated response struct given data and total count.
func BuildResponse(data interface{}, total int64, req Request) Response {
	totalPages := int(math.Ceil(float64(total) / float64(req.PageSize)))
	if totalPages < 1 {
		totalPages = 1
	}
	return Response{
		Data:        data,
		Total:       total,
		Page:        req.Page,
		PageSize:    req.PageSize,
		TotalPages:  totalPages,
		HasPrevPage: req.Page > 1,
		HasNextPage: req.Page < totalPages,
	}
}

// queryInt parses an integer query parameter with a fallback default.
func queryInt(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return n
}

// Meta is a lightweight version used for embedding in nested responses.
type Meta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalItems int64 `json:"total_items"`
	TotalPages int   `json:"total_pages"`
}

// BuildMeta is a convenience constructor for Meta.
func BuildMeta(total int64, req Request) Meta {
	totalPages := int(math.Ceil(float64(total) / float64(req.PageSize)))
	if totalPages < 1 {
		totalPages = 1
	}
	return Meta{
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalItems: total,
		TotalPages: totalPages,
	}
}
