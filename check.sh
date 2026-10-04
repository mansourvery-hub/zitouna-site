#!/bin/sh
# One command: build, static checks, unit tests, contrast. Exits non-zero on any failure.
set -e
cd "$(dirname "$0")"
python3 build.py
node --test tests/logic.test.mjs
python3 tests/contrast.py | tail -1
