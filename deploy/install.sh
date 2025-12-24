#!/bin/bash
set -e

REPO_URL="https://github.com/awade12/skywatch.git"
INSTALL_DIR="/opt/skywatch"
CONFIG_DIR="/etc/skywatch"
SERVICE_NAME="skywatch"
GO_VERSION="1.21.5"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[*]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo ./install.sh)"
fi

ARCH=$(uname -m)
case $ARCH in
    aarch64) GO_ARCH="arm64" ;;
    armv7l)  GO_ARCH="armv6l" ;;
    armv6l)  GO_ARCH="armv6l" ;;
    x86_64)  GO_ARCH="amd64" ;;
    *)       error "Unsupported architecture: $ARCH" ;;
esac

log "Detected architecture: $ARCH (Go: $GO_ARCH)"

log "Updating package lists..."
apt-get update -qq

log "Installing dependencies..."
apt-get install -y -qq git curl build-essential pkg-config librtlsdr-dev rtl-sdr libusb-1.0-0-dev

log "Blacklisting DVB kernel modules for RTL-SDR..."
cat > /etc/modprobe.d/blacklist-rtlsdr.conf << 'EOF'
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
EOF

if lsmod | grep -q dvb_usb_rtl28xxu; then
    rmmod dvb_usb_rtl28xxu 2>/dev/null || true
fi

if ! command -v dump1090-mutability &> /dev/null; then
    log "Installing dump1090-mutability..."
    apt-get install -y -qq dump1090-mutability
else
    log "dump1090-mutability already installed"
fi

if ! command -v go &> /dev/null; then
    log "Installing Go $GO_VERSION..."
    
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    
    if ! grep -q '/usr/local/go/bin' /etc/profile; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    fi
    export PATH=$PATH:/usr/local/go/bin
else
    log "Go already installed: $(go version)"
fi

log "Setting up Skywatch..."

if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing installation..."
    cd "$INSTALL_DIR"
    git -c safe.directory="$INSTALL_DIR" fetch origin
    git -c safe.directory="$INSTALL_DIR" reset --hard origin/main
else
    log "Cloning repository..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

log "Installing Node.js if needed..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

log "Building web frontend..."
cd "$INSTALL_DIR/web"
npm install --silent
npm run build

log "Building Skywatch..."
cd "$INSTALL_DIR"
export PATH=$PATH:/usr/local/go/bin
go build -o adsb-tracker .

if ! id -u skywatch &>/dev/null; then
    log "Creating skywatch user..."
    useradd -r -s /bin/false skywatch
fi

log "Setting up configuration..."
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_DIR/config.json" ]; then
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "sbs_host": "127.0.0.1",
  "sbs_port": 30003,
  "feed_format": "sbs",
  "http_addr": ":8080",
  "rx_lat": 0.0,
  "rx_lon": 0.0,
  "stale_timeout": "60s",
  "device_index": 0,
  "trail_length": 50
}
EOF
    warn "Created default config at $CONFIG_DIR/config.json"
    warn "Please edit rx_lat and rx_lon with your receiver coordinates!"
fi

chown -R skywatch:skywatch "$INSTALL_DIR"
chown -R skywatch:skywatch "$CONFIG_DIR"

log "Creating dump1090 systemd service..."

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
log "Enabled dump1090 service"

log "Starting dump1090..."
systemctl start dump1090
sleep 2

if systemctl is-active --quiet dump1090; then
    log "dump1090 started successfully"
else
    warn "dump1090 failed to start! Check: sudo journalctl -u dump1090 -n 20"
    warn "Make sure an RTL-SDR dongle is connected"
fi

log "Creating Skywatch systemd service..."
cp "$INSTALL_DIR/deploy/skywatch.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable skywatch

log "Starting Skywatch..."
systemctl start skywatch

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Skywatch installed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Web UI: http://$(hostname -I | awk '{print $1}'):8080"
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
echo "  Config: $CONFIG_DIR/config.json"
echo ""
warn "Don't forget to set your receiver coordinates in the config!"
if [ "$DUMP_STATUS" != "active" ]; then
    warn "dump1090 is not running! Make sure RTL-SDR dongle is connected."
fi
echo ""

