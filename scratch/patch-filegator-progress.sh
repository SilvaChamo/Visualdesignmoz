#!/bin/bash
# Injeta barra de progresso/tempo no gestor FileGator (VisualDesign Files).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRESS_JS_SRC="$SCRIPT_DIR/vd-upload-progress.js"
PROGRESS_JS_DST=/var/www/html/files/dist/vd-upload-progress.js
MAIN_HTML=/var/www/html/files/dist/main.html
TAG='vd-upload-progress.js'

cp "$PROGRESS_JS_SRC" "$PROGRESS_JS_DST"
chmod 644 "$PROGRESS_JS_DST"
chown admin:access "$PROGRESS_JS_DST" 2>/dev/null || true

if ! grep -q "$TAG" "$MAIN_HTML"; then
  sed -i "s|</body>|<script src=\"/files/dist/vd-upload-progress.js\"></script></body>|" "$MAIN_HTML"
fi

echo "OK: progresso de upload activo em /files/dist/"
