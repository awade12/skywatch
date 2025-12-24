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
cd "$INSTALL_DIR"

if [ -d ".git" ]; then
    git -c safe.directory="$INSTALL_DIR" fetch origin
    git -c safe.directory="$INSTALL_DIR" reset --hard origin/main
else
    error "Not a git repository. Cannot update."
fi

log "Building web frontend..."
cd "$INSTALL_DIR/web"
npm install --silent
npm run build

log "Building Skywatch..."
cd "$INSTALL_DIR"
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

DUMP1090_BIN=""
if [ -x "/usr/bin/dump1090-mutability" ]; then
    DUMP1090_BIN="/usr/bin/dump1090-mutability"
elif [ -x "/usr/bin/dump1090" ]; then
    DUMP1090_BIN="/usr/bin/dump1090"
elif command -v dump1090-mutability &> /dev/null; then
    DUMP1090_BIN=$(command -v dump1090-mutability)
elif command -v dump1090 &> /dev/null; then
    DUMP1090_BIN=$(command -v dump1090)
else
    error "Could not find dump1090 binary!"
fi

log "  Feed format: $FEED_FORMAT, Port: $SBS_PORT, Device: $DEVICE_INDEX"
log "  dump1090 binary: $DUMP1090_BIN"

DUMP1090_SERVICE="/etc/systemd/system/dump1090.service"

if [ "$FEED_FORMAT" = "beast" ]; then
    BEAST_PORT="$SBS_PORT"
    cat > "$DUMP1090_SERVICE" << EOF
[Unit]
Description=dump1090-mutability ADS-B receiver
After=network.target

[Service]
Type=simple
User=root
ExecStart=$DUMP1090_BIN --device-index $DEVICE_INDEX --net --net-bo-port $BEAST_PORT --quiet
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
ExecStart=$DUMP1090_BIN --device-index $DEVICE_INDEX --net --net-sbs-port $SBS_PORT --quiet
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
fi

if [ -f "$DUMP1090_SERVICE" ]; then
    log "Created $DUMP1090_SERVICE"
else
    error "Failed to create dump1090 service file!"
fi

systemctl daemon-reload
systemctl enable dump1090

log "Restarting dump1090..."
systemctl restart dump1090
sleep 2

if systemctl is-active --quiet dump1090; then
    log "dump1090 restarted successfully"
else
    warn "dump1090 failed to start! Check: sudo journalctl -u dump1090 -n 20"
    warn "Make sure an RTL-SDR dongle is connected"
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
echo "  Service Status:"
DUMP_STATUS=$(systemctl is-active dump1090 2>/dev/null || echo "inactive")
SKY_STATUS=$(systemctl is-active skywatch 2>/dev/null || echo "inactive")
if [ "$DUMP_STATUS" = "active" ]; then
    echo -e "    dump1090:  ${GREEN}running${NC}"
else
    echo -e "    dump1090:  ${RED}not running${NC} - check RTL-SDR connection"
fi
if [ "$SKY_STATUS" = "active" ]; then
    echo -e "    skywatch:  ${GREEN}running${NC}"
else
    echo -e "    skywatch:  ${RED}not running${NC}"
fi
echo ""
echo "  Commands:"
echo "    sudo systemctl status dump1090    - Check dump1090 status"
echo "    sudo systemctl status skywatch    - Check skywatch status"
echo "    sudo journalctl -u dump1090 -f    - View dump1090 logs"
echo "    sudo journalctl -u skywatch -f    - View skywatch logs"
echo ""

