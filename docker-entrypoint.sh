#!/bin/sh
set -e

echo "> Aplicando migrations e seed (pnpm db:deploy)..."
pnpm run db:deploy

echo "> Iniciando API..."
exec "$@"
