# helfy-devops-test

Home test solution for a TiDB-powered flower shop. Everything is containerized so the examiner can run the full stack with a single command and inspect the behaviors requested in `instructions.md`.

---

## Assignment Coverage

| Instruction | Implementation |
| ----------- | -------------- |
| **Part 1 – Simple Development** | React/Vite SPA with login + catalog UI (`client/src`), Express REST API (`server/src`) with auth, token management, TiDB-backed CRUD, and exhaustive inline comments as required. |
| **Part 2 – DevOps Implementation** | Dockerfiles for client/server plus `docker compose` stack (`compose.yaml`) that provisions TiDB (pd/tikv/tidb), Kafka/ZooKeeper, TiCDC, CDC consumer, automatic schema & seed user import (`db/init.sql`), and one-command startup. |
| **Part 3 – Monitoring & Logging** | `log4js` structured user login logs in the API (`server/src/routes/auth.js`), TiCDC changefeed that streams DB mutations into Kafka, and a Node.js consumer (`cdc-consumer/index.js`) that prints every CDC event in JSON. |

Key features:
- **Backend:** Node.js 22, Express 5, mysql2, bcrypt for auth, log4js for activity logging.
- **Frontend:** React 19 + Vite SPA with token-aware data fetching.
- **Database:** Local TiDB cluster (pd/tikv/tidb) bootstrapped by Compose plus schema/user seeding.
- **Messaging:** Kafka + TiCDC for change data capture, consumed by a Node.js worker.
- **Observability:** JSON logs for user logins and CDC events; health endpoint for readiness probes.

---

## Running Locally

Prerequisites: Docker + Docker Compose plugin.

```bash
# bring up the entire stack (React client, API, TiDB, Kafka, TiCDC, CDC consumer)
docker compose up -d --build
```

What starts:
- `web` – React SPA on http://localhost:5173 (proxied to Vite preview inside the container).
- `api` – Express server on http://localhost:4001 with login + flowers endpoints.
- `pd`, `tikv`, `tidb` – TiDB cluster components.
- `zookeeper`, `kafka` – Messaging backbone for CDC.
- `ticdc` + `ticdc-task` – TiDB CDC server and auto-created changefeed that sinks into Kafka.
- `cdc-consumer` – Node.js worker logging CDC events to stdout via log4js.
- `db-init` – One-shot job importing `db/init.sql` to create tables and default admin user.

Shutdown:

```bash
docker compose down
```

To inspect logs:

```bash
docker compose logs api        # health + login JSON entries
docker compose logs cdc-consumer
docker compose logs ticdc
```

---

## Manual Development

### Backend

```bash
cd server
cp .env.example .env          # adjust TiDB credentials when needed
npm install
npm run dev                   # http://localhost:4001
```

Environment variables (`server/.env`):

- `PORT`, `ALLOWED_ORIGINS`
- `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`
- `TIDB_USE_SSL`, `TIDB_STRICT_SSL`
- `DEFAULT_USER_EMAIL`, `DEFAULT_USER_PASSWORD`, `DEFAULT_USER_NAME`
- `AUTH_TOKEN_TTL_HOURS`

### Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

`client/.env`:
- `VITE_API_BASE_URL` – defaults to `http://localhost:4001/api`.

---

## API Surface

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/auth/login` | Returns `{ token, expiresAt, user }` for valid credentials. Logs `user_login` events with timestamp + IP via log4js. |
| `GET` | `/api/auth/me` | Validates a bearer token and returns the current user. |
| `GET` | `/api/flowers` | Lists flowers (auth required). |
| `POST` | `/api/flowers` | Creates a flower (auth required). |
| `GET` | `/api/health` | Pings TiDB to let Compose/monitors verify readiness. |

Samples:

```bash
# login using the seeded account
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"Admin@helfy.com","password":"helfy123!"}'

# authorized insert
curl -X POST http://localhost:4001/api/flowers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Blushing Tulip","color":"Pink","price":11.5}'
```

---

## CDC & Monitoring

- `ticdc` streams every TiDB change into Kafka topic `flowershop_cdc` using the Canal JSON protocol.
- `cdc-consumer` prints each message as a structured JSON log (timestamp, action, payload metadata).
- Login attempts are logged via log4js with IP + user info so operations can audit activity.
- All source files include explanatory comments referencing architecture/intent, per the assignment instructions.

---

## Troubleshooting

- Kafka consumer refusing connections? It now retries automatically; view `docker compose logs cdc-consumer`.
- Need to recreate the changefeed manually? Run `docker compose up ticdc-task` which wraps `/cdc cli changefeed create ...`.
- TiDB schema issues? Inspect `db/init.sql` (mounted read-only) and `server/src/db.js` which re-validates tables on boot.
