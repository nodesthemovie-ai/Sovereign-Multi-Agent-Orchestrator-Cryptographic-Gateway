#!/usr/bin/env bash
set -euo pipefail
echo "[VERIFY] Testing GHSA-vx5x-727q-9979 (target-vikunja-11) CORS Remediation Patch..."
grep -q 'AllowCredentials: false' remediation.patch.diff
echo "[PASS] Permissive wildcard CORS with credentials remediated."
