#!/bin/sh
# Builds synthetic Clue-shaped zips for the ZipCrypto reader tests. No real data.
set -e
out="$(cd "$(dirname "$0")/../.." && pwd)/apps/mobile/src/data/adapters/fixtures"
tmp="$(mktemp -d)"
cat > "$tmp/measurements.json" <<'JSON'
[{"type":"period","id":"11111111-1111-4111-8111-111111111111","date":"2026-10-21","value":{"option":"medium"}},
{"type":"pain","id":"22222222-2222-4222-8222-222222222222","date":"2026-10-21","value":[{"option":"period_cramps"},{"option":"headache"}]},
{"type":"sleep_duration","id":"33333333-3333-4333-8333-333333333333","date":"2026-10-22","value":{"minutes":480}},
{"type":"discharge","id":"44444444-4444-4444-8444-444444444444","date":"2026-11-03","value":{"option":"egg_white"}}]
JSON
echo '{"profileData":{"cycle_length":29}}' > "$tmp/profile.json"
rm -f "$out"/clue-synthetic*.zip
cd "$tmp"
zip -q -X -P sanguine-test "$out/clue-synthetic.zip" measurements.json profile.json
zip -q -X "$out/clue-synthetic-plain.zip" measurements.json profile.json
zip -q -X -0 -P sanguine-test "$out/clue-synthetic-stored.zip" profile.json
rm -rf "$tmp"
