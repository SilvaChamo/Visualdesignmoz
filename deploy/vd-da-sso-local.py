#!/usr/bin/env python3
"""Serviço local (127.0.0.1) — gera URL one-time DirectAdmin. Só acessível no servidor."""
from __future__ import annotations

import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = '127.0.0.1'
PORT = 39171
DA_BIN = '/usr/local/directadmin/directadmin'
USER_RE = re.compile(r'^[a-z0-9._-]{1,64}$')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def do_GET(self) -> None:
        if self.path.startswith('/health'):
            self._json(200, {'ok': True})
            return

        from urllib.parse import parse_qs, urlparse

        qs = parse_qs(urlparse(self.path).query)
        user = (qs.get('user') or [''])[0].strip().lower()
        if not USER_RE.match(user):
            self._json(400, {'error': 'user'})
            return

        try:
            proc = subprocess.run(
                [DA_BIN, 'login-url', f'--user={user}'],
                capture_output=True,
                text=True,
                timeout=12,
                check=False,
            )
            line = (proc.stdout or '').strip().splitlines()[-1].strip() if proc.stdout else ''
            if not line.startswith('http') or '/api/login/' not in line:
                self._json(500, {'error': 'da'})
                return
            self._json(200, {'url': line})
        except Exception:
            self._json(500, {'error': 'da'})

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()
