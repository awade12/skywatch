import { TrendingUp, Clock, BarChart3, Timer } from "lucide-react"
import { type PeakStats } from "./types"

interface PeakActivityCardProps {
  peakStats: PeakStats | null
}

export function PeakActivityCard({ peakStats }: PeakActivityCardProps) {
  if (!peakStats) return null

  return (
    <div 
      className="rounded-2xl overflow-hidden h-full"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <TrendingUp className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Peak Activity</div>
            <div className="text-xs text-zinc-500">Historical highs</div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4">
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <div className="flex items-center gap-1.5 text-zinc-500 mb-2">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Busiest Hour</span>
            </div>
            <div className="text-2xl font-medium text-zinc-200">{peakStats.busiest_hour_count}</div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {peakStats.busiest_hour ? new Date(peakStats.busiest_hour).toLocaleString() : "-"}
            </div>
          </div>

          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <div className="flex items-center gap-1.5 text-zinc-500 mb-2">
              <BarChart3 className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Busiest Day</span>
            </div>
            <div className="text-2xl font-medium text-zinc-200">{peakStats.busiest_day_count}</div>
            <div className="text-[10px] text-zinc-500 mt-1">{peakStats.busiest_day || "-"}</div>
          </div>

          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Avg/Hour</div>
            <div className="text-xl font-mono text-zinc-200">{peakStats.avg_aircraft_per_hour?.toFixed(1) ?? "0"}</div>
          </div>

          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <div className="flex items-center gap-1.5 text-zinc-500 mb-2">
              <Timer className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Hours Tracked</span>
            </div>
            <div className="text-xl font-mono text-zinc-200">{peakStats.total_hours_tracked ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

