import { History } from "lucide-react"
import type { RecentAircraft } from "./types"

interface RecentlySeenGridProps {
  recent: RecentAircraft[]
}

export function RecentlySeenGrid({ recent }: RecentlySeenGridProps) {
  const grouped = {
    now: recent.filter(a => {
      const mins = Math.floor((Date.now() - new Date(a.last_seen).getTime()) / 60000)
      return mins < 5
    }),
    recent: recent.filter(a => {
      const mins = Math.floor((Date.now() - new Date(a.last_seen).getTime()) / 60000)
      return mins >= 5 && mins < 30
    }),
    older: recent.filter(a => {
      const mins = Math.floor((Date.now() - new Date(a.last_seen).getTime()) / 60000)
      return mins >= 30
    }),
  }

  return (
    <div 
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#141418", border: "1px solid #232329" }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <History className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Recently Seen</div>
            <div className="text-xs text-zinc-500">{recent.length} aircraft in history</div>
          </div>
        </div>

        {recent.length > 0 ? (
          <div className="space-y-5">
            {grouped.now.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Last 5 minutes</span>
                  <span className="text-[10px] text-zinc-600">({grouped.now.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.now.slice(0, 12).map((a) => (
                    <div 
                      key={a.icao + a.last_seen}
                      className="px-2.5 py-1.5 rounded-md text-xs font-mono"
                      style={{ backgroundColor: "#1c1c22" }}
                    >
                      <span className="text-zinc-200">{a.callsign || a.icao}</span>
                      {a.aircraft_type && <span className="text-zinc-600 ml-1.5">{a.aircraft_type}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {grouped.recent.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">5-30 minutes ago</span>
                  <span className="text-[10px] text-zinc-600">({grouped.recent.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.recent.slice(0, 16).map((a) => (
                    <div 
                      key={a.icao + a.last_seen}
                      className="px-2.5 py-1.5 rounded-md text-xs font-mono"
                      style={{ backgroundColor: "#1c1c22" }}
                    >
                      <span className="text-zinc-300">{a.callsign || a.icao}</span>
                      {a.aircraft_type && <span className="text-zinc-600 ml-1.5">{a.aircraft_type}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {grouped.older.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">30+ minutes ago</span>
                  <span className="text-[10px] text-zinc-600">({grouped.older.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.older.slice(0, 20).map((a) => (
                    <div 
                      key={a.icao + a.last_seen}
                      className="px-2.5 py-1.5 rounded-md text-xs font-mono"
                      style={{ backgroundColor: "#1c1c22" }}
                    >
                      <span className="text-zinc-500">{a.callsign || a.icao}</span>
                      {a.aircraft_type && <span className="text-zinc-700 ml-1.5">{a.aircraft_type}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-600">
            No recent aircraft
          </div>
        )}
      </div>
    </div>
  )
}
