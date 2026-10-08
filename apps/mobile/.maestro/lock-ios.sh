#!/usr/bin/env bash
# iOS simulator only: enrol Face ID, then drive the lock screen with simulated matching / non-matching faces.
# Usage: apps/mobile/.maestro/lock-ios.sh   (Metro must be running on :8090)
set -uo pipefail
cd "$(dirname "$0")/.."
bundle=host.exp.Exponent; [ "${CLIENT:-expogo}" = dev ] && bundle=app.sanguine.mobile
dev="${IOS_UDID:-1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757}"
unenrol() { xcrun simctl spawn "$dev" notifyutil -s com.apple.BiometricKit.enrollmentChanged 0 >/dev/null; xcrun simctl spawn "$dev" notifyutil -p com.apple.BiometricKit.enrollmentChanged >/dev/null; }
trap unenrol EXIT
face() { xcrun simctl spawn "$dev" notifyutil -p "com.apple.BiometricKit_Sim.pearl.$1" >/dev/null; }
xcrun simctl spawn "$dev" notifyutil -s com.apple.BiometricKit.enrollmentChanged 1 >/dev/null
xcrun simctl spawn "$dev" notifyutil -p com.apple.BiometricKit.enrollmentChanged >/dev/null
xcrun simctl terminate "$dev" "$bundle" >/dev/null 2>&1
xcrun simctl terminate "$dev" "$bundle" >/dev/null 2>&1; sleep 2
ITEM=P2-13 .maestro/run.sh ios lock-a.yaml || exit 1
sleep 2; face nomatch; sleep 3
ITEM=P2-13 .maestro/run.sh ios lock-b.yaml || exit 1
ITEM=P2-13 .maestro/run.sh ios lock-b2.yaml || exit 1
sleep 2; face match; sleep 3
ITEM=P2-13 .maestro/run.sh ios lock-c.yaml || exit 1
# re-lock: leave the app for just over a minute (LOCK_AFTER_MS = 60 s), come back, expect the Face ID sheet again
xcrun simctl launch "$dev" com.apple.Preferences >/dev/null 2>&1
sleep 66
xcrun simctl launch "$dev" "$bundle" >/dev/null 2>&1
sleep 3
ITEM=P2-13 .maestro/run.sh ios lock-d.yaml || exit 1
face match; sleep 2
