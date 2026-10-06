#!/usr/bin/env bash
# =============================================================
#  Rebuilds a clean local database, applies all project
#  migrations, the demo seed and the SQL test suite.
#  Usage: bash scripts/db/run.sh [db-name]
# =============================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_NAME="${1:-inovexa_test}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5433}"
export PGUSER="${PGUSER:-postgres}"

echo "== Rebuilding database: $DB_NAME (port $PGPORT) =="
psql -w -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists $DB_NAME with (force);"
psql -w -d postgres -v ON_ERROR_STOP=1 -c "create database $DB_NAME;"

echo "== Applying Supabase shim (local only) =="
psql -w -d "$DB_NAME" -v ON_ERROR_STOP=1 -f scripts/db/shim.sql

for f in supabase/migrations/*.sql; do
  echo "== Migration: $f =="
  psql -w -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$f"
done

if [ -f supabase/seed.sql ]; then
  echo "== Demo seed =="
  psql -w -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/seed.sql
fi

if [ "${RUN_TESTS:-1}" = "1" ] && [ -f scripts/db/tests.sql ]; then
  echo "== SQL test suite =="
  psql -w -d "$DB_NAME" -v ON_ERROR_STOP=1 -f scripts/db/tests.sql
fi

echo "== Done: $DB_NAME is ready =="
