package homepage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"portal-berita/backend/internal/apperr"
)

// Registry holds the section type specs (single source for validation,
// defaults and JSON Schema). It is immutable after NewRegistry and safe for
// concurrent use.
type Registry struct {
	order    []string
	specs    map[string]TypeSpec
	patterns map[string]*regexp.Regexp
}

// TypeInfo is one entry of GET /admin/homepage/section-types.
type TypeInfo struct {
	Type          string          `json:"type"`
	Label         string          `json:"label"`
	Description   string          `json:"description"`
	Schema        map[string]any  `json:"schema"`
	DefaultConfig json.RawMessage `json:"default_config"`
}

// NewRegistry returns the registry of the 13 section types.
func NewRegistry() *Registry {
	r := &Registry{specs: map[string]TypeSpec{}, patterns: map[string]*regexp.Regexp{}}
	for _, s := range typeSpecs() {
		s.Fields = concat(commonFields, s.Fields)
		r.order = append(r.order, s.Type)
		r.specs[s.Type] = s
		r.compilePatterns(s.Fields)
	}
	return r
}

func (r *Registry) compilePatterns(fields []Field) {
	for _, f := range fields {
		if f.Pattern != "" {
			if _, ok := r.patterns[f.Pattern]; !ok {
				r.patterns[f.Pattern] = regexp.MustCompile(f.Pattern)
			}
		}
		r.compilePatterns(f.Fields)
	}
}

// Has reports whether typ is a registered section type.
func (r *Registry) Has(typ string) bool {
	_, ok := r.specs[typ]
	return ok
}

// TypeNames returns the registered types in registry order.
func (r *Registry) TypeNames() []string { return slices.Clone(r.order) }

// spec returns the full (common + specific) spec of typ.
func (r *Registry) spec(typ string) (TypeSpec, bool) {
	s, ok := r.specs[typ]
	return s, ok
}

// Types lists every type with its JSON Schema and default config.
func (r *Registry) Types() []TypeInfo {
	out := make([]TypeInfo, 0, len(r.order))
	for _, typ := range r.order {
		s := r.specs[typ]
		def, err := r.Normalize(typ, nil)
		if err != nil {
			// Defaults are covered by unit tests; never expected at runtime.
			panic(fmt.Sprintf("homepage: default config of %s invalid: %v", typ, err))
		}
		out = append(out, TypeInfo{
			Type: typ, Label: s.Label, Description: s.Description,
			Schema: r.Schema(typ), DefaultConfig: def,
		})
	}
	return out
}

// Normalize validates raw against the spec of typ and returns canonical JSON
// with defaults filled in (keys sorted). Empty strings and nulls mean "unset".
// Errors are apperr.Validation with keys "config.<field>" (or "type").
func (r *Registry) Normalize(typ string, raw json.RawMessage) (json.RawMessage, error) {
	s, ok := r.specs[typ]
	if !ok {
		return nil, apperr.Validation(map[string]string{"type": "Tipe section tidak dikenal."})
	}
	in := map[string]any{}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
		dec := json.NewDecoder(bytes.NewReader(trimmed))
		dec.UseNumber()
		var v any
		if err := dec.Decode(&v); err != nil {
			return nil, apperr.Validation(map[string]string{"config": "Config bukan JSON yang valid."})
		}
		m, isObj := v.(map[string]any)
		if !isObj {
			return nil, apperr.Validation(map[string]string{"config": "Config harus berupa objek JSON."})
		}
		in = m
	}
	errs := map[string]string{}
	out := r.normalizeObject(s.Fields, in, "config.", errs)
	if len(errs) == 0 && s.Validate != nil {
		for k, msg := range s.Validate(out) {
			errs["config."+k] = msg
		}
	}
	if len(errs) > 0 {
		return nil, apperr.Validation(errs)
	}
	b, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("homepage: marshal config: %w", err)
	}
	return b, nil
}

func (r *Registry) normalizeObject(fields []Field, in map[string]any, prefix string, errs map[string]string) map[string]any {
	known := make(map[string]bool, len(fields))
	for _, f := range fields {
		known[f.Name] = true
	}
	for k := range in {
		if !known[k] {
			errs[prefix+k] = "Field tidak dikenal."
		}
	}
	out := make(map[string]any, len(fields))
	for _, f := range fields {
		key := prefix + f.Name
		v, present := in[f.Name]
		if s, isStr := v.(string); isStr && strings.TrimSpace(s) == "" {
			present = false
		}
		if !present || v == nil {
			switch {
			case f.Default != nil:
				out[f.Name] = cloneDefault(f.Default)
			case f.Required:
				errs[key] = "Wajib diisi."
			}
			continue
		}
		if nv, ok := r.normalizeValue(f, v, key, errs); ok {
			out[f.Name] = nv
		}
	}
	return out
}

func cloneDefault(v any) any {
	if s, ok := v.([]string); ok {
		return slices.Clone(s)
	}
	return v
}

func (r *Registry) normalizeValue(f Field, v any, key string, errs map[string]string) (any, bool) {
	switch f.Type {
	case FieldString:
		s, ok := v.(string)
		if !ok {
			errs[key] = "Harus berupa teks."
			return nil, false
		}
		s = strings.TrimSpace(s)
		if f.Max != nil && utf8.RuneCountInString(s) > *f.Max {
			errs[key] = fmt.Sprintf("Maksimal %d karakter.", *f.Max)
			return nil, false
		}
		if f.Pattern != "" && !r.patterns[f.Pattern].MatchString(s) {
			errs[key] = f.PatternMsg
			return nil, false
		}
		return s, true
	case FieldInteger:
		n, ok := toInt(v)
		if !ok {
			errs[key] = "Harus berupa bilangan bulat."
			return nil, false
		}
		if len(f.IntEnum) > 0 && !slices.Contains(f.IntEnum, n) {
			errs[key] = "Harus salah satu dari: " + joinInts(f.IntEnum) + "."
			return nil, false
		}
		if f.Min != nil && n < *f.Min {
			errs[key] = fmt.Sprintf("Minimal %d.", *f.Min)
			return nil, false
		}
		if f.Max != nil && n > *f.Max {
			errs[key] = fmt.Sprintf("Maksimal %d.", *f.Max)
			return nil, false
		}
		return n, true
	case FieldBoolean:
		b, ok := v.(bool)
		if !ok {
			errs[key] = "Harus berupa true atau false."
			return nil, false
		}
		return b, true
	case FieldEnum:
		s, ok := v.(string)
		if !ok || !slices.Contains(f.Enum, strings.TrimSpace(s)) {
			errs[key] = "Harus salah satu dari: " + strings.Join(f.Enum, ", ") + "."
			return nil, false
		}
		return strings.TrimSpace(s), true
	case FieldStringArray, FieldEnumArray:
		arr, ok := v.([]any)
		if !ok {
			errs[key] = "Harus berupa daftar."
			return nil, false
		}
		if f.Max != nil && len(arr) > *f.Max {
			errs[key] = fmt.Sprintf("Maksimal %d item.", *f.Max)
			return nil, false
		}
		if f.Min != nil && len(arr) < *f.Min {
			errs[key] = fmt.Sprintf("Minimal %d item.", *f.Min)
			return nil, false
		}
		out := make([]string, 0, len(arr))
		for i, item := range arr {
			s, isStr := item.(string)
			s = strings.TrimSpace(s)
			ik := key + "[" + strconv.Itoa(i) + "]"
			switch {
			case !isStr || s == "":
				errs[ik] = "Harus berupa teks."
				return nil, false
			case f.Type == FieldEnumArray && !slices.Contains(f.Enum, s):
				errs[ik] = "Harus salah satu dari: " + strings.Join(f.Enum, ", ") + "."
				return nil, false
			case f.Type == FieldEnumArray && slices.Contains(out, s):
				errs[ik] = "Item tidak boleh ganda."
				return nil, false
			}
			out = append(out, s)
		}
		return out, true
	case FieldObject:
		m, ok := v.(map[string]any)
		if !ok {
			errs[key] = "Harus berupa objek."
			return nil, false
		}
		before := len(errs)
		obj := r.normalizeObject(f.Fields, m, key+".", errs)
		return obj, len(errs) == before
	default:
		errs[key] = "Tipe field tidak didukung."
		return nil, false
	}
}

func toInt(v any) (int, bool) {
	switch n := v.(type) {
	case json.Number:
		i, err := strconv.ParseInt(n.String(), 10, 32)
		if err != nil {
			return 0, false
		}
		return int(i), true
	case int:
		return n, true
	case float64:
		if n != float64(int(n)) {
			return 0, false
		}
		return int(n), true
	default:
		return 0, false
	}
}

func joinInts(ns []int) string {
	parts := make([]string, len(ns))
	for i, n := range ns {
		parts[i] = strconv.Itoa(n)
	}
	return strings.Join(parts, ", ")
}
