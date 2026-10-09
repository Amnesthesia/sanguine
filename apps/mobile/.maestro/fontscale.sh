#!/usr/bin/env bash
# Runs fontscale.yaml with the system text size at ~150% on the chosen platform, then restores it.
set -uo pipefail
cd "$(dirname "$0")/.."
platform="${1:-ios}"
if [ "$platform" = ios ]; then
  dev="${IOS_UDID:-1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757}"
  xcrun simctl ui "$dev" content_size accessibility-medium
  trap 'xcrun simctl ui "$dev" content_size large' EXIT
else
  export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
  adb shell settings put system font_scale 1.5
  trap 'adb shell settings put system font_scale 1.0' EXIT
fi
ITEM="${ITEM:-P2-14}" .maestro/run.sh "$platform" fontscale.yaml
