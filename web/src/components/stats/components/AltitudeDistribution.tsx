import { Layers } from "lucide-react"
import { type AltitudeDistribution as AltitudeDistributionType } from "./types"

interface AltitudeDistributionProps {
  altitude: AltitudeDistributionType | null
}

const COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6"]

export function AltitudeDistribution({ altitude }: AltitudeDistributionProps) {
  const data = altitude ? [
    { name: "Low", value: altitude.low ?? 0, range: "0-10k ft" },
    { name: "Medium", value: altitude.medium ?? 0, range: "10-25k ft" },
    { name: "High", value: altitude.high ?? 0, range: "25k+ ft" },
  ].filter(d => d.value > 0) : []

  const total = data.reduce((sum, d) => sum + d.value, 0)

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
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Altitude Distribution</div>
            <div className="text-xs text-zinc-500">Position reports by altitude</div>
          </div>
        </div>

        <div className="flex-1">
          {data.length > 0 ? (
            <div className="space-y-4">
              {data.map((d, i) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS[i] }}
                      />
                      <span className="text-xs text-zinc-400">{d.name}</span>
                      <span className="text-[10px] text-zinc-600">({d.range})</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-300">{d.value.toLocaleString()}</span>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "#1c1c22" }}
                  >
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${(d.value / total) * 100}%`,
                        backgroundColor: COLORS[i],
                      }}
                    />
                  </div>
                </div>
              ))}
              <div 
                className="pt-3 text-xs text-zinc-500"
                style={{ borderTop: "1px solid #232329" }}
              >
                Total: {total.toLocaleString()} reports
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-zinc-600">
              No altitude data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

