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
    """Find matching headers for a request path"""
    for pattern, headers in patterns.items():
        if pattern == "/*" or pattern == "/":
            return headers
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            if request_path.startswith(prefix):
                return headers
        if request_path == pattern:
            return headers
    return []

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