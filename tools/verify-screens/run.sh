#!/usr/bin/env bash
# Frame versus build: for each row of manifest.json, render the design frame with headless Chrome, put the app in the same state on the
# iPhone simulator through dev deep links (no taps), screenshot it, and write both side by side (frame left, build right) to
# docs/screenshots/$ITEM/<row id>-<light|dark|150>.png.
#
#   ITEM=P8-25 tools/verify-screens/run.sh [row-id-regex]      e.g. ITEM=P8-25 VARIANTS=light tools/verify-screens/run.sh '^Today-'
#   tools/verify-screens/run.sh --list                         rows, and why the others cannot be reached by a link (no simulator needed)
#
# Needs: Metro already running (cd apps/mobile && npx expo start --dev-client --port 8090), the dev client app.sanguine.mobile installed on
# the simulator and its first-run developer-menu sheet dismissed once, headless Chrome and ImageMagick (`brew install imagemagick`).
# Environment: ITEM (required), VARIANTS (default "light dark 150"), IOS_UDID, METRO_PORT (8090), CLIENT=dev|expogo (dev), KEEP_RAW=1 (also
# keep the unframed build screenshots in $RAW_DIR), BOOT_WAIT, SEED_WAIT, SETTLE (seconds).
#
# Owner's rules for this machine: one simulator (never the Android emulator, never Maestro here), one run at a time (the lock below), and it
# stops when disk or swap is nearly full. It never starts Metro or a second simulator.
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root" || exit 1
manifest="$root/tools/verify-screens/manifest.json"

if [ "${1:-}" = "--list" ]; then
  node -e '
    const m = require(process.argv[1]);
    for (const r of m.rows) console.log(r.reachable ? `ok   ${r.id}  ${r.link}${r.scroll ? " scroll=" + r.scroll : ""}  [${(r.variants || ["light", "dark", "150"]).join(",")}]` : `skip ${r.id}  ${r.reason}`);
  ' "$manifest"
  exit 0
fi

filter="${1:-.}"
item="${ITEM:-}"
[ -n "$item" ] || { echo "run.sh: set ITEM to the backlog id, e.g. ITEM=P8-25" >&2; exit 2; }
dev="${IOS_UDID:-1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757}"   # iPhone 17 Pro Max
port="${METRO_PORT:-8090}"
client="${CLIENT:-dev}"
variants="${VARIANTS:-light dark 150}"
boot_wait="${BOOT_WAIT:-30}"; seed_wait="${SEED_WAIT:-8}"; settle="${SETTLE:-4}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
out="$root/docs/screenshots/$item"
raw_dir="${RAW_DIR:-$out/raw}"
lock=/tmp/sanguine-sim.lock

for tool in xcrun node magick curl; do command -v "$tool" >/dev/null || { echo "run.sh: $tool not found" >&2; exit 2; }; done
[ -x "$chrome" ] || { echo "run.sh: Google Chrome not found at $chrome" >&2; exit 2; }

# --- resource guards: disk under 3 GB free, or a large swap that is nearly full, stops the run (the machine has crashed from both) ---
guard() {
  local free_kb swap total used
  free_kb="$(df -k "$root" | awk 'NR==2 {print $4}')"
  if [ "${free_kb:-0}" -lt $((3 * 1024 * 1024)) ]; then echo "run.sh: stopping, under 3 GB of disk is free" >&2; return 1; fi
  swap="$(sysctl -n vm.swapusage 2>/dev/null)"   # total = 9216.00M  used = 7731.00M  free = 1485.00M  (encrypted)
  total="$(echo "$swap" | awk '{gsub("M","",$3); print int($3)}')"; used="$(echo "$swap" | awk '{gsub("M","",$6); print int($6)}')"
  if [ "${total:-0}" -ge 4096 ] && [ $((used * 10)) -ge $((total * 9)) ]; then echo "run.sh: stopping, swap is nearly full (${used}M of ${total}M)" >&2; return 1; fi
}
guard || exit 3

# --- the one simulator, and Metro ---
others="$(xcrun simctl list devices booted | grep -E '\(Booted\)' | grep -v "$dev" || true)"
if [ -n "$others" ]; then echo "run.sh: another simulator is booted; shut it down first (one simulator at a time):" >&2; echo "$others" >&2; exit 3; fi
if [ "$client" = dev ]; then
  curl -sf --max-time 3 "http://localhost:$port/status" | grep -q running || { echo "run.sh: Metro is not running on $port (cd apps/mobile && npx expo start --dev-client --port $port)" >&2; exit 3; }
fi

# --- the lock every simulator user takes ---
until mkdir "$lock" 2>/dev/null; do echo "run.sh: simulator in use, waiting..."; sleep 5; done
tmp="$(mktemp -d)"; mkdir -p "$tmp/frames" "$out"
orig_appearance=""; orig_size=""
cleanup() {
  if [ -n "$orig_appearance" ] && [ "$orig_appearance" != unknown ]; then xcrun simctl ui "$dev" appearance "$orig_appearance" >/dev/null 2>&1; fi
  if [ -n "$orig_size" ] && [ "$orig_size" != unknown ]; then xcrun simctl ui "$dev" content_size "$orig_size" >/dev/null 2>&1; fi
  xcrun simctl status_bar "$dev" clear >/dev/null 2>&1
  rm -rf "$tmp"; rmdir "$lock" 2>/dev/null
}
trap cleanup EXIT
trap 'exit 130' INT TERM

xcrun simctl list devices booted | grep -q "$dev" || { xcrun simctl boot "$dev" && xcrun simctl bootstatus "$dev" -b >/dev/null; }
orig_appearance="$(xcrun simctl ui "$dev" appearance 2>/dev/null | head -1)"
orig_size="$(xcrun simctl ui "$dev" content_size 2>/dev/null | head -1)"
xcrun simctl status_bar "$dev" override --time 9:41 --dataNetwork wifi --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100 >/dev/null 2>&1

if [ "$client" = dev ]; then
  appid=app.sanguine.mobile; linkbase="sanguine://"; connect="exp+sanguine://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$port"
else
  appid=host.exp.Exponent; linkbase="exp://$(ipconfig getifaddr en0):$port/--/"; connect=""
fi

# {today}, {today-N}, {today+N} -> dates (the sample data is relative to the real today, as is the app)
expand() {
  local s="$1" off
  while [[ "$s" =~ \{today([+-][0-9]+)?\} ]]; do
    off="${BASH_REMATCH[1]:-+0}"
    s="${s/"${BASH_REMATCH[0]}"/$(date -v"${off}"d +%F)}"
  done
  printf '%s' "$s"
}

# The frame as a PNG at 2x, cut below its last content row.
frame_png() {
  local name="$1" png="$tmp/frames/$1.png" box w h x y
  if [ ! -f "$png" ]; then
    "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=420,2400 --screenshot="$png" "file://$root/docs/design/glass-redesign/frames/$name.html" >/dev/null 2>&1
    box="$(magick "$png" -fuzz 2% -format '%@' info:)"
    if [[ "$box" =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]]; then
      w="$(magick identify -format '%w' "$png")"; h=$((BASH_REMATCH[2] + BASH_REMATCH[4] + 24))
      magick "$png" -crop "${w}x${h}+0+0" +repage "$png"
    fi
  fi
  printf '%s' "$png"
}

launch_app() {
  xcrun simctl terminate "$dev" "$appid" >/dev/null 2>&1
  xcrun simctl launch "$dev" "$appid" >/dev/null 2>&1 || return 1
  sleep 5
  if [ -n "$connect" ]; then xcrun simctl openurl "$dev" "$connect"; fi
  sleep "$boot_wait"
}

status=0; made=0
for variant in $variants; do
  guard || { status=3; break; }
  theme=light; [ "$variant" = dark ] && theme=dark
  xcrun simctl ui "$dev" appearance "$theme" >/dev/null
  # a text size change is only seen after a relaunch (the app does not follow it live yet), so every variant starts the app again
  if [ "$variant" = 150 ]; then xcrun simctl ui "$dev" content_size accessibility-medium >/dev/null; else xcrun simctl ui "$dev" content_size large >/dev/null; fi
  launch_app || { echo "run.sh: could not start $appid on $dev" >&2; status=1; break; }
  last_seed=""
  while IFS='|' read -r -u 3 id frame darkframe variant_list seed link scroll; do
    case ",$variant_list," in *",$variant,"*) ;; *) continue ;; esac
    sig="$seed&$theme"
    if [ "$sig" != "$last_seed" ]; then
      xcrun simctl openurl "$dev" "${linkbase}dev/seed?${seed}&wipeData=1&theme=$theme"
      sleep "$seed_wait"; last_seed="$sig"
    fi
    url="$(expand "$link")"; sep='?'; [[ "$url" == *\?* ]] && sep='&'
    xcrun simctl openurl "$dev" "${linkbase}${url}${sep}scroll=${scroll:-top}"
    sleep "$settle"
    build="$tmp/$id-$variant-build.png"
    if ! xcrun simctl io "$dev" screenshot --type=png "$build" >/dev/null 2>&1; then echo "FAIL  $id-$variant: no screenshot" >&2; status=1; continue; fi
    f="$frame"; [ "$variant" = dark ] && [ -n "$darkframe" ] && f="$darkframe"
    fpng="$(frame_png "$f")"
    if [ ! -s "$fpng" ]; then echo "FAIL  $id-$variant: frame $f did not render" >&2; status=1; continue; fi
    magick \( "$fpng" -resize x1400 \) \( -size 12x1400 xc:'#999999' \) \( "$build" -resize x1400 \) +append +repage "$out/$id-$variant.png" || { echo "FAIL  $id-$variant: could not join" >&2; status=1; continue; }
    if [ "${KEEP_RAW:-}" = 1 ]; then mkdir -p "$raw_dir"; cp "$build" "$raw_dir/$id-$variant.png"; fi
    echo "ok    $out/$id-$variant.png  (frame $f)"; made=$((made + 1))
    rm -f "$build"
  done 3< <(node -e '
    const m = require(process.argv[1]); const re = new RegExp(process.argv[2]);
    for (const r of m.rows) if (r.reachable && re.test(r.id)) console.log([r.id, r.frame, r.darkFrame || "", (r.variants || ["light", "dark", "150"]).join(","), r.seed, r.link, r.scroll || ""].join("|"));
  ' "$manifest" "$filter")
done

echo "run.sh: $made image(s) in $out"
echo "not reachable by a link (see --list for the reasons):"
node -e 'for (const r of require(process.argv[1]).rows) if (!r.reachable && new RegExp(process.argv[2]).test(r.id)) console.log("  " + r.id)' "$manifest" "$filter"
exit $status
