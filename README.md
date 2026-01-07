# helfy-devops-test

Simple flower shop catalog that demonstrates a full-stack app with the following stack:

- **Database:** [TiDB](https://www.pingcap.com/tidb/) (MySQL-compatible, serverless-ready)
- **Backend:** Node.js, Express, REST API
- **Frontend:** React (Vite) single-page UI

The backend exposes `/api/flowers` endpoints to read or create flowers in TiDB. The frontend fetches those records and lets you capture inventory from the browser.

## Architecture

```
┌──────────────┐     HTTP REST     ┌──────────────────────┐    mysql2 / TLS    ┌─────────┐
│ React client │ ─────────────────>│ Express API server   │───────────────────>│  TiDB   │
└──────────────┘                   │ /api/flowers, /health│                    └─────────┘
```

## Requirements

- Node.js 20+ (recommended) and npm
- Access to a TiDB instance (local TiUP cluster or TiDB Cloud)

## 1. Configure TiDB

1. Provision a TiDB cluster and create a database (default used here is `flowershop`).
2. Create a user with privileges to create/read/write tables (the default script uses the `flowers` table).
3. If you are on TiDB Cloud, grab the `host`, `port`, username, password and enable TLS.
4. Optional: run the SQL below, although the backend will do this automatically on first start.

```sql
CREATE TABLE IF NOT EXISTS flowers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(60) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Backend (Express + mysql2)

```bash
cd server
cp .env.example .env            # update with your TiDB credentials
npm install                     # already executed in repo, run if needed
npm run dev                     # starts http://localhost:4001 with nodemon
```

Environment variables (`server/.env`):

- `PORT` – API port (default `4001`)
- `ALLOWED_ORIGINS` – comma-separated origins allowed via CORS (ex: `http://localhost:5173`)
- `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`
- `TIDB_USE_SSL` – enable TLS (recommended for TiDB Cloud, default `true`)
- `TIDB_STRICT_SSL` – enforce CA validation (default `true`)
- `DEFAULT_USER_EMAIL`, `DEFAULT_USER_PASSWORD`, `DEFAULT_USER_NAME` – optional default account seeded on boot (useful for demos and tests)
- `AUTH_TOKEN_TTL_HOURS` – bearer token lifespan before expiring (default `24`)

The provided `.env.example` seeds `Admin@helfy.com` / `helfy123!` (display name “Helfy Admin”). Update those values before deploying to production.

On start the backend will:

1. Ensure the `flowers` table exists.
2. Create default `users`/`tokens` tables and optionally seed a demo user (based on `DEFAULT_USER_*` env vars).
3. Seed a few sample flowers the first time it runs (to prove connectivity).
4. Expose REST endpoints:

| Method | Path            | Description                     |
| ------ | --------------- | ------------------------------- |
| GET    | `/api/flowers`  | Returns all flowers (JSON)      |
| POST   | `/api/flowers`  | Creates a flower, returns row   |
| GET    | `/api/health`   | Pings TiDB and returns `status` |
| POST   | `/api/auth/login` | Exchanges email/password for a bearer token |
| GET    | `/api/auth/me`  | Validates an existing token     |

All `/api/flowers` requests require the `Authorization: Bearer <token>` header populated with the token returned from `/api/auth/login`.

Example request (requires bearer token from the login endpoint):

```bash
curl -X POST http://localhost:4001/api/flowers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Blushing Tulip","color":"Pink","price":11.5}'
```

Authentication test (default seeded account):

```bash
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"Admin@helfy.com","password":"helfy123!"}'
```

## 3. Frontend (React + Vite)

```bash
cd client
cp .env.example .env                   # adjust API base url when needed
npm install                            # already in repo, run if dependencies change
npm run dev                            # http://localhost:5173
```

`client/.env` options:

- `VITE_API_BASE_URL` – defaults to `http://localhost:4001/api`. Change if the API runs elsewhere.

The UI lets you:

- View the list of flowers (fetched from TiDB via the backend).
- Add new flowers through a form. Successful submissions append the row to the list immediately.
- Login using the default credentials (`Admin@helfy.com` / `helfy123!` from `.env.example`) before performing any API calls. Tokens are stored in `localStorage` and automatically attached to each request.

## Deployment / Next steps

- Containerize the `server` and `client` directories separately or serve the static build from Express.
- Add auth or validation middleware if the API will be exposed on the public internet.
- Configure CI to run `npm test`/`npm run build` once tests are introduced.
