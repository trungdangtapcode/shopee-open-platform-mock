#!/usr/bin/env bash
# ============================================================================
# Shopee Open Platform Mock & SDK — One-Command Project Controller
#
# Usage:
#   ./shop.sh on       (or ./shop.sh start)   — Turn ON the whole project
#   ./shop.sh off      (or ./shop.sh stop)    — Turn OFF the whole project
#   ./shop.sh restart                         — Restart the server
#   ./shop.sh status                          — Check server status & URLs
#   ./shop.sh test                            — Run Python SDK (455 APIs) tests
#   ./shop.sh reset                           — Reset mock database to fresh state
#   ./shop.sh logs                            — Show recent server logs
# ============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCK_DIR="$ROOT_DIR/shopee-mock"
PY_SDK_DIR="$ROOT_DIR/python-shopee-sdk"
PID_FILE="$ROOT_DIR/.shopee-mock.pid"
LOG_FILE="$ROOT_DIR/.shopee-mock.log"
STATE_FILE="$MOCK_DIR/shopee_mock_state.json"

PORT="${PORT:-3099}"
PARTNER_ID="${PARTNER_ID:-1}"
PARTNER_KEY="${PARTNER_KEY:-1}"
STRICT_SIG="${STRICT_SIG:-true}"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_project() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "🟢 Shopee Mock Project is ALREADY RUNNING (PID: $pid, Port: $PORT)"
    print_urls
    return 0
  fi

  # Clean up any orphan shopee-mock process on the same port
  pkill -f "$MOCK_DIR/index.js" 2>/dev/null || true

  echo "🚀 Starting Shopee Open Platform Mock Server + Console UI on port $PORT..."
  (
    cd "$MOCK_DIR"
    nohup env \
      PORT="$PORT" \
      PARTNER_ID="$PARTNER_ID" \
      PARTNER_KEY="$PARTNER_KEY" \
      STRICT_SIG="$STRICT_SIG" \
      node "$MOCK_DIR/index.js" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  sleep 1
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "✅ Project is ON (PID: $pid)"
    print_urls
  else
    echo "❌ Failed to start server. Check logs below:"
    tail -n 25 "$LOG_FILE" || true
    exit 1
  fi
}

stop_project() {
  local stopped=0
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "🛑 Stopping Shopee Mock Server (PID: $pid)..."
    kill "$pid" 2>/dev/null || true
    stopped=1
  fi
  rm -f "$PID_FILE"

  if pkill -f "$MOCK_DIR/index.js" 2>/dev/null; then
    stopped=1
  fi

  if [[ "$stopped" -eq 1 ]]; then
    echo "⚪ Project is now OFF."
  else
    echo "⚪ Project was already OFF."
  fi
}

status_project() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "🟢 STATUS: ONLINE (PID: $pid, Port: $PORT, STRICT_SIG: $STRICT_SIG)"
    print_urls
  else
    echo "⚪ STATUS: OFFLINE"
    echo "   Run './shop.sh on' to start the project."
  fi
}

print_urls() {
  echo "--------------------------------------------------------------------"
  echo "  ⚡ Open Platform Console UI : http://localhost:$PORT/console"
  echo "  🏪 Shopee Seller Centre UI  : http://localhost:$PORT/"
  echo "  🔑 OAuth Authorize Page     : http://localhost:$PORT/auth"
  echo "  🔗 API v2 Base URL          : http://localhost:$PORT/api/v2"
  echo "  📄 Server Log File          : $LOG_FILE"
  echo "--------------------------------------------------------------------"
}

test_project() {
  local started_temp=0
  if ! is_running; then
    start_project
    started_temp=1
  fi

  echo ""
  echo "🧪 Running Python SDK End-to-End Test Suite (455 API Schemas)..."
  SHOPEE_BASE_URL="http://localhost:$PORT/api/v2" \
  SHOPEE_AUTH_URL="http://localhost:$PORT/auth" \
  SHOPEE_PARTNER_ID="$PARTNER_ID" \
  SHOPEE_PARTNER_KEY="$PARTNER_KEY" \
  python3 "$PY_SDK_DIR/test_app.py"

  if [[ "$started_temp" -eq 1 ]]; then
    stop_project
  fi
}

reset_project() {
  rm -f "$STATE_FILE"
  if is_running; then
    curl -s -X POST "http://localhost:$PORT/api/demo/reset" >/dev/null || true
    echo "♻️  Live server state and $STATE_FILE reset to fresh defaults."
  else
    echo "♻️  Removed saved state file ($STATE_FILE)."
  fi
}

ACTION="${1:-status}"
case "$ACTION" in
  on|start|up)
    start_project
    ;;
  off|stop|down)
    stop_project
    ;;
  restart|reload)
    stop_project
    sleep 1
    start_project
    ;;
  status|info)
    status_project
    ;;
  test)
    test_project
    ;;
  reset|clean)
    reset_project
    ;;
  logs|log)
    tail -n 40 "$LOG_FILE"
    ;;
  *)
    echo "Usage: ./shop.sh {on|off|restart|status|test|reset|logs}"
    exit 1
    ;;
esac
