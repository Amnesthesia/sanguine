#!/usr/bin/env bash
# Usage: ITEM=P2-6 .maestro/run.sh ios|android flow.yaml [more flows]   (screenshots go to docs/screenshots/$ITEM/<platform>/)   (Metro must be running: npx expo start --port 8090)
set -uo pipefail
cd "$(dirname "$0")/.."
platform="$1"; shift
if [ "$platform" = ios ]; then
  dev="${IOS_UDID:-1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757}"; url="exp://$(ipconfig getifaddr en0):8090"; appid=host.exp.Exponent
else
  dev="${ANDROID_SERIAL:-emulator-5554}"; url="exp://10.0.2.2:8090"; appid=host.exp.exponent
fi
shots="../../docs/screenshots/${ITEM:-misc}"; out="$(mktemp -d)"; mkdir -p "$shots"
status=0
for f in "$@"; do maestro --device "$dev" test --test-output-dir "$out" -e APP_URL="$url" -e PLATFORM="$platform" -e APP_ID="$appid" ".maestro/$f" || status=1; done
# flatten: docs/screenshots/<item>/<platform>-<name>.png ; drop Maestro's logs and recordings
find "$out" -path '*takeScreenshot*' -name '*.png' | while read -r f; do cp "$f" "$shots/$platform-$(basename "$f")"; done
rm -rf "$out"
exit $status
