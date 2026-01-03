import { Server, Cpu, HardDrive, Thermometer } from "lucide-react"
import { type ReceiverHealth } from "./types"

interface SystemHealthCardProps {
  health: ReceiverHealth | null
}

function ProgressBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value > 80 ? "#ef4444" : value > 60 ? "#f59e0b" : "#10b981"
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-xs font-mono text-zinc-300">
          {value.toFixed(1)}%
          {suffix && <span className="text-zinc-500 ml-1">({suffix})</span>}
        </span>
      </div>
      <div 
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "#1c1c22" }}
      >
        <div 
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function SystemHealthCard({ health }: SystemHealthCardProps) {
  const temp = health?.temp_celsius ?? 0
  const tempColor = temp > 70 ? "text-red-400" : temp > 60 ? "text-amber-400" : "text-zinc-200"

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
            <Server className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">System Health</div>
            <div className="text-xs text-zinc-500">Resource usage</div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <ProgressBar 
            label="CPU" 
            value={health?.cpu_percent ?? 0} 
          />
          <ProgressBar 
            label="Memory" 
            value={health?.memory_percent ?? 0}
            suffix={`${health?.memory_used_mb ?? 0}/${health?.memory_total_mb ?? 0} MB`}
          />

          <div 
            className="pt-4 space-y-3"
            style={{ borderTop: "1px solid #232329" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-500">
                <Thermometer className="w-3.5 h-3.5" />
                <span className="text-xs">Temperature</span>
              </div>
              <span className={`text-sm font-mono ${tempColor}`}>
                {health?.temp_celsius?.toFixed(1) ?? "-"}°C
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Goroutines</span>
              <span className="text-sm font-mono text-zinc-300">{health?.goroutines ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Platform</span>
              <span className="text-xs font-mono text-zinc-500">{health?.platform ?? "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

