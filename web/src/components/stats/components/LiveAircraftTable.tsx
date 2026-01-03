import { useState } from "react"
import { Plane, Search, TrendingUp, TrendingDown } from "lucide-react"
import type { Aircraft } from "./types"

interface LiveAircraftTableProps {
  aircraft: Aircraft[]
}

export function LiveAircraftTable({ aircraft }: LiveAircraftTableProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredAircraft = aircraft.filter(a => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.icao?.toLowerCase().includes(q) ||
      a.callsign?.toLowerCase().includes(q) ||
      a.registration?.toLowerCase().includes(q) ||
      a.aircraft_type?.toLowerCase().includes(q) ||
      a.operator?.toLowerCase().includes(q)
    )
  })

  return (
    <div 
      className="rounded-2xl overflow-hidden mb-6"
      style={{ backgroundColor: "#141418", border: "1px solid #232329" }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Plane className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">Live Aircraft</div>
              <div className="text-xs text-zinc-500">{aircraft.length} currently tracked</div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 w-48 outline-none focus:ring-1 focus:ring-zinc-700"
              style={{ backgroundColor: "#1c1c22", border: "1px solid #232329" }}
            />
          </div>
        </div>

        {filteredAircraft.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredAircraft.slice(0, 12).map((a) => {
              const isEmergency = a.squawk && ["7500", "7600", "7700"].includes(a.squawk)
              const isClimbing = a.vertical_rate && a.vertical_rate > 100
              const isDescending = a.vertical_rate && a.vertical_rate < -100
              
              return (
                <div 
                  key={a.icao}
                  className="rounded-xl overflow-hidden"
                  style={{ 
                    backgroundColor: "#1c1c22",
                    border: isEmergency ? "1px solid #ef4444" : "1px solid #232329",
                  }}
                >
                  <div 
                    className="h-1"
                    style={{ 
                      backgroundColor: isEmergency 
                        ? "#ef4444" 
                        : a.on_ground 
                          ? "#f59e0b" 
                          : "#10b981",
                    }}
                  />
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-mono text-sm text-zinc-100 font-medium tracking-wide">
                        {a.callsign || a.icao}
                      </div>
                      <div 
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "#141418" }}
                      >
                        <span className="text-zinc-400">{a.aircraft_type || "N/A"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-zinc-500">{a.registration || "-"}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-600 truncate">{a.operator || "Unknown"}</span>
                    </div>

                    <div 
                      className="pt-3 grid grid-cols-3 gap-2"
                      style={{ borderTop: "1px solid #232329" }}
                    >
                      <div>
                        <div className="text-[9px] text-zinc-600 uppercase mb-1">Alt</div>
                        <div className="flex items-center gap-1">
                          {a.on_ground ? (
                            <span className="text-xs font-mono text-amber-400">GND</span>
                          ) : (
                            <span className="text-xs font-mono text-zinc-200">{a.alt_ft?.toLocaleString() ?? "-"}</span>
                          )}
                          {isClimbing && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                          {isDescending && <TrendingDown className="w-3 h-3 text-red-400" />}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-zinc-600 uppercase mb-1">Spd</div>
                        <span className="text-xs font-mono text-zinc-300">{a.speed_kt ?? "-"}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-zinc-600 uppercase mb-1">Dist</div>
                        <span className="text-xs font-mono text-zinc-400">{a.distance_nm?.toFixed(0) ?? "-"} nm</span>
                      </div>
                    </div>

                    {isEmergency && (
                      <div 
                        className="mt-3 pt-2 text-center"
                        style={{ borderTop: "1px solid #232329" }}
                      >
                        <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                          Squawk {a.squawk}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-zinc-600">
            {searchQuery ? "No matching aircraft" : "No aircraft in range"}
          </div>
        )}
      </div>
    </div>
  )
}
