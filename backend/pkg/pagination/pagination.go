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
type Request struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
type Response struct {
	Data        interface{} `json:"data"`
	Total       int64       `json:"total"`
	Page        int         `json:"page"`
	PageSize    int         `json:"page_size"`
	TotalPages  int         `json:"total_pages"`
	HasPrevPage bool        `json:"has_prev_page"`
	HasNextPage bool        `json:"has_next_page"`
}
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
func (p Request) Offset() int {
	return (p.Page - 1) * p.PageSize
}
func (p Request) Limit() int {
	return p.PageSize
}
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
type Meta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalItems int64 `json:"total_items"`
	TotalPages int   `json:"total_pages"`
}
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
