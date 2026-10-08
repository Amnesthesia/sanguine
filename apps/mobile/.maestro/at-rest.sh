#!/usr/bin/env bash
# P3-2: the app's database on the device is SQLCipher-encrypted. Passes when the file exists and does not start with the
# plain SQLite header. Run after any flow that opened the app. Usage: .maestro/at-rest.sh ios|android
set -euo pipefail
app=app.sanguine.mobile
case "${1:?ios or android}" in
  ios) head16=$(head -c 16 "$(xcrun simctl get_app_container booted "$app" data)/Documents/SQLite/sanguine.db" | xxd -p) ;;
  android)
    db=files/SQLite/sanguine.db
    # exec-out merges run-as errors into stdout, so check the file exists before reading its header
    adb exec-out run-as "$app" test -f "$db" || { echo "no database file"; exit 1; }
    head16=$(adb exec-out run-as "$app" cat "$db" 2>/dev/null | head -c 16 | xxd -p) ;;
esac
plain=$(printf 'SQLite format 3\0' | xxd -p)
[ -n "$head16" ] || { echo "no database file"; exit 1; }
[ "$head16" != "$plain" ] || { echo "database is NOT encrypted"; exit 1; }
echo "database is encrypted (header $head16)"
