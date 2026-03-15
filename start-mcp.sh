#!/usr/bin/env bash
# start-mcp.sh — Start the wine-marketing MCP server and expose it via Cloudflare Tunnel
# Usage: ./start-mcp.sh
# Keep this terminal open while using Cowork. Ctrl+C to stop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$SCRIPT_DIR/mcp-server"
PLUGIN_DIR="$SCRIPT_DIR/cowork-plugin"
ZIP_PATH="$SCRIPT_DIR/wine-marketing-plugin.zip"

# Step 1: Start the MCP server in background
echo "Starting MCP server..."
cd "$MCP_DIR"
MCP_HTTPS_PORT=3101 node dist/index.js &
MCP_PID=$!

# Wait for server to be ready
sleep 2
if ! kill -0 $MCP_PID 2>/dev/null; then
  echo "ERROR: MCP server failed to start. Did you run 'npm run build' in mcp-server/?"
  exit 1
fi
echo "MCP server running (PID $MCP_PID)"

# Step 2: Start cloudflared tunnel, capture the URL
echo "Starting Cloudflare tunnel..."
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url https://localhost:3101 2>"$TUNNEL_LOG" &
TUNNEL_PID=$!

# Wait for the tunnel URL to appear in logs (up to 30 seconds)
TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: Could not get tunnel URL after 30 seconds. Check your internet connection."
  kill $MCP_PID $TUNNEL_PID 2>/dev/null
  cat "$TUNNEL_LOG"
  exit 1
fi

echo "Tunnel URL: $TUNNEL_URL"

# Step 3: Update .mcp.json
cat > "$PLUGIN_DIR/.mcp.json" <<EOF
{
  "mcpServers": {
    "wine-marketing-mcp": {
      "type": "http",
      "url": "$TUNNEL_URL/mcp"
    }
  }
}
EOF
echo "Updated .mcp.json with tunnel URL"

# Step 4: Rebuild the plugin zip
rm -f "$ZIP_PATH"
cd "$PLUGIN_DIR"
zip -r "$ZIP_PATH" .claude-plugin/ .mcp.json skills/ -q
echo "Rebuilt wine-marketing-plugin.zip"

echo ""
echo "============================================"
echo "  Wine Marketing MCP is ready!"
echo "  Tunnel URL: $TUNNEL_URL/mcp"
echo ""
echo "  Next steps:"
echo "  1. Reinstall wine-marketing-plugin.zip in Claude Desktop"
echo "  2. Add connector: $TUNNEL_URL/mcp"
echo "  3. Keep this terminal open while using Cowork"
echo "  Press Ctrl+C to stop everything"
echo "============================================"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $MCP_PID $TUNNEL_PID 2>/dev/null
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT INT TERM

# Keep running
wait $TUNNEL_PID
