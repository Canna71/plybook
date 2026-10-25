#!/bin/sh
# Screenshot of the running dev app (pnpm tauri dev), after an optional driver command.
#   tools/shot.sh <name> ['{"go":"/play"}']   ->  $SHOTS/<name>.png (1400 px wide)
# The command goes to public/dev-driver.json (see src/dev/devdriver.ts); an "id" is added.
# Needs the Screen Recording permission for the terminal running it, and tools/winid
# (built from tools/winid.swift on first use: swiftc ships with the Xcode tools).
set -e
cd "$(dirname "$0")/.."
NAME=${1:?name}
SHOTS=${SHOTS:-/tmp/rechess-shots}
mkdir -p "$SHOTS"
if [ ! -x tools/winid ]; then
    swiftc -O tools/winid.swift -o tools/winid
fi
if [ -n "$2" ]; then
    ID=$(date +%s%N)
    # add the id to the command object
    printf '%s' "$2" | sed "s/^{/{\"id\":\"$ID\",/" > public/dev-driver.json
    sleep "${WAIT:-1.5}"
fi
WIN=$(tools/winid rechess)
screencapture -x -o -l "$WIN" "$SHOTS/$NAME-full.png"
sips -Z 1400 "$SHOTS/$NAME-full.png" --out "$SHOTS/$NAME.png" >/dev/null
rm "$SHOTS/$NAME-full.png"
echo "$SHOTS/$NAME.png"
