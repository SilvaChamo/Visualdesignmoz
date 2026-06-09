#!/bin/bash
# Re-aplica normalização de login (maiúsculas/email → admin) após updates do Evolution.
set -e
JS_SRC=/usr/local/directadmin/data/skins/evolution/assets/da-login-normalize.js
JS_FALLBACK=/var/www/html/da-login-normalize.js
INDEX=/usr/local/directadmin/data/skins/evolution/assets/index.html
MARKER='da-login-normalize.js'
SCRIPT_TAG='      <script src="/evo/da-login-normalize.js"></script>'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/da-login-normalize.js" ]; then
  cp "$SCRIPT_DIR/da-login-normalize.js" "$JS_SRC"
elif [ -f "$JS_FALLBACK" ] && [ ! -f "$JS_SRC" ]; then
  cp "$JS_FALLBACK" "$JS_SRC"
fi

chmod 644 "$JS_SRC"
chown diradmin:diradmin "$JS_SRC" 2>/dev/null || true

if ! grep -q "$MARKER" "$INDEX"; then
  sed -i "s|<script type=\"module\" crossorigin src=\"/evo/index|$SCRIPT_TAG\n      <script type=\"module\" crossorigin src=\"/evo/index|" "$INDEX"
fi

python3 - "$INDEX" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_text()
lines = text.splitlines()
seen = False
out = []
for line in lines:
    if "da-login-normalize.js" in line:
        if seen:
            continue
        seen = True
        out.append('      <script src="/evo/da-login-normalize.js"></script>')
        continue
    out.append(line)
p.write_text("\n".join(out) + "\n")
PY

chown diradmin:diradmin "$INDEX" 2>/dev/null || true
