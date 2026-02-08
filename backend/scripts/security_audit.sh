#!/bin/bash
# Run pip-audit (or safety) to check for known vulnerabilities in dependencies.
# Usage: ./scripts/security_audit.sh
# Requires: pip install pip-audit (or safety)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

if command -v pip-audit &>/dev/null; then
  echo "Running pip-audit..."
  pip-audit
elif command -v safety &>/dev/null; then
  echo "Running safety check..."
  safety check
else
  echo "Install pip-audit: pip install pip-audit"
  echo "Then run: pip-audit"
  exit 1
fi

echo "Security audit completed."
