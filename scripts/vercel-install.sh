#!/bin/sh
set -e
# Vercel Root Directory may be the repo root or apps/web.
if [ -d apps/web ]; then
  cd apps/web
fi
npm ci
