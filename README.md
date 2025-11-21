# JWT Auth Express

A robust, production-ready JWT authentication package for Express.js with support for MySQL, MySQL2, and TiDB Cloud.

## Features

- ✅ User registration & authentication
- ✅ JWT access & refresh tokens
- ✅ Password reset functionality
- ✅ Email integration (with mock fallback)
- ✅ Multiple database support (MySQL, MySQL2, TiDB Cloud)
- ✅ Automatic table creation
- ✅ Comprehensive security features
- ✅ Production-ready error handling

## Quick Start

# jwt-auth-express

[![npm version](https://img.shields.io/badge/npm-v0.0.0-lightgrey.svg)](https://www.npmjs.com/)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![coverage](https://img.shields.io/badge/coverage-unknown-orange.svg)](coverage/lcov-report/index.html)

A focused, production-ready JWT authentication library and example server for Express.js. It provides common auth flows (signup, signin, refresh tokens, password reset) and supports multiple SQL backends (MySQL / mysql2 and TiDB Cloud). This repo is organized so you can reuse the service code or run the example server directly.

## Highlights

- Access & Refresh token support (JWT)
- Signup / Signin / Signout
- Refresh token rotation
- Forgot / Reset password via email (pluggable email provider)
- Database-agnostic configuration with TiDB Cloud optimizations
- Minimal, testable controller + middleware structure

## Quick start (example)

Install dependencies and run the example server:

```bash
git clone https://github.com/ZaheerAhmedkhan65/jwt-auth-express.git
cd jwt-auth-express
npm install
# copy .env.example to .env and edit values
node index.js
```

The example server exposes authentication endpoints under `/auth` (see API section).

## Installation (library)

This repository can be used as a library or as a standalone example. To install from npm (if published):

```bash
npm install jwt-auth-express
```

Or use the code directly in your project by importing the controller/router modules.

## Configuration

The project expects configuration via environment variables. Common variables used by this repository:

- NODE_ENV — runtime environment (development|production)
- PORT — HTTP port (default: 3000)
- ACCESS_TOKEN_SECRET — secret used to sign access tokens
- REFRESH_TOKEN_SECRET — secret used to sign refresh tokens
- ACCESS_TOKEN_EXPIRY — access token TTL (e.g. 15m)
- REFRESH_TOKEN_EXPIRY — refresh token TTL (e.g. 7d)
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME — database connection
- TIDB_HOST, TIDB_PORT, TIDB_DATABASE, TIDB_USERNAME, TIDB_PASSWORD — TiDB Cloud (optional)

Create a `.env` file or pass env vars to your process. Example `.env` (for development):

```ini
NODE_ENV=development
PORT=3000
ACCESS_TOKEN_SECRET=replace_with_a_strong_secret
REFRESH_TOKEN_SECRET=replace_with_a_different_strong_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=jwt_auth
```

Notes:
- TiDB Cloud connections require SSL configuration — see `src/config/database.js` for details.
- Secrets must be long, unpredictable strings in production. Consider using a secrets manager.

## API (Auth routes)

All endpoints live under the `/auth` route in the example server. Routes exposed by `src/routes/authRoutes.js`:

- POST /auth/signup — Register a new user
    - body: { email, password, name }
    - returns: user object and tokens

- POST /auth/signin — Authenticate a user
    - body: { email, password }
    - returns: user object and tokens

- POST /auth/refresh-token — Rotate refresh token and get new access token
    - body: { refreshToken }
    - returns: { accessToken, refreshToken }

- POST /auth/forgot-password — Request a password reset
    - body: { email }
    - returns: generic success message (no user enumeration)

- POST /auth/reset-password — Reset password using token
    - body: { token, userId, newPassword }
    - returns: success message

- POST /auth/signout — Sign out (remove refresh token)
    - body: { refreshToken }

- GET /auth/me — Get current authenticated user (protected)
    - headers: Authorization: Bearer <accessToken>
    - returns: current user

Example curl (signup):

```bash
curl -X POST http://localhost:3000/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"me@example.com","password":"supersecret","name":"Me"}'
```

Example curl (signin):

```bash
curl -X POST http://localhost:3000/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"me@example.com","password":"supersecret"}'
```

## Integration & tests

Run the test suite (project uses a small integration test):

```bash
npm test
```

If the tests require a database, ensure the database env vars point to a running test database. The repo includes `tests/integration.test.js` as a starting point.

## Development

- Install dev dependencies: `npm install`
- Run the server locally: `node index.js` (or use nodemon)
- Lint and format as needed (no linter configured in this repo by default)

Project layout (important files):

- `index.js` — example server bootstrap
- `src/controllers` — auth controller logic
- `src/routes` — express routes wiring
- `src/middleware` — auth + validation middleware
- `src/models` — user model / DB helpers
- `src/utils` — jwt, crypto, email helpers

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a topic branch: `git checkout -b feat/your-feature`
3. Commit changes with clear messages
4. Open a pull request describing the change

Please include tests for new behavior and keep changes focused.

## Security

- Keep `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` out of source control.
- Rotate secrets on suspected compromise and invalidate refresh tokens where appropriate.
- Use HTTPS in production and secure cookie flags if you add cookie-based storage.

If you discover a security vulnerability, please open an issue or contact the maintainers directly.

## License

This project is licensed under the MIT License — see the `LICENSE` file for details.

## Acknowledgements

Inspired by common Express + JWT patterns. Thanks to contributors and the Node.js community.

---

If you'd like, I can:

- add a `.env.example` file to the repo
- generate badge URLs with real build/coverage links
- add a short CONTRIBUTING.md or CODE_OF_CONDUCT

Tell me which extras you want and I'll add them.
