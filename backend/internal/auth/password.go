// Package auth contains authentication primitives shared by the API and the CLI tool.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters (OWASP-recommended baseline, tuned for a small VPS).
const (
	argonTime    uint32 = 3
	argonMemory  uint32 = 64 * 1024 // KiB
	argonThreads uint8  = 2
	argonSaltLen        = 16
	argonKeyLen  uint32 = 32

	// Upper bounds accepted when parsing a stored hash, so a tampered row
	// cannot make verification allocate unbounded memory or CPU.
	maxMemory  uint32 = 1024 * 1024 // 1 GiB
	maxTime    uint32 = 16
	maxThreads uint8  = 16
	maxKeyLen         = 128
)

// ErrInvalidHash is returned when an encoded hash is not a valid argon2id PHC string.
var ErrInvalidHash = errors.New("auth: invalid password hash format")

var b64 = base64.RawStdEncoding

// HashPassword derives an argon2id hash and returns it as a PHC string:
// $argon2id$v=19$m=65536,t=3,p=2$<salt>$<key>
func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("auth: generate salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword reports whether password matches the encoded argon2id hash.
// Parameters are read from the hash itself so they can be raised later
// without invalidating existing hashes.
func VerifyPassword(password, encoded string) (bool, error) {
	p, salt, key, err := decodeHash(encoded)
	if err != nil {
		return false, err
	}
	other := argon2.IDKey([]byte(password), salt, p.time, p.memory, p.threads, uint32(len(key)))
	return subtle.ConstantTimeCompare(key, other) == 1, nil
}

type params struct {
	memory  uint32
	time    uint32
	threads uint8
}

func decodeHash(encoded string) (params, []byte, []byte, error) {
	var p params
	parts := strings.Split(encoded, "$")
	// "", "argon2id", "v=19", "m=..,t=..,p=..", salt, key
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" {
		return p, nil, nil, ErrInvalidHash
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return p, nil, nil, ErrInvalidHash
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.memory, &p.time, &p.threads); err != nil {
		return p, nil, nil, ErrInvalidHash
	}
	if p.memory == 0 || p.memory > maxMemory || p.time == 0 || p.time > maxTime ||
		p.threads == 0 || p.threads > maxThreads {
		return p, nil, nil, ErrInvalidHash
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil || len(salt) < 8 {
		return p, nil, nil, ErrInvalidHash
	}
	key, err := b64.DecodeString(parts[5])
	if err != nil || len(key) < 16 || len(key) > maxKeyLen {
		return p, nil, nil, ErrInvalidHash
	}
	return p, salt, key, nil
}
