-- +goose Up
-- Set when an admin (or the CLI) issues an initial/reset password; the user
-- must choose a new password before any admin route is reachable.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN users.must_change_password IS 'User must change the password before using the admin dashboard.';

-- +goose Down
ALTER TABLE users DROP COLUMN must_change_password;
