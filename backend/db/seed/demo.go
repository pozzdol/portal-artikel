package seed

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

func runDemo(ctx context.Context, tx pgx.Tx, opts Options) error {
	categories, err := loadIDs(ctx, tx, `SELECT slug, id FROM categories`)
	if err != nil {
		return fmt.Errorf("load categories: %w", err)
	}
	if _, ok := categories["kajian"]; !ok {
		return fmt.Errorf("kategori dasar belum ada; jalankan seed --base terlebih dahulu")
	}
	authors, err := seedAuthors(ctx, tx)
	if err != nil {
		return fmt.Errorf("users: %w", err)
	}
	tags, err := seedTags(ctx, tx)
	if err != nil {
		return fmt.Errorf("tags: %w", err)
	}
	articleIDs, err := seedArticles(ctx, tx, opts.Now, categories, authors, tags)
	if err != nil {
		return fmt.Errorf("articles: %w", err)
	}
	if err := seedViews(ctx, tx, opts.Now, articleIDs); err != nil {
		return fmt.Errorf("article_views_daily: %w", err)
	}
	if err := seedEvents(ctx, tx, opts.Now); err != nil {
		return fmt.Errorf("events: %w", err)
	}
	if err := seedAlumni(ctx, tx); err != nil {
		return fmt.Errorf("alumni_profiles: %w", err)
	}
	if err := seedVideos(ctx, tx, opts.Now); err != nil {
		return fmt.Errorf("videos: %w", err)
	}
	if err := seedSnippets(ctx, tx); err != nil {
		return fmt.Errorf("snippets: %w", err)
	}
	return nil
}

func loadIDs(ctx context.Context, tx pgx.Tx, sql string) (map[string]int64, error) {
	rows, err := tx.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	var slug string
	var id int64
	_, err = pgx.ForEachRow(rows, []any{&slug, &id}, func() error {
		out[slug] = id
		return nil
	})
	return out, err
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// Demo authors never get login credentials; existing email/password/can_login are left untouched.
func seedAuthors(ctx context.Context, tx pgx.Tx) (map[string]int64, error) {
	ids := map[string]int64{}
	for _, a := range demoAuthors {
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO users (display_name, slug, title, bio, can_login, is_active)
			VALUES ($1, $2, $3, $4, false, true)
			ON CONFLICT (slug) DO UPDATE
			   SET display_name = EXCLUDED.display_name, title = EXCLUDED.title, bio = EXCLUDED.bio
			RETURNING id`, a.Name, a.Slug, a.Title, a.Bio).Scan(&id); err != nil {
			return nil, fmt.Errorf("%s: %w", a.Slug, err)
		}
		ids[a.Slug] = id
	}
	return ids, nil
}

func seedTags(ctx context.Context, tx pgx.Tx) (map[string]int64, error) {
	ids := map[string]int64{}
	for _, t := range demoTags {
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO tags (name, slug) VALUES ($1, $2)
			ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
			RETURNING id`, t.Name, t.Slug).Scan(&id); err != nil {
			return nil, fmt.Errorf("%s: %w", t.Slug, err)
		}
		ids[t.Slug] = id
	}
	return ids, nil
}

// seedArticles upserts demo articles by slug and returns their ids in demoArticles order.
func seedArticles(ctx context.Context, tx pgx.Tx, now time.Time, cats, authors, tags map[string]int64) ([]int64, error) {
	ids := make([]int64, 0, len(demoArticles))
	for _, a := range demoArticles {
		catID, ok := cats[a.Category]
		if !ok {
			return nil, fmt.Errorf("%s: kategori %q tidak ditemukan", a.Slug, a.Category)
		}
		authorID, ok := authors[a.Author]
		if !ok {
			return nil, fmt.Errorf("%s: penulis %q tidak dikenal", a.Slug, a.Author)
		}
		text := plainText(a.Paragraphs...)
		var eventDate *time.Time
		if a.HasEvent {
			d := wibDate(now, -a.EventDaysAgo)
			eventDate = &d
		}
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO articles (
				title, slug, excerpt, content_json, content_html, content_text,
				category_id, author_id, status, published_at, is_featured, is_breaking,
				reading_minutes, event_date, event_location)
			VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, 'published', $9, $10, $11, $12, $13, $14)
			ON CONFLICT (slug) DO UPDATE SET
				title = EXCLUDED.title, excerpt = EXCLUDED.excerpt,
				content_json = EXCLUDED.content_json, content_html = EXCLUDED.content_html,
				content_text = EXCLUDED.content_text, category_id = EXCLUDED.category_id,
				author_id = EXCLUDED.author_id, status = EXCLUDED.status,
				published_at = EXCLUDED.published_at, is_featured = EXCLUDED.is_featured,
				is_breaking = EXCLUDED.is_breaking, reading_minutes = EXCLUDED.reading_minutes,
				event_date = EXCLUDED.event_date, event_location = EXCLUDED.event_location,
				deleted_at = NULL
			RETURNING id`,
			a.Title, a.Slug, a.Excerpt, string(tiptapDoc(a.Paragraphs...)), htmlParagraphs(a.Paragraphs...), text,
			catID, authorID, daysAgo(now, a.DaysAgo, a.Hour, a.Minute), a.Featured, a.Breaking,
			readingMinutes(text), eventDate, nullStr(a.EventLocation),
		).Scan(&id); err != nil {
			return nil, fmt.Errorf("%s: %w", a.Slug, err)
		}
		ids = append(ids, id)
	}

	// Replace tag links of the seeded articles.
	if _, err := tx.Exec(ctx, `DELETE FROM article_tags WHERE article_id = ANY($1)`, ids); err != nil {
		return nil, fmt.Errorf("clear article_tags: %w", err)
	}
	for i, a := range demoArticles {
		for _, t := range a.Tags {
			tagID, ok := tags[t]
			if !ok {
				return nil, fmt.Errorf("%s: tag %q tidak dikenal", a.Slug, t)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2)
				ON CONFLICT DO NOTHING`, ids[i], tagID); err != nil {
				return nil, fmt.Errorf("article_tags %s/%s: %w", a.Slug, t, err)
			}
		}
	}
	return ids, nil
}

// seedViews writes deterministic daily view counts so "Trending Hari Ini" (today)
// and "Populer" (30 days) show different rankings. Days are WIB dates.
func seedViews(ctx context.Context, tx pgx.Tx, now time.Time, ids []int64) error {
	type row struct {
		article int // 1-based article number
		day     int // days ago
		views   int
	}
	var rows []row
	// Trending: articles 1,5,9,2,16 today and yesterday.
	trending := []struct{ n, today, yesterday int }{
		{1, 320, 210}, {5, 180, 160}, {9, 150, 90}, {2, 120, 80}, {16, 90, 60},
	}
	for _, t := range trending {
		rows = append(rows, row{t.n, 0, t.today}, row{t.n, 1, t.yesterday})
	}
	// Popular-but-not-trending: articles 3,4,7 get views on the days between
	// publication and two days ago (never before their published date).
	for k, n := range []int{3, 4, 7} {
		for d := 2; d <= demoArticles[n-1].DaysAgo; d++ {
			rows = append(rows, row{n, d, 60 + (k*13+d*7)%31})
		}
	}

	// Demo stats are fully replaced so re-runs on a later day stay deterministic.
	if _, err := tx.Exec(ctx, `DELETE FROM article_views_daily WHERE article_id = ANY($1)`, ids); err != nil {
		return err
	}
	for _, r := range rows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO article_views_daily (article_id, day, views) VALUES ($1, $2, $3)
			ON CONFLICT (article_id, day) DO UPDATE SET views = EXCLUDED.views`,
			ids[r.article-1], wibDate(now, -r.day), r.views); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `
		UPDATE articles a
		   SET view_count = (SELECT coalesce(sum(v.views), 0) FROM article_views_daily v WHERE v.article_id = a.id)
		 WHERE a.id = ANY($1)`, ids)
	return err
}

// nextReuniStart returns the next 12 December 08:00 WIB at least a week ahead,
// matching the "digelar 12 Desember" breaking snippet.
func nextReuniStart(now time.Time) time.Time {
	t := now.In(jakarta())
	start := time.Date(t.Year(), time.December, 12, 8, 0, 0, 0, jakarta())
	if start.Before(t.AddDate(0, 0, 7)) {
		start = start.AddDate(1, 0, 0)
	}
	return start
}

func seedEvents(ctx context.Context, tx pgx.Tx, now time.Time) error {
	times := map[string][2]time.Time{}
	kajian := daysAhead(now, 14, 5, 0)
	times["kajian-subuh-bersama"] = [2]time.Time{kajian, kajian.Add(2 * time.Hour)}
	rapat := daysAhead(now, 21, 13, 0)
	times["rapat-koordinasi-alumni-wilayah"] = [2]time.Time{rapat, rapat.Add(3 * time.Hour)}
	reuni := nextReuniStart(now)
	times["reuni-akbar-alumni-2026"] = [2]time.Time{reuni, reuni.Add(8 * time.Hour)}

	for _, e := range demoEvents {
		t, ok := times[e.Slug]
		if !ok {
			return fmt.Errorf("%s: waktu acara belum ditentukan", e.Slug)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO events (title, slug, summary, description_json, description_html,
				starts_at, ends_at, location_name, location_address, registration_url, status)
			VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, 'published')
			ON CONFLICT (slug) DO UPDATE SET
				title = EXCLUDED.title, summary = EXCLUDED.summary,
				description_json = EXCLUDED.description_json, description_html = EXCLUDED.description_html,
				starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, is_all_day = false,
				location_name = EXCLUDED.location_name, location_address = EXCLUDED.location_address,
				registration_url = EXCLUDED.registration_url, status = EXCLUDED.status`,
			e.Title, e.Slug, e.Summary, string(tiptapDoc(e.Paragraphs...)), htmlParagraphs(e.Paragraphs...),
			t[0], t[1], e.Location, nullStr(e.Address), nullStr(e.RegistrationURL)); err != nil {
			return fmt.Errorf("%s: %w", e.Slug, err)
		}
	}
	return nil
}

func seedAlumni(ctx context.Context, tx pgx.Tx) error {
	for i, a := range demoAlumni {
		if _, err := tx.Exec(ctx, `
			INSERT INTO alumni_profiles (name, slug, role_title, class_year, short_bio,
				story_json, story_html, is_featured, sort_order, status)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true, $8, 'published')
			ON CONFLICT (slug) DO UPDATE SET
				name = EXCLUDED.name, role_title = EXCLUDED.role_title, class_year = EXCLUDED.class_year,
				short_bio = EXCLUDED.short_bio, story_json = EXCLUDED.story_json, story_html = EXCLUDED.story_html,
				is_featured = EXCLUDED.is_featured, sort_order = EXCLUDED.sort_order, status = EXCLUDED.status`,
			a.Name, a.Slug, a.RoleTitle, a.ClassYear, a.ShortBio,
			string(tiptapDoc(a.Story...)), htmlParagraphs(a.Story...), (i+1)*10); err != nil {
			return fmt.Errorf("%s: %w", a.Slug, err)
		}
	}
	return nil
}

func seedVideos(ctx context.Context, tx pgx.Tx, now time.Time) error {
	for _, v := range demoVideos {
		if _, err := tx.Exec(ctx, `
			INSERT INTO videos (title, slug, youtube_id, description, duration_seconds, view_count,
				published_at, is_featured, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
			ON CONFLICT (slug) DO UPDATE SET
				title = EXCLUDED.title, youtube_id = EXCLUDED.youtube_id, description = EXCLUDED.description,
				duration_seconds = EXCLUDED.duration_seconds, view_count = EXCLUDED.view_count,
				published_at = EXCLUDED.published_at, is_featured = EXCLUDED.is_featured, status = EXCLUDED.status`,
			v.Title, v.Slug, v.YouTubeID, v.Description, v.DurationSeconds, v.ViewCount,
			daysAgo(now, v.DaysAgo, 16, 0), v.Featured); err != nil {
			return fmt.Errorf("%s: %w", v.Slug, err)
		}
	}
	return nil
}

// Snippets have no natural key; they are inserted only if no row with the same type+body exists.
func seedSnippets(ctx context.Context, tx pgx.Tx) error {
	for _, s := range demoSnippets {
		if _, err := tx.Exec(ctx, `
			INSERT INTO snippets (type, title, body, source, link_url, sort_order, is_active)
			SELECT $1::text, $2::text, $3::text, $4::text, $5::text, $6::int, true
			WHERE NOT EXISTS (SELECT 1 FROM snippets WHERE type = $1::text AND body = $3::text)`,
			s.Type, nullStr(s.Title), s.Body, nullStr(s.Source), nullStr(s.LinkURL), s.SortOrder); err != nil {
			return fmt.Errorf("%s %q: %w", s.Type, s.Body, err)
		}
	}
	return nil
}
