#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-/Users/bryce/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3}"

"$PYTHON_BIN" "$ROOT_DIR/tmp/convert-federation-learning-subsystem-docx.py"
