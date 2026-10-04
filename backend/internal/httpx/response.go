// Package httpx holds HTTP helpers shared by all handlers: the JSON envelope,
// error mapping, request decoding/validation and pagination (docs/05 §1).
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// JSON writes v as JSON with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("httpx: encode response", "error", err)
	}
}

type dataEnvelope struct {
	Data any `json:"data"`
}

type listEnvelope struct {
	Data any  `json:"data"`
	Meta Meta `json:"meta"`
}

// Data writes {"data": v}.
func Data(w http.ResponseWriter, status int, v any) {
	JSON(w, status, dataEnvelope{Data: v})
}

// List writes {"data": items, "meta": meta} with status 200. A nil slice is
// rendered as an empty array by callers passing a non-nil slice; if items is
// nil it is rendered as [].
func List(w http.ResponseWriter, items any, meta Meta) {
	if items == nil {
		items = []any{}
	}
	JSON(w, http.StatusOK, listEnvelope{Data: items, Meta: meta})
}

// NoContent writes 204.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
