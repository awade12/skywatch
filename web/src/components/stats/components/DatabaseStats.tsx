import { Database, Plane, MapPin, Layers, Clock, TrendingUp } from "lucide-react"
import { type OverallStats } from "./types"

interface DatabaseStatsProps {
  overall: OverallStats | null
}

function StatBlock({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div 
      className="p-4 rounded-xl text-center"
      style={{ backgroundColor: "#1c1c22" }}
    >
      <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-medium text-zinc-200 tabular-nums">
        {value?.toLocaleString() ?? "0"}
      </div>
    </div>
  )
}

export function DatabaseStats({ overall }: DatabaseStatsProps) {
  if (!overall) return null

  return (
    <div 
      className="rounded-2xl overflow-hidden mb-6"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Database className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">Database</div>
              <div className="text-xs text-zinc-500">Persisted records</div>
            </div>
          </div>
          <div 
            className="px-2.5 py-1 rounded-md text-xs"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <span className="text-emerald-400">●</span>
            <span className="text-zinc-500 ml-1.5">Connected</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBlock 
            label="Unique Aircraft" 
            value={overall.total_unique_aircraft} 
            icon={<Plane className="w-3.5 h-3.5" />} 
          />
          <StatBlock 
            label="Positions" 
            value={overall.total_positions} 
            icon={<MapPin className="w-3.5 h-3.5" />} 
          />
          <StatBlock 
            label="FAA Records" 
            value={overall.total_faa_records} 
            icon={<Layers className="w-3.5 h-3.5" />} 
          />
          <StatBlock 
            label="24h Positions" 
            value={overall.positions_last_24h} 
            icon={<Clock className="w-3.5 h-3.5" />} 
          />
          <StatBlock 
            label="24h Aircraft" 
            value={overall.aircraft_last_24h} 
            icon={<TrendingUp className="w-3.5 h-3.5" />} 
          />
        </div>
      </div>
    </div>
  )
}

