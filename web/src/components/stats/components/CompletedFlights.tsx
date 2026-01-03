import { Navigation } from "lucide-react"
import type { FlightRecord } from "./types"

interface CompletedFlightsProps {
  flights: FlightRecord[]
}

export function CompletedFlights({ flights }: CompletedFlightsProps) {
  if (flights.length === 0) return null

  return (
    <div 
      className="rounded-2xl overflow-hidden mb-6"
      style={{ backgroundColor: "#141418", border: "1px solid #232329" }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <Navigation className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Completed Flights</div>
            <div className="text-xs text-zinc-500">{flights.length} flights tracked</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #232329" }}>
                <th className="text-left py-2.5 px-2 font-medium text-zinc-500">Callsign</th>
                <th className="text-left py-2.5 px-2 font-medium text-zinc-500">Registration</th>
                <th className="text-left py-2.5 px-2 font-medium text-zinc-500">Type</th>
                <th className="text-right py-2.5 px-2 font-medium text-zinc-500">Max Alt</th>
                <th className="text-right py-2.5 px-2 font-medium text-zinc-500">Distance</th>
                <th className="text-right py-2.5 px-2 font-medium text-zinc-500">Duration</th>
                <th className="text-left py-2.5 px-2 font-medium text-zinc-500">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {flights.slice(0, 10).map((f) => {
                const duration = new Date(f.last_seen).getTime() - new Date(f.first_seen).getTime()
                const mins = Math.floor(duration / 60000)
                return (
                  <tr 
                    key={f.id} 
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid #1c1c22" }}
                  >
                    <td className="py-2.5 px-2 font-mono text-zinc-200">{f.callsign || f.icao}</td>
                    <td className="py-2.5 px-2 text-zinc-400">{f.registration || "-"}</td>
                    <td className="py-2.5 px-2 font-mono text-zinc-400">{f.aircraft_type || "-"}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-300">{f.max_alt_ft?.toLocaleString() ?? "-"}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-300">{f.total_dist_nm?.toFixed(1) ?? "-"} nm</td>
                    <td className="py-2.5 px-2 text-right font-mono text-zinc-500">{mins}m</td>
                    <td className="py-2.5 px-2 text-zinc-500">{new Date(f.last_seen).toLocaleTimeString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
