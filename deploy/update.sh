#!/bin/bash
set -e

INSTALL_DIR="/opt/skywatch"
CONFIG_DIR="/etc/skywatch"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[*]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo ./update.sh)"
fi

if [ ! -d "$INSTALL_DIR" ]; then
    error "Skywatch not found at $INSTALL_DIR. Run install.sh first."
fi

log "Stopping Skywatch service..."
systemctl stop skywatch 2>/dev/null || true

log "Updating Skywatch..."
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
cd "$INSTALL_DIR"

if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/main
else
    error "Not a git repository. Cannot update."
fi

log "Building Skywatch..."
export PATH=$PATH:/usr/local/go/bin
go build -o adsb-tracker .

log "Updating dump1090 service configuration..."

FEED_FORMAT="sbs"
SBS_PORT=30003
DEVICE_INDEX=0

if [ -f "$CONFIG_DIR/config.json" ]; then
    FEED_FORMAT=$(grep -o '"feed_format":\s*"[^"]*"' "$CONFIG_DIR/config.json" | cut -d'"' -f4 || echo "sbs")
    SBS_PORT=$(grep -o '"sbs_port":\s*[0-9]*' "$CONFIG_DIR/config.json" | grep -o '[0-9]*' || echo "30003")
    DEVICE_INDEX=$(grep -o '"device_index":\s*[0-9]*' "$CONFIG_DIR/config.json" | grep -o '[0-9]*' || echo "0")
fi

DUMP1090_SERVICE="/etc/systemd/system/dump1090.service"
if [ -f "$DUMP1090_SERVICE" ]; then
    if [ "$FEED_FORMAT" = "beast" ]; then
        BEAST_PORT=$(grep -o '"sbs_port":\s*[0-9]*' "$CONFIG_DIR/config.json" | grep -o '[0-9]*' || echo "30005")
        cat > "$DUMP1090_SERVICE" << EOF
[Unit]
Description=dump1090-mutability ADS-B receiver
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/dump1090 --device-index $DEVICE_INDEX --net --net-bo-port $BEAST_PORT --quiet
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    else
        cat > "$DUMP1090_SERVICE" << EOF
[Unit]
Description=dump1090-mutability ADS-B receiver
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/dump1090 --device-index $DEVICE_INDEX --net --net-sbs-port $SBS_PORT --quiet
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    systemctl daemon-reload
    systemctl restart dump1090
fi

chown -R skywatch:skywatch "$INSTALL_DIR"

log "Updating systemd service files..."
cp "$INSTALL_DIR/deploy/skywatch.service" /etc/systemd/system/
systemctl daemon-reload

log "Starting Skywatch..."
systemctl start skywatch

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Skywatch updated successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Status: sudo systemctl status skywatch"
echo "  Logs:   sudo journalctl -u skywatch -f"
echo ""

