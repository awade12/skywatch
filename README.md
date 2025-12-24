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
- Statistics dashboard with charts (aircraft/hour, altitude distribution, top operators)
- Discord webhooks for emergency squawks, watchlist alerts, and health monitoring
- Receiver health monitoring (CPU, memory, temperature, uptime)
- Feed statistics (message rate, connection status)

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
Open http://localhost:8080/stats.html for the statistics dashboard.

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
- Install RTL-SDR libraries and dump1090-mutability
- Install Go if needed
- Set up dump1090-mutability as a systemd service (auto-starts on boot)
- Build and install Skywatch as a systemd service
- Set up configuration at `/etc/skywatch/config.json`

After installation, edit `/etc/skywatch/config.json` to set your receiver coordinates (`rx_lat` and `rx_lon`), then restart:

```bash
sudo systemctl restart skywatch
```

To update to the latest version:

```bash
sudo ./deploy/update.sh
```

Or run the install script again (it will detect and update existing installations):

```bash
sudo /opt/skywatch/deploy/update.sh
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
  "sbs_port": 30003,
  "feed_format": "sbs",
  "http_addr": ":8080",
  "rx_lat": 33.287876,
  "rx_lon": -96.982565,
  "stale_timeout": "60s",
  "device_index": 0,
  "trail_length": 50,
  "database": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "",
    "dbname": "adsb",
    "sslmode": "disable"
  },
  "webhooks": {
    "discord_url": "https://discord.com/api/webhooks/...",
    "events": {
      "emergency_squawk": true,
      "aircraft_watchlist": ["N12345", "AAL*"],
      "new_aircraft": false,
      "health_alerts": true
    },
    "health_thresholds": {
      "cpu_percent": 90,
      "memory_percent": 90,
      "temp_celsius": 80
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `sbs_host` | Hostname of the SBS/Beast feed |
| `sbs_port` | Port (30003 for SBS, 30005 for Beast) |
| `feed_format` | `sbs` or `beast` |
| `rx_lat/rx_lon` | Receiver location for distance calculation |
| `node_name` | Display name for this receiver node (e.g., "Master Node", "Alex's Node") |
| `stale_timeout` | Remove aircraft not seen after this duration |
| `trail_length` | Number of positions to keep per aircraft |
| `webhooks.discord_url` | Discord webhook URL for notifications |
| `webhooks.events.emergency_squawk` | Alert on 7500/7600/7700 squawks |
| `webhooks.events.aircraft_watchlist` | List of ICAO/registration/callsign patterns (supports `*` wildcard) |
| `webhooks.events.new_aircraft` | Alert on every new aircraft (can be noisy) |
| `webhooks.events.health_alerts` | Alert when CPU/memory/temp exceed thresholds |

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

### GET /api/v1/stats/overall

Returns overall database statistics:
```json
{
  "total_unique_aircraft": 1542,
  "total_positions": 458923,
  "total_faa_records": 892,
  "positions_last_24h": 12453,
  "aircraft_last_24h": 234
}
```

### GET /api/v1/stats/hourly

Returns aircraft counts per hour. Query params:
- `hours` - Number of hours to return (default 24, max 168)

### GET /api/v1/stats/daily

Returns daily statistics. Query params:
- `days` - Number of days to return (default 7, max 90)

### GET /api/v1/stats/types

Returns top aircraft types seen in last 24h. Query params:
- `limit` - Number of results (default 10, max 50)

### GET /api/v1/stats/operators

Returns top operators/airlines seen in last 24h. Query params:
- `limit` - Number of results (default 10, max 50)

### GET /api/v1/stats/altitude

Returns altitude distribution for last hour:
```json
{
  "ground": 12,
  "low": 45,
  "medium": 89,
  "high": 156,
  "very_high": 23
}
```

### GET /api/v1/stats/recent

Returns recently seen aircraft with FAA info. Query params:
- `limit` - Number of results (default 50, max 200)

### GET /api/v1/health

Returns service health status.

### GET /api/v1/receiver/health

Returns receiver system health:
```json
{
  "cpu_percent": 23.5,
  "memory_percent": 45.2,
  "memory_used_mb": 512,
  "memory_total_mb": 1024,
  "temp_celsius": 52.3,
  "uptime": "2h30m15s",
  "goroutines": 12,
  "platform": "linux/arm64"
}
```

### GET /api/v1/receiver/feed

Returns feed connection status:
```json
{
  "connected": true,
  "last_message": "2025-01-01T12:00:00Z",
  "messages_total": 123456,
  "messages_per_sec": 45.2,
  "reconnects": 0,
  "host": "127.0.0.1",
  "port": 30003,
  "format": "sbs"
}
```

### POST /api/v1/webhooks/test

Sends a test webhook to verify configuration. Returns 200 OK on success.

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
│   ├── index.html         # Live map
│   ├── stats.html         # Statistics dashboard
│   └── app.js
├── internal/
│   ├── api/                # HTTP/WebSocket handlers
│   ├── config/             # Config loader
│   ├── database/           # PostgreSQL connection & repository
│   ├── feed/               # TCP client for SBS feed
│   ├── health/             # System health monitoring
│   ├── lookup/             # FAA aircraft lookup
│   ├── sbs/                # SBS-1 message parser
│   ├── tracker/            # Aircraft state management
│   └── webhook/            # Discord webhook notifications
└── pkg/
    └── models/             # Data models
```
