#!/usr/bin/env bash
# Usage: ITEM=P2-6 .maestro/run.sh ios|android flow.yaml [more flows]   (screenshots go to docs/screenshots/$ITEM/<platform>/)   (Metro must be running: npx expo start --port 8090)
set -uo pipefail
cd "$(dirname "$0")/.."
platform="$1"; shift
# CLIENT=expogo (default) or CLIENT=dev (the prebuilt dev client, app.sanguine.mobile)
client="${CLIENT:-expogo}"; port="${METRO_PORT:-8090}"
if [ "$platform" = ios ]; then
  dev="${IOS_UDID:-1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757}"; host="$(ipconfig getifaddr en0)"; expoid=host.exp.Exponent
else
  dev="${ANDROID_SERIAL:-emulator-5554}"; host="10.0.2.2"; expoid=host.exp.exponent
fi
if [ "$client" = dev ]; then
  appid=app.sanguine.mobile; linkbase="sanguine://"; connect="exp+sanguine://expo-development-client/?url=http%3A%2F%2F$host%3A$port"
else
  appid="$expoid"; linkbase="exp://$host:$port/--/"; connect=""
fi
shots="../../docs/screenshots/${ITEM:-misc}"; [ "$client" = dev ] && shots="$shots-devclient"; out="$(mktemp -d)"; mkdir -p "$shots"
status=0
for f in "$@"; do maestro --device "$dev" test --test-output-dir "$out" -e LINKBASE="$linkbase" -e CONNECT="$connect" -e CLIENT="$client" -e PLATFORM="$platform" -e APP_ID="$appid" ".maestro/$f" || status=1; done
# flatten: docs/screenshots/<item>/<platform>-<name>.png ; drop Maestro's logs and recordings
find "$out" -path '*takeScreenshot*' -name '*.png' | while read -r f; do cp "$f" "$shots/$platform-$(basename "$f")"; done
if [ $status -ne 0 ]; then keep="/tmp/maestro-debug-$platform-$(date +%H%M%S)"; mv "$out" "$keep"; echo "maestro debug output kept at $keep"; else rm -rf "$out"; fi
exit $status
