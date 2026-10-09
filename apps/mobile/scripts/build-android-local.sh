#!/usr/bin/env bash
# Builds the Android app on this machine with EAS (no cloud build minutes) and submits it to the Play internal track.
# Usage (from anywhere):  apps/mobile/scripts/build-android-local.sh [profile]     profile defaults to production
# Needs: `npx eas-cli login` once, Android SDK + NDK, JDK 17, and a Google service account key on EAS for submit
# (the first submit prompts for it if none is stored).
set -euo pipefail
cd "$(dirname "$0")/.."

profile="${1:-production}"
out="$PWD/build/sanguine-${profile}-$(date +%Y%m%d-%H%M).aab"
mkdir -p build

export JAVA_HOME="${JAVA_HOME_17:-$(/usr/libexec/java_home -v 17)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export EAS_NO_VCS=1                       # upload/copy through .easignore only (see .easignore)
export GRADLE_OPTS="${GRADLE_OPTS:--Xmx4g -Dorg.gradle.daemon=false}"   # one Gradle, no daemon left eating memory

java -version 2>&1 | head -1 | grep -q '"17' || { echo "JDK 17 required (got: $(java -version 2>&1 | head -1))"; exit 1; }
[ -d "$ANDROID_HOME/ndk" ] || { echo "Android NDK missing under $ANDROID_HOME/ndk (install it in Android Studio > SDK Manager)"; exit 1; }
free_gb=$(df -g . | awk 'NR==2{print $4}')
[ "$free_gb" -ge 15 ] || { echo "Only ${free_gb} GB free; a local Android build needs about 15 GB"; exit 1; }
# the emulator and a second Gradle compete for the same memory
adb devices 2>/dev/null | grep -q emulator && echo "warning: an Android emulator is running; shut it down if the build runs out of memory"

npx eas-cli whoami >/dev/null || { echo "Not logged in: run npx eas-cli login"; exit 1; }

echo "== building $profile locally -> $out"
npx eas-cli build --local --platform android --profile "$profile" --non-interactive --output "$out"

echo "== submitting $out to the Play internal track"
npx eas-cli submit --platform android --profile production --path "$out"

echo "done: $out"
