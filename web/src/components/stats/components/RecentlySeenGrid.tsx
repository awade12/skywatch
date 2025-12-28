import type { RecentAircraft } from "./types"
import { COLORS } from "./types"

interface RecentlySeenGridProps {
  recent: RecentAircraft[]
}

export function RecentlySeenGrid({ recent }: RecentlySeenGridProps) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
      <div className="text-sm font-medium text-zinc-300 mb-4">Recently Seen ({recent.length})</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {recent.slice(0, 12).map((a) => (
          <div key={a.icao + a.last_seen} className="p-3 rounded-xl" style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-white text-sm">{a.callsign || a.icao}</span>
              <span className="text-xs text-zinc-600">{a.aircraft_type}</span>
            </div>
            <div className="text-xs text-zinc-500 truncate">{a.registration} • {a.operator || "-"}</div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-zinc-600">{a.alt_ft?.toLocaleString() ?? "-"} ft</span>
              <span className="text-zinc-600">{a.speed_kt ?? "-"} kt</span>
              <span className="text-zinc-500">{new Date(a.last_seen).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

