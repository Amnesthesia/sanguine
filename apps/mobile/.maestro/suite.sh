#!/usr/bin/env bash
# Runs every Maestro flow on one platform in Expo Go. Usage: ITEM=P2-15 .maestro/suite.sh ios|android
# Prerequisites: Metro running (`npx expo start --port 8090`), the simulator/emulator booted, Expo Go installed.
set -uo pipefail
cd "$(dirname "$0")/.."
platform="${1:?ios or android}"
flows=(shell onboarding onboarding-agegate today logging calendar insights settings backup delete notifications)
[ "$platform" = ios ] && flows+=(export)
failed=()
for f in "${flows[@]}"; do
  echo "=== $f ($platform)"
  ITEM="${ITEM:-suite}" .maestro/run.sh "$platform" "$f.yaml" > "/tmp/maestro-$platform-$f.log" 2>&1 || failed+=("$f")
  grep -E "FAILED|Assertion is" "/tmp/maestro-$platform-$f.log" | head -2
done
if [ "$platform" = ios ]; then
  echo "=== app lock (ios, simulated Face ID)"
  .maestro/lock-ios.sh > /tmp/maestro-ios-lock.log 2>&1 || failed+=(lock)
fi
if [ ${#failed[@]} -eq 0 ]; then echo "SUITE GREEN ($platform): ${flows[*]}"; else echo "SUITE RED ($platform): ${failed[*]}"; exit 1; fi
