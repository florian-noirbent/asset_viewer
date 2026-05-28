# GoCanopy Asset Management POC

POC scaffold for uploading asset source files through a FastAPI API, storing the raw files in MinIO, and recording upload metadata in Postgres.

## Stack

- Backend: Python, FastAPI, SQLAlchemy async, MinIO client, uv
- Frontend: React, TypeScript, Vite, Tailwind, npm
- Services: Postgres 16, MinIO

## Run

```bash
docker compose up --build
```

Copy `.env.example` to `.env` first if you want to override the local defaults.

Open:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001

Postgres is exposed to host tools on `localhost:5433`. Inside Docker, services still use `postgres:5432`.

Default MinIO credentials are `minioadmin` / `minioadmin`.

## Current POC Flow

1. Upload a file from the frontend.
2. `POST /api/uploads` stores the file in MinIO under `uploads/{file_id}/original/{filename}`.
3. The backend creates a `file_index` row in Postgres.
4. The frontend displays the returned upload metadata.

Parsing, backend workers, notifications, asset extraction, and field-level source evidence are intentionally out of scope for this first step.

## Load Warrington Sample Data

The backend includes an explicit initializer for the JSON file in `ressources/`:

```bash
docker compose exec backend uv run --no-dev python -m app.db.init_from_json /app/ressources/warrington_test_data.json
```

The initializer creates missing tables, upserts assets, tenants, and leases, and preserves provenance JSON on each table.
