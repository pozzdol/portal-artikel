package httpx

import "time"

// Jakarta is the display time zone (WIB). Falls back to a fixed +07:00 zone
// when tzdata is unavailable (cmd/api embeds time/tzdata).
var Jakarta = loadJakarta()

func loadJakarta() *time.Location {
	if loc, err := time.LoadLocation("Asia/Jakarta"); err == nil {
		return loc
	}
	return time.FixedZone("WIB", 7*60*60)
}

// FormatTime renders t as RFC 3339 in Asia/Jakarta.
func FormatTime(t time.Time) string { return t.In(Jakarta).Format(time.RFC3339) }

// FormatTimePtr is FormatTime for nullable timestamps; nil stays nil.
func FormatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := FormatTime(*t)
	return &s
}

// dateLayout is the wire format of DATE values.
const dateLayout = "2006-01-02"

// FormatDate renders the calendar date of t in Asia/Jakarta ("2006-01-02").
// DATE columns scanned as midnight UTC keep their calendar date.
func FormatDate(t time.Time) string { return t.In(Jakarta).Format(dateLayout) }

// FormatDatePtr is FormatDate for nullable dates; nil stays nil.
func FormatDatePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := FormatDate(*t)
	return &s
}

// ParseDate parses "2006-01-02" as midnight in Asia/Jakarta.
func ParseDate(s string) (time.Time, error) {
	return time.ParseInLocation(dateLayout, s, Jakarta)
}

// WIBDate returns the Asia/Jakarta calendar date of t as midnight in UTC,
// the value to bind to DATE columns (mirrors seed wibDate).
func WIBDate(t time.Time) time.Time {
	w := t.In(Jakarta)
	return time.Date(w.Year(), w.Month(), w.Day(), 0, 0, 0, 0, time.UTC)
}
