#!/usr/bin/env bash
# Runs the full games/maps test suite: pure unit tests first (fast, no
# browser), then the Playwright e2e tests. Stops and reports non-zero on
# the first failing file, but prints every file's result either way via
# the trailing summary.
set -u
cd "$(dirname "$0")"

UNIT_TESTS=(unit-measure.mjs unit-object-model.mjs unit-maps-index.mjs)
E2E_TESTS=(e2e-app-shell.js e2e-core-objects.js e2e-vertex-editing.js e2e-selection-and-search.js e2e-multi-map.js e2e-attachments.js e2e-pwa.js)

failures=0
for f in "${UNIT_TESTS[@]}" "${E2E_TESTS[@]}"; do
  echo ""
  echo "=================================================================="
  echo "  $f"
  echo "=================================================================="
  node "$f"
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "FAILED: $f (exit $status)"
    failures=$((failures + 1))
  fi
done

echo ""
if [ "$failures" -eq 0 ]; then
  echo "All test files passed."
else
  echo "$failures test file(s) failed."
fi
exit "$failures"
