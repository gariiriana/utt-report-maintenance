package handler

import (
	"net/http"

	"github.com/gariiriana/utt-report-maintenance/api/internal/routes"
)

var mux *http.ServeMux

func init() {
	var err error
	mux, err = routes.SetupRoutes()
	if err != nil {
		panic("Failed to initialize routes: " + err.Error())
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	mux.ServeHTTP(w, r)
}
