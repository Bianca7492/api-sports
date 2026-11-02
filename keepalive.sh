#!/bin/sh
# Keep the iLOTBET app and its capture receiver running.
#
# A container restart clears every process, and the public URLs answer 502 until
# something is listening again. This loop starts the two servers if their ports
# are free and checks every 30s, so a crash heals itself instead of staying down.
cd "$(dirname "$0")" || exit 1
CAP="${ILOTBET_CAPTURE:-/workspace/project/.dump/ilotbet-capture.json}"
mkdir -p "$(dirname "$CAP")"

start_ui() {
  ILOTBET_CAPTURE="$CAP" PORT=12000 setsid node ui/ui.mjs >> /tmp/ui.log 2>&1 &
}
start_collector() {
  ILOTBET_CAPTURE="$CAP" setsid python3 collector.py 12001 >> /tmp/collector.log 2>&1 &
}
up() {
  curl -s -o /dev/null --max-time 5 "http://127.0.0.1:$1"
}

start_ui
start_collector
sleep 3

while true; do
  up 12000 || { echo "$(date +%T) ui down, restarting"; start_ui; }
  up 12001 || { echo "$(date +%T) collector down, restarting"; start_collector; }
  sleep 30
done
