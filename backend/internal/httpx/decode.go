package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// MaxBodyBytes is the maximum accepted JSON request body size.
const MaxBodyBytes = 1 << 20 // 1 MiB

var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	// Report JSON field names instead of Go struct field names.
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		if name == "" {
			return f.Name
		}
		return name
	})
	return v
}

// Validate runs struct validation on v. The returned error (if any) is a
// validator.ValidationErrors, which WriteError maps to 422.
func Validate(v any) error {
	return validate.Struct(v)
}

// Decode reads a JSON body (max 1 MiB, unknown fields rejected) into v and
// validates it. Decoding problems are returned as *Error (400/413); validation
// problems as validator.ValidationErrors.
func Decode(r *http.Request, v any) error {
	// A nil ResponseWriter is accepted by MaxBytesReader; the limit still applies.
	r.Body = http.MaxBytesReader(nil, r.Body, MaxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return decodeError(err)
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return BadRequest("Body JSON harus berisi satu objek.")
	}
	return Validate(v)
}

func decodeError(err error) error {
	var syntaxErr *json.SyntaxError
	var typeErr *json.UnmarshalTypeError
	var maxErr *http.MaxBytesError
	switch {
	case errors.As(err, &maxErr):
		return PayloadTooLarge()
	case errors.Is(err, io.EOF):
		return BadRequest("Body JSON kosong.")
	case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
		return BadRequest("Format JSON tidak valid.")
	case errors.As(err, &typeErr):
		return BadRequest(fmt.Sprintf("Tipe data untuk field %q tidak sesuai.", typeErr.Field))
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		field := strings.TrimPrefix(err.Error(), "json: unknown field ")
		return BadRequest(fmt.Sprintf("Field %s tidak dikenal.", field))
	default:
		return BadRequest("Format JSON tidak valid.")
	}
}

// validationFields converts validator errors to {json_field: Indonesian message}.
func validationFields(verrs validator.ValidationErrors) map[string]string {
	fields := make(map[string]string, len(verrs))
	for _, fe := range verrs {
		key := fieldKey(fe)
		if _, exists := fields[key]; exists {
			continue
		}
		fields[key] = fieldMessage(fe)
	}
	return fields
}

// fieldKey returns the dotted JSON path without the root struct name.
func fieldKey(fe validator.FieldError) string {
	ns := fe.Namespace()
	if i := strings.IndexByte(ns, '.'); i >= 0 {
		return ns[i+1:]
	}
	return fe.Field()
}

func fieldMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required", "required_if", "required_unless", "required_with", "required_without":
		return "Wajib diisi."
	case "email":
		return "Format email tidak valid."
	case "url", "http_url", "uri":
		return "Format URL tidak valid."
	case "min":
		if isString(fe) {
			return fmt.Sprintf("Minimal %s karakter.", fe.Param())
		}
		return fmt.Sprintf("Minimal %s.", fe.Param())
	case "max":
		if isString(fe) {
			return fmt.Sprintf("Maksimal %s karakter.", fe.Param())
		}
		return fmt.Sprintf("Maksimal %s.", fe.Param())
	case "len":
		return fmt.Sprintf("Panjang harus %s.", fe.Param())
	case "gte":
		return fmt.Sprintf("Harus lebih besar atau sama dengan %s.", fe.Param())
	case "lte":
		return fmt.Sprintf("Harus lebih kecil atau sama dengan %s.", fe.Param())
	case "oneof":
		return fmt.Sprintf("Harus salah satu dari: %s.", fe.Param())
	default:
		return "Nilai tidak valid."
	}
}

func isString(fe validator.FieldError) bool {
	return fe.Kind() == reflect.String
}
