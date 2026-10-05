#!/usr/bin/env python3
"""Serve dist/ with headers from _headers (for CSP, HSTS, etc.)"""
import http.server
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DIST = ROOT / "dist"
HEADERS_FILE = DIST / "_headers"

def parse_headers(path: Path):
    """Parse _headers file into a dict of path -> list of (header, value)"""
    text = path.read_text()
    result = {}
    current_path = None
    for line in text.splitlines():
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        if not line.startswith(" "):
            # New path
            current_path = line.rstrip(":") or "/"
            result[current_path] = []
        elif current_path and ": " in line:
            header, value = line.split(": ", 1)
            result[current_path].append((header.strip(), value.strip()))
    return result

def match_path(request_path: str, patterns: dict):
    """Headers that apply to a request path.

    Netlify/Cloudflare `_headers` merge every matching block, so this does too.
    Order in the file does not decide precedence: a path matching both `/*` and
    `/flutter-demo/*` gets headers from both. Getting this wrong hides real bugs
    -- a `frame-ancestors 'none'` on the top page must not silently follow the
    framed app and block it, which is exactly what first-match-wins did here.
    """
    out = []
    seen = set()
    for pattern, headers in patterns.items():
        matched = (
            pattern in ("/*", "/")
            or (pattern.endswith("*") and request_path.startswith(pattern[:-1]))
            or request_path == pattern
        )
        if not matched:
            continue
        for header, value in headers:
            # A more specific pattern is listed later in _headers and wins for
            # the same header name; keep the last one written for that name.
            if header.lower() in {h.lower() for h, _ in out}:
                out = [(h, v) for h, v in out if h.lower() != header.lower()]
            out.append((header, value))
    return out

class HeaderHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, headers_map=None, **kwargs):
        self.headers_map = headers_map or {}
        super().__init__(*args, directory=str(DIST), **kwargs)

    def end_headers(self):
        # Add custom headers based on the request path
        for header, value in match_path(self.path, self.headers_map):
            self.send_header(header, value)
        super().end_headers()

    def log_message(self, format, *args):
        # Quieter logging
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

if __name__ == "__main__":
    if not DIST.exists():
        print(f"dist/ not found at {DIST}. Run 'python3 build.py' first.")
        sys.exit(1)
    if not HEADERS_FILE.exists():
        print(f"_headers not found at {HEADERS_FILE}")
        sys.exit(1)

    headers_map = parse_headers(HEADERS_FILE)
    print("Loaded headers:")
    for path, headers in headers_map.items():
        print(f"  {path}:")
        for h, v in headers:
            print(f"    {h}: {v}")

    class ServerHandler(HeaderHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, headers_map=headers_map, **kwargs)

    port = 8082
    server = http.server.HTTPServer(("localhost", port), ServerHandler)
    print(f"\nServing {DIST} at http://localhost:{port} with _headers applied")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")