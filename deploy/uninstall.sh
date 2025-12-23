#!/bin/bash
set -e

INSTALL_DIR="/opt/skywatch"
CONFIG_DIR="/etc/skywatch"
SERVICE_NAME="skywatch"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[*]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo ./uninstall.sh)"
fi

echo ""
echo -e "${YELLOW}This will remove Skywatch from your system.${NC}"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

log "Stopping Skywatch service..."
systemctl stop skywatch 2>/dev/null || true
systemctl disable skywatch 2>/dev/null || true

log "Removing systemd service..."
rm -f /etc/systemd/system/skywatch.service
systemctl daemon-reload

read -p "Stop and remove dump1090 service? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Stopping dump1090 service..."
    systemctl stop dump1090 2>/dev/null || true
    systemctl disable dump1090 2>/dev/null || true
    rm -f /etc/systemd/system/dump1090.service
    systemctl daemon-reload
fi

log "Removing application files..."
rm -rf "$INSTALL_DIR"

read -p "Remove configuration files? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removing configuration..."
    rm -rf "$CONFIG_DIR"
fi

read -p "Remove skywatch user? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removing skywatch user..."
    userdel skywatch 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Skywatch has been uninstalled.${NC}"
echo ""
echo "Note: dump1090-mutability and Go were left installed."
echo "To remove them manually:"
echo "  sudo apt-get remove dump1090-mutability"
echo "  sudo rm -rf /usr/local/go"
echo ""

