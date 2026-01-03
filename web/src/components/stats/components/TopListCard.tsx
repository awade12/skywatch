import { Plane, Building2 } from "lucide-react"
import { type TypeStat, type OperatorStat } from "./types"

interface TopTypesCardProps {
  types: TypeStat[]
}

interface TopOperatorsCardProps {
  operators: OperatorStat[]
}

export function TopTypesCard({ types }: TopTypesCardProps) {
  const maxCount = types[0]?.count || 1

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
            <Plane className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Top Aircraft Types</div>
            <div className="text-xs text-zinc-500">Most seen in 24h</div>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {types.length > 0 ? types.map((t, i) => (
            <div key={t.aircraft_type} className="flex items-center gap-3">
              <span className="w-4 text-[10px] text-zinc-600 font-mono">{i + 1}</span>
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="text-xs text-zinc-300 font-mono truncate">{t.aircraft_type}</span>
                <span className="text-xs text-zinc-500 ml-2">{t.count}</span>
              </div>
              <div 
                className="w-20 h-1 rounded-full overflow-hidden flex-shrink-0"
                style={{ backgroundColor: "#1c1c22" }}
              >
                <div 
                  className="h-full rounded-full" 
                  style={{ 
                    width: `${(t.count / maxCount) * 100}%`, 
                    backgroundColor: "#3b82f6" 
                  }} 
                />
              </div>
            </div>
          )) : (
            <div className="flex items-center justify-center h-full text-sm text-zinc-600">
              No data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TopOperatorsCard({ operators }: TopOperatorsCardProps) {
  const maxCount = operators[0]?.count || 1

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
            <Building2 className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Top Operators</div>
            <div className="text-xs text-zinc-500">Most seen in 24h</div>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {operators.length > 0 ? operators.map((o, i) => (
            <div key={o.operator} className="flex items-center gap-3">
              <span className="w-4 text-[10px] text-zinc-600 font-mono">{i + 1}</span>
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="text-xs text-zinc-300 truncate max-w-[140px]">{o.operator}</span>
                <span className="text-xs text-zinc-500 ml-2">{o.count}</span>
              </div>
              <div 
                className="w-20 h-1 rounded-full overflow-hidden flex-shrink-0"
                style={{ backgroundColor: "#1c1c22" }}
              >
                <div 
                  className="h-full rounded-full" 
                  style={{ 
                    width: `${(o.count / maxCount) * 100}%`, 
                    backgroundColor: "#10b981" 
                  }} 
                />
              </div>
            </div>
          )) : (
            <div className="flex items-center justify-center h-full text-sm text-zinc-600">
              No operator data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

