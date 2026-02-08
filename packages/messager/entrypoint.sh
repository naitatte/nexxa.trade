#!/bin/sh
set -e

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache ffmpeg
  else
    echo "[messager] ffmpeg missing and apk not available." >&2
    exit 1
  fi
fi

exec "$@"
