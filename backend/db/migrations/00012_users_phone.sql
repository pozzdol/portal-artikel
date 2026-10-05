-- +goose Up
-- Indonesian mobile number stored normalized without the country code
-- (e.g. 8123456789 for +62 812-3456-789); usable as a login identifier.
ALTER TABLE users
  ADD COLUMN phone TEXT,
  ADD CONSTRAINT users_phone_key UNIQUE (phone),
  ADD CONSTRAINT users_phone_format CHECK (phone ~ '^8[0-9]{8,11}$');
COMMENT ON COLUMN users.phone IS 'Normalized Indonesian mobile number without +62/0 prefix (^8[0-9]{8,11}$).';

ALTER TABLE users DROP CONSTRAINT users_login_requires_credentials;
ALTER TABLE users ADD CONSTRAINT users_login_requires_credentials
  CHECK (NOT can_login OR (password_hash IS NOT NULL AND (email IS NOT NULL OR phone IS NOT NULL)));

-- +goose Down
-- Fails if a login user has only a phone number; give it an email first.
ALTER TABLE users DROP CONSTRAINT users_login_requires_credentials;
ALTER TABLE users ADD CONSTRAINT users_login_requires_credentials
  CHECK (NOT can_login OR (email IS NOT NULL AND password_hash IS NOT NULL));
ALTER TABLE users DROP COLUMN phone;
