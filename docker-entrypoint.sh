#!/bin/sh
set -e

echo "> Aplicando migrations e seed..."
node_modules/.bin/prisma migrate deploy
node_modules/.bin/tsx prisma/seed.ts

echo "> Iniciando API..."
exec "$@"