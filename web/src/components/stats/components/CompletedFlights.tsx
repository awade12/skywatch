import { Navigation } from "lucide-react"
import type { FlightRecord } from "./types"
import { COLORS } from "./types"

interface CompletedFlightsProps {
  flights: FlightRecord[]
}

export function CompletedFlights({ flights }: CompletedFlightsProps) {
  if (flights.length === 0) return null

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Navigation className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-zinc-300">Completed Flights ({flights.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs">
              <th className="text-left py-2 px-2 font-medium">Callsign</th>
              <th className="text-left py-2 px-2 font-medium">Registration</th>
              <th className="text-left py-2 px-2 font-medium">Type</th>
              <th className="text-right py-2 px-2 font-medium">Max Alt</th>
              <th className="text-right py-2 px-2 font-medium">Distance</th>
              <th className="text-right py-2 px-2 font-medium">Duration</th>
              <th className="text-left py-2 px-2 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {flights.slice(0, 10).map((f) => {
              const duration = new Date(f.last_seen).getTime() - new Date(f.first_seen).getTime()
              const mins = Math.floor(duration / 60000)
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${COLORS.bg}` }} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-2 font-mono text-white">{f.callsign || f.icao}</td>
                  <td className="py-2 px-2 text-zinc-400">{f.registration || "-"}</td>
                  <td className="py-2 px-2 font-mono text-zinc-400">{f.aircraft_type || "-"}</td>
                  <td className="py-2 px-2 text-right font-mono text-white">{f.max_alt_ft?.toLocaleString() ?? "-"}</td>
                  <td className="py-2 px-2 text-right font-mono" style={{ color: COLORS.cyan }}>{f.total_dist_nm?.toFixed(1) ?? "-"} nm</td>
                  <td className="py-2 px-2 text-right font-mono text-zinc-400">{mins}m</td>
                  <td className="py-2 px-2 text-zinc-500 text-xs">{new Date(f.last_seen).toLocaleTimeString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

