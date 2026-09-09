#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${BOOTSTRAP_ON_START:-true}" = "true" ]; then
  (
    sleep 10
    curl -fsS -X POST \
      -H "x-bootstrap-token: ${BETTER_AUTH_SECRET}" \
      "http://127.0.0.1:${PORT:-3000}/api/bootstrap" \
      && echo "Bootstrap finished" \
      || echo "Bootstrap failed, run it again from the app (Usuarios > Sincronizar)"
  ) &
fi

exec node server.mjs
