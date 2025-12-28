import { useState } from "react"
import { Search } from "lucide-react"
import type { Aircraft } from "./types"
import { COLORS } from "./types"

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
    <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-zinc-300">Live Aircraft ({aircraft.length})</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search callsign, reg, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-500 w-64"
            style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Callsign</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">ICAO</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Reg</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Type</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Alt (ft)</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Spd (kt)</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Hdg</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">V/S</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Dist</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Brg</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Sqk</th>
            </tr>
          </thead>
          <tbody>
            {filteredAircraft.length > 0 ? filteredAircraft.slice(0, 15).map((a) => (
              <tr key={a.icao} style={{ borderBottom: `1px solid ${COLORS.bg}` }} className="hover:bg-white/[0.02]">
                <td className="py-2 px-2 font-mono text-white">{a.callsign || "-"}</td>
                <td className="py-2 px-2 font-mono text-xs text-zinc-500">{a.icao}</td>
                <td className="py-2 px-2 text-zinc-400">{a.registration || "-"}</td>
                <td className="py-2 px-2 font-mono text-zinc-400">{a.aircraft_type || "-"}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {a.on_ground ? <span className="text-orange-400">GND</span> : <span className="text-white">{a.alt_ft?.toLocaleString() ?? "-"}</span>}
                </td>
                <td className="py-2 px-2 text-right font-mono text-white">{a.speed_kt ?? "-"}</td>
                <td className="py-2 px-2 text-right font-mono text-zinc-400">{a.heading ? `${a.heading}°` : "-"}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {a.vertical_rate ? (
                    <span className={a.vertical_rate > 0 ? "text-green-400" : "text-red-400"}>
                      {a.vertical_rate > 0 ? "+" : ""}{a.vertical_rate}
                    </span>
                  ) : <span className="text-zinc-600">-</span>}
                </td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: COLORS.cyan }}>{a.distance_nm?.toFixed(1) ?? "-"}</td>
                <td className="py-2 px-2 text-zinc-400">{a.bearing_cardinal ?? "-"}</td>
                <td className="py-2 px-2">
                  {a.squawk ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                      ["7500", "7600", "7700"].includes(a.squawk) ? "bg-red-500/20 text-red-400" : "text-zinc-400"
                    }`}>{a.squawk}</span>
                  ) : <span className="text-zinc-600">-</span>}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="py-8 text-center text-zinc-600">No aircraft</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

