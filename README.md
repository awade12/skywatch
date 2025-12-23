# Skywatch

A Go service that consumes live ADS-B data from dump1090/readsb via SBS-1 format over TCP, maintains aircraft state in memory, and exposes HTTP and WebSocket APIs for real-time tracking. Includes a live map UI, PostgreSQL persistence, and FAA aircraft lookup.

## Features

- Live aircraft tracking with position, altitude, speed, heading
- Distance and bearing from receiver
- Track history with flight trails
- FAA database lookup (registration, aircraft type, operator)
- PostgreSQL persistence
- Real-time WebSocket updates
- Live map UI with dark theme

## Architecture

```
RTL-SDR → dump1090/readsb → TCP (SBS-1) → Go Tracker → PostgreSQL
                                              ↓
                                         HTTP/WS API → Web UI
```

## Prerequisites

- Go 1.21+
- dump1090-mutability or readsb (we use dump1090-mutability)
- PostgreSQL (optional, for persistence)
- RTL-SDR device (we use a RTL-SDR dongle)


## Installation

```bash
go build -o adsb-tracker
```

## Quick Start

```bash
# Without database
./adsb-tracker -start-dump1090 -rx-lat 33.287876 -rx-lon -96.982565 -no-db

# With database
./adsb-tracker -start-dump1090
```

Open http://localhost:8080 for the live map.

## Raspberry Pi Installation

For Raspberry Pi deployment, use the automated install script:

```bash
curl -sSL https://raw.githubusercontent.com/awade12/skywatch/main/deploy/install.sh | sudo bash
```

Or clone and run:

```bash
git clone https://github.com/awade12/skywatch.git
cd skywatch
sudo ./deploy/install.sh
```

The script will:
- Install RTL-SDR libraries and build dump1090-mutability from source
- Install Go if needed
- Build and install Skywatch as a systemd service
- Set up configuration at `/etc/skywatch/config.json`

After installation, edit `/etc/skywatch/config.json` to set your receiver coordinates (`rx_lat` and `rx_lon`), then restart:

```bash
sudo systemctl restart skywatch
```

To uninstall:

```bash
sudo ./deploy/uninstall.sh
```

## Config File

Create a `config.json`:

```json
{
  "sbs_host": "127.0.0.1",
  "sbs_port": 30003, // beast port is 30005
  "feed_format": "sbs", // sbs or beast
  "http_addr": ":8080",
  "rx_lat": 33.287876, // Receiver latitude - this is where the receiver is located
  "rx_lon": -96.982565, // Receiver longitude - this is where the receiver is located 
  "stale_timeout": "60s", // The time after which an aircraft is considered stale and removed from the list
  "device_index": 0, // Index of the RTL-SDR device to use
  "trail_length": 50, // Number of positions to keep per aircraft
  "database": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "",
    "dbname": "adsb",
    "sslmode": "disable"
  }
}
```

| Field | Description |
|-------|-------------|
| `sbs_host` | Hostname of the SBS/Beast feed |
| `sbs_port` | Port (30003 for SBS, 30005 for Beast) |
| `feed_format` | `sbs` or `beast` |
| `rx_lat/rx_lon` | Receiver location for distance calculation |
| `stale_timeout` | Remove aircraft not seen after this duration |
| `trail_length` | Number of positions to keep per aircraft |

## Command-line Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-config` | `config.json` | Path to config file |
| `-start-dump1090` | `false` | Automatically start dump1090 |
| `-device-index` | `0` | RTL-SDR device index |
| `-sbs-host` | `127.0.0.1` | SBS feed hostname |
| `-sbs-port` | `30003` | SBS feed port |
| `-http-addr` | `:8080` | HTTP server listen address |
| `-stale-timeout` | `60s` | Aircraft stale timeout |
| `-rx-lat` | `0` | Receiver latitude |
| `-rx-lon` | `0` | Receiver longitude |
| `-no-db` | `false` | Run without database |

## API Endpoints

All API endpoints are versioned under `/api/v1/`.

### GET /api/v1/aircraft

Returns all tracked aircraft with full state including trail.

### GET /api/v1/aircraft/{icao}

Returns a single aircraft by ICAO address.

### GET /api/v1/aircraft/{icao}/trail

Returns position trail for an aircraft.

### GET /api/v1/aircraft/{icao}/faa

Returns FAA registry info for an aircraft.

### GET /api/v1/aircraft/{icao}/history

Returns position history with optional time filtering.

Query params:
- `from` - Start time (RFC3339)
- `to` - End time (RFC3339)
- `limit` - Max results (default 100, max 1000)

### GET /api/v1/aircraft/search

Search/filter aircraft.

Query params:
- `callsign` - Filter by callsign (partial match)
- `type` - Filter by aircraft type
- `registration` - Filter by registration
- `bounds` - Geographic bounds: `minLat,minLon,maxLat,maxLon`

### GET /api/v1/receiver

Returns receiver location info.

### GET /api/v1/stats

Returns session statistics:
```json
{
  "uptime": "2h15m30s",
  "aircraft_now": 12,
  "total_seen": 156,
  "max_range_nm": 54.6,
  "max_range_icao": "A0A96C"
}
```

### GET /api/v1/health

Returns service health status.

### WebSocket /ws

Real-time aircraft updates. Events: `add`, `update`, `remove`.

## Database Setup

Create a PostgreSQL database:

```bash
createdb adsb
```

The schema is auto-migrated on startup.

## Project Structure

```
├── main.go
├── config.json
├── deploy/                 # Deployment scripts
│   ├── install.sh         # Raspberry Pi installer
│   ├── uninstall.sh       # Uninstaller
│   └── skywatch.service   # Systemd unit file
├── web/                    # Live map UI
│   ├── index.html
│   └── app.js
├── internal/
│   ├── api/                # HTTP/WebSocket handlers
│   ├── config/             # Config loader
│   ├── database/           # PostgreSQL connection & repository
│   ├── feed/               # TCP client for SBS feed
│   ├── lookup/             # FAA aircraft lookup
│   ├── sbs/                # SBS-1 message parser
│   └── tracker/            # Aircraft state management
└── pkg/
    └── models/             # Data models
```
