"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Plane, Search, Radio, AlertTriangle, Navigation, Crosshair } from "lucide-react"

interface Aircraft {
  icao: string
  callsign?: string
  alt_ft?: number
  speed_kt?: number
  heading?: number
  lat?: number
  lon?: number
  distance_nm?: number
  bearing?: number
  bearing_cardinal?: string
  squawk?: string
  registration?: string
  aircraft_type?: string
  operator?: string
  last_seen: string
  on_ground?: boolean
  vertical_rate?: number
  trail?: Position[]
}

interface Position {
  lat: number
  lon: number
  alt_ft?: number
  timestamp: string
}

interface ReceiverInfo {
  lat?: number
  lon?: number
}

const COLORS = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardBorder: "#1e1e2e",
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f59e0b",
  cyan: "#06b6d4",
  purple: "#8b5cf6",
  text: "#ffffff",
  textMuted: "#71717a",
  textDim: "#3f3f46",
}

function createAircraftIcon(heading: number, isSelected: boolean, isEmergency: boolean) {
  const color = isEmergency ? COLORS.red : isSelected ? COLORS.cyan : COLORS.green
  const size = isSelected ? 28 : 22
  
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading || 0}deg);">
      <path d="M12 2L8 10H4L6 12L4 14H8L12 22L16 14H20L18 12L20 10H16L12 2Z" fill="${color}" stroke="${isSelected ? '#fff' : '#000'}" stroke-width="1"/>
    </svg>
  `
  
  return L.divIcon({
    html: svg,
    className: `aircraft-marker ${isEmergency ? 'emergency-pulse' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapUpdater({ center, zoom }: { center: [number, number] | null; zoom: number | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (center && zoom) {
      map.flyTo(center, zoom, { duration: 0.5 })
    }
  }, [center, zoom, map])
  
  return null
}

export function MapPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<Position[]>([])
  const [receiver, setReceiver] = useState<ReceiverInfo | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [mapZoom, setMapZoom] = useState<number | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [acRes, rxRes] = await Promise.all([
          fetch("/api/v1/aircraft"),
          fetch("/api/v1/receiver"),
        ])
        
        if (acRes.ok) {
          const data = await acRes.json()
          setAircraft(Array.isArray(data) ? data : [])
        }
        
        if (rxRes.ok) {
          const data = await rxRes.json()
          if (data.lat && data.lon) {
            setReceiver({ lat: data.lat, lon: data.lon })
          }
        }
      } catch (e) {
        console.error("Failed to fetch data:", e)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedIcao) {
      const fetchTrail = async () => {
        try {
          const res = await fetch(`/api/v1/aircraft/${selectedIcao}/trail`)
          if (res.ok) {
            const data = await res.json()
            setSelectedTrail(Array.isArray(data) ? data : [])
          }
        } catch (e) {
          console.error("Failed to fetch trail:", e)
        }
      }
      fetchTrail()
    } else {
      setSelectedTrail([])
    }
  }, [selectedIcao])

  const handleAircraftClick = (ac: Aircraft) => {
    setSelectedIcao(ac.icao)
    if (ac.lat && ac.lon) {
      setMapCenter([ac.lat, ac.lon])
      setMapZoom(11)
    }
  }

  const handleCenterOnReceiver = () => {
    if (receiver?.lat && receiver?.lon) {
      setMapCenter([receiver.lat, receiver.lon])
      setMapZoom(9)
    }
  }

  const aircraftWithPosition = aircraft.filter(a => a.lat && a.lon)
  const emergencySquawks = aircraft.filter(a => 
    a.squawk === "7500" || a.squawk === "7600" || a.squawk === "7700"
  )

  const filteredAircraft = aircraft.filter(a => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.icao?.toLowerCase().includes(q) ||
      a.callsign?.toLowerCase().includes(q) ||
      a.registration?.toLowerCase().includes(q) ||
      a.aircraft_type?.toLowerCase().includes(q)
    )
  })

  const selectedAircraft = aircraft.find(a => a.icao === selectedIcao)

  const defaultCenter: [number, number] = receiver?.lat && receiver?.lon 
    ? [receiver.lat, receiver.lon] 
    : [33.2, -97.0]

  return (
    <div className="h-screen flex" style={{ backgroundColor: COLORS.bg }}>
      <style>{`
        .leaflet-container {
          background: ${COLORS.bg};
        }
        .aircraft-marker {
          background: transparent;
          border: none;
        }
        .emergency-pulse {
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        .leaflet-popup-content-wrapper {
          background: ${COLORS.card};
          color: ${COLORS.text};
          border: 1px solid ${COLORS.cardBorder};
          border-radius: 12px;
        }
        .leaflet-popup-tip {
          background: ${COLORS.card};
        }
        .leaflet-control-zoom a {
          background: ${COLORS.card} !important;
          color: ${COLORS.text} !important;
          border-color: ${COLORS.cardBorder} !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${COLORS.cardBorder} !important;
        }
      `}</style>

      <div className="flex-1 relative">
        {emergencySquawks.length > 0 && (
          <div className="absolute top-4 left-4 right-4 z-[1000] p-3 rounded-xl flex items-center gap-3 animate-pulse" 
               style={{ backgroundColor: "rgba(239, 68, 68, 0.9)", border: "1px solid rgba(239, 68, 68, 0.6)" }}>
            <AlertTriangle className="h-5 w-5 text-white" />
            <div className="text-white text-sm font-medium">
              EMERGENCY: {emergencySquawks.map(a => (
                <span key={a.icao} className="mr-3">
                  {a.callsign || a.icao} Squawk {a.squawk}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleCenterOnReceiver}
          className="absolute bottom-6 left-4 z-[1000] p-3 rounded-xl flex items-center gap-2"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}
        >
          <Crosshair className="h-4 w-4 text-cyan-500" />
          <span className="text-sm text-white">Center</span>
        </button>

        <div className="absolute bottom-6 left-28 z-[1000] px-3 py-2 rounded-xl text-sm"
             style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
          <span className="text-zinc-400">{aircraftWithPosition.length} aircraft in view</span>
        </div>

        <MapContainer
          center={defaultCenter}
          zoom={9}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <MapUpdater center={mapCenter} zoom={mapZoom} />

          {receiver?.lat && receiver?.lon && (
            <Circle
              center={[receiver.lat, receiver.lon]}
              radius={500}
              pathOptions={{
                color: COLORS.cyan,
                fillColor: COLORS.cyan,
                fillOpacity: 0.3,
                weight: 2,
              }}
            />
          )}

          {selectedTrail.length > 1 && (
            <Polyline
              positions={selectedTrail.map(p => [p.lat, p.lon] as [number, number])}
              pathOptions={{
                color: COLORS.cyan,
                weight: 2,
                opacity: 0.7,
                dashArray: "5, 5",
              }}
            />
          )}

          {aircraftWithPosition.map(ac => {
            const isSelected = ac.icao === selectedIcao
            const isEmergency = ["7500", "7600", "7700"].includes(ac.squawk || "")
            
            return (
              <Marker
                key={ac.icao}
                position={[ac.lat!, ac.lon!]}
                icon={createAircraftIcon(ac.heading || 0, isSelected, isEmergency)}
                eventHandlers={{
                  click: () => handleAircraftClick(ac),
                }}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="font-bold text-base mb-1">{ac.callsign || ac.icao}</div>
                    <div className="text-xs text-zinc-400 mb-2">{ac.registration} • {ac.aircraft_type}</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>Alt: <span className="font-mono">{ac.alt_ft?.toLocaleString() ?? "-"} ft</span></div>
                      <div>Spd: <span className="font-mono">{ac.speed_kt ?? "-"} kt</span></div>
                      <div>Hdg: <span className="font-mono">{ac.heading ?? "-"}°</span></div>
                      <div>Dist: <span className="font-mono">{ac.distance_nm?.toFixed(1) ?? "-"} nm</span></div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      <div className="w-[400px] flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.card, borderLeft: `1px solid ${COLORS.cardBorder}` }}>
        <div className="p-4 border-b" style={{ borderColor: COLORS.cardBorder }}>
          <div className="flex items-center gap-2 mb-3">
            <Plane className="h-5 w-5 text-cyan-500" />
            <span className="text-lg font-semibold text-white">Live Aircraft</span>
            <span className="text-sm text-zinc-500 ml-auto">{aircraft.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-500"
              style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredAircraft.length > 0 ? (
            <div className="divide-y" style={{ borderColor: COLORS.bg }}>
              {filteredAircraft.map(ac => {
                const isSelected = ac.icao === selectedIcao
                const isEmergency = ["7500", "7600", "7700"].includes(ac.squawk || "")
                const hasPosition = ac.lat && ac.lon
                
                return (
                  <div
                    key={ac.icao}
                    onClick={() => hasPosition && handleAircraftClick(ac)}
                    className={`p-3 cursor-pointer transition-colors ${hasPosition ? 'hover:bg-white/5' : 'opacity-50'}`}
                    style={{ 
                      backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                      borderLeft: isSelected ? `3px solid ${COLORS.cyan}` : '3px solid transparent'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-medium text-white">
                        {ac.callsign || ac.icao}
                      </span>
                      {isEmergency && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 font-mono">
                          {ac.squawk}
                        </span>
                      )}
                      {!isEmergency && ac.squawk && (
                        <span className="text-xs text-zinc-600 font-mono">{ac.squawk}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                      <span>{ac.registration || "-"}</span>
                      <span>•</span>
                      <span className="font-mono">{ac.aircraft_type || "-"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-400">
                        {ac.on_ground ? (
                          <span className="text-orange-400">GND</span>
                        ) : (
                          <>{ac.alt_ft?.toLocaleString() ?? "-"} ft</>
                        )}
                      </span>
                      <span className="text-zinc-500">{ac.speed_kt ?? "-"} kt</span>
                      {ac.distance_nm && (
                        <span style={{ color: COLORS.cyan }}>{ac.distance_nm.toFixed(1)} nm</span>
                      )}
                      {ac.bearing_cardinal && (
                        <span className="text-zinc-600">{ac.bearing_cardinal}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-zinc-600">
              No aircraft
            </div>
          )}
        </div>

        {selectedAircraft && (
          <div className="p-4 border-t" style={{ borderColor: COLORS.cardBorder, backgroundColor: COLORS.bg }}>
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-medium text-zinc-300">Selected Aircraft</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-white font-mono">
                  {selectedAircraft.callsign || selectedAircraft.icao}
                </span>
                <span className="text-xs text-zinc-500">{selectedAircraft.icao}</span>
              </div>
              <div className="text-sm text-zinc-400">
                {selectedAircraft.registration} • {selectedAircraft.aircraft_type}
              </div>
              {selectedAircraft.operator && (
                <div className="text-xs text-zinc-500">{selectedAircraft.operator}</div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.card }}>
                  <div className="text-xs text-zinc-500 mb-1">Altitude</div>
                  <div className="font-mono text-white">
                    {selectedAircraft.on_ground ? "GND" : `${selectedAircraft.alt_ft?.toLocaleString() ?? "-"} ft`}
                  </div>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.card }}>
                  <div className="text-xs text-zinc-500 mb-1">Speed</div>
                  <div className="font-mono text-white">{selectedAircraft.speed_kt ?? "-"} kt</div>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.card }}>
                  <div className="text-xs text-zinc-500 mb-1">Heading</div>
                  <div className="font-mono text-white">{selectedAircraft.heading ?? "-"}°</div>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.card }}>
                  <div className="text-xs text-zinc-500 mb-1">Distance</div>
                  <div className="font-mono" style={{ color: COLORS.cyan }}>
                    {selectedAircraft.distance_nm?.toFixed(1) ?? "-"} nm
                  </div>
                </div>
              </div>
              {selectedAircraft.vertical_rate && (
                <div className="text-xs mt-2">
                  <span className="text-zinc-500">V/S: </span>
                  <span className={selectedAircraft.vertical_rate > 0 ? "text-green-400" : "text-red-400"}>
                    {selectedAircraft.vertical_rate > 0 ? "+" : ""}{selectedAircraft.vertical_rate} fpm
                  </span>
                </div>
              )}
              {selectedTrail.length > 0 && (
                <div className="text-xs text-zinc-500 mt-2">
                  Trail: {selectedTrail.length} points
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

