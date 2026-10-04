package homepage

// Schema renders the spec of typ as a JSON Schema (draft-07). Unknown types
// return nil.
func (r *Registry) Schema(typ string) map[string]any {
	s, ok := r.specs[typ]
	if !ok {
		return nil
	}
	out := objectSchema(s.Fields)
	out["$schema"] = "http://json-schema.org/draft-07/schema#"
	out["title"] = s.Label
	out["description"] = s.Description
	return out
}

func objectSchema(fields []Field) map[string]any {
	props := make(map[string]any, len(fields))
	required := []string{}
	for _, f := range fields {
		props[f.Name] = fieldSchema(f)
		if f.Required {
			required = append(required, f.Name)
		}
	}
	out := map[string]any{
		"type":                 "object",
		"properties":           props,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		out["required"] = required
	}
	return out
}

func fieldSchema(f Field) map[string]any {
	var s map[string]any
	switch f.Type {
	case FieldString:
		s = map[string]any{"type": "string"}
		if f.Max != nil {
			s["maxLength"] = *f.Max
		}
		if f.Pattern != "" {
			s["pattern"] = f.Pattern
		}
	case FieldInteger:
		s = map[string]any{"type": "integer"}
		if len(f.IntEnum) > 0 {
			s["enum"] = f.IntEnum
		}
		if f.Min != nil {
			s["minimum"] = *f.Min
		}
		if f.Max != nil {
			s["maximum"] = *f.Max
		}
	case FieldBoolean:
		s = map[string]any{"type": "boolean"}
	case FieldEnum:
		s = map[string]any{"type": "string", "enum": f.Enum}
	case FieldStringArray, FieldEnumArray:
		items := map[string]any{"type": "string"}
		s = map[string]any{"type": "array", "items": items}
		if f.Type == FieldEnumArray {
			items["enum"] = f.Enum
			s["uniqueItems"] = true
		}
		if f.Min != nil {
			s["minItems"] = *f.Min
		}
		if f.Max != nil {
			s["maxItems"] = *f.Max
		}
	case FieldObject:
		s = objectSchema(f.Fields)
	default:
		s = map[string]any{}
	}
	if f.Label != "" {
		s["title"] = f.Label
	}
	if f.Description != "" {
		s["description"] = f.Description
	}
	if f.Default != nil {
		s["default"] = f.Default
	}
	if f.UI != "" {
		s["x-ui"] = f.UI
	}
	return s
}
