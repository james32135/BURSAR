#!/bin/sh
set -e
# Vercel Root Directory may be the repo root or apps/web.
if [ -d apps/web ]; then
  cd apps/web
  npm run build
  cd ..
  rm -rf dist
  mkdir -p dist
  cp -R apps/web/dist/. dist/
else
  npm run build
fi
