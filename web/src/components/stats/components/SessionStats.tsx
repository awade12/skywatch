import { Plane, Radar, Clock, ArrowUpRight } from "lucide-react"
import { COLORS, type Stats, type HealthStatus } from "./types"

interface SessionStatsProps {
  stats: Stats | null
  healthStatus: HealthStatus | null
}

export function SessionStats({ stats, healthStatus }: SessionStatsProps) {
  const liveCount = stats?.aircraft_now ?? 0
  const totalSeen = stats?.total_seen ?? 0
  const maxRange = stats?.max_range_nm ?? 0
  const uptime = stats?.uptime ?? "-"
  const isReady = healthStatus?.ready ?? false

  return (
    <div 
      className="lg:col-span-2 rounded-2xl overflow-hidden"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Radar className="w-4.5 h-4.5 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">Session Monitor</div>
              <div className="text-xs text-zinc-500">Real-time aircraft tracking</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={`w-1.5 h-1.5 rounded-full ${isReady ? "bg-emerald-400" : "bg-amber-400"}`}
              style={{ boxShadow: isReady ? "0 0 6px #34d399" : "0 0 6px #fbbf24" }}
            />
            <span className="text-xs text-zinc-500 font-medium">
              {isReady ? "Online" : "Starting"}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-zinc-500 mb-2">Currently Tracking</div>
            <div className="flex items-baseline gap-2">
              <span 
                className="text-6xl font-semibold tracking-tight"
                style={{ color: "#f5f5f7" }}
              >
                {liveCount}
              </span>
              <span className="text-lg text-zinc-500 mb-1">aircraft</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div 
              className="px-3 py-2 rounded-lg flex items-center gap-2"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-medium text-zinc-300">{totalSeen.toLocaleString()}</span>
              <span className="text-xs text-zinc-500">total</span>
            </div>
          </div>
        </div>

        <div 
          className="mt-6 h-px w-full"
          style={{ backgroundColor: "#232329" }}
        />

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-zinc-500 mb-1.5">Max Range</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-medium text-zinc-200">{maxRange.toFixed(0)}</span>
              <span className="text-xs text-zinc-500">nm</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1.5">Uptime</div>
            <div className="text-xl font-mono text-zinc-200">{uptime}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1.5">Rate</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-medium text-zinc-200">
                {totalSeen > 0 ? (liveCount / totalSeen * 100).toFixed(1) : "0"}
              </span>
              <span className="text-xs text-zinc-500">%</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-1.5">
          {[...Array(24)].map((_, i) => {
            const threshold = Math.ceil((liveCount / 30) * 24)
            const isActive = i < threshold
            return (
              <div
                key={i}
                className="flex-1 h-1 rounded-sm transition-all duration-300"
                style={{
                  backgroundColor: isActive ? "#52525b" : "#27272a",
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
