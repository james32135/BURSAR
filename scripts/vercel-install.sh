#!/bin/sh
set -e
if [ -d apps/web ]; then
  cd apps/web
fi
npm install
