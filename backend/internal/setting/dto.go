package setting

// Item is the response of PUT /settings/{key}: the stored value decoded back
// from its canonical JSON, plus the last update time.
type Item struct {
	Key       string `json:"key"`
	Value     any    `json:"value"`
	UpdatedAt string `json:"updated_at"`
}
