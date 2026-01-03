import { Server, CheckCircle2, XCircle } from "lucide-react"
import { type HealthStatus } from "./types"

interface ComponentReadinessProps {
  healthStatus: HealthStatus | null
}

export function ComponentReadiness({ healthStatus }: ComponentReadinessProps) {
  const isReady = healthStatus?.ready ?? false
  const components = healthStatus?.components 
    ? Object.entries(healthStatus.components) 
    : []

  const readyCount = components.filter(([_, state]) => state.ready).length
  const totalCount = components.length

  const formatName = (name: string) =>
    name.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")

  return (
    <div 
      className="rounded-2xl overflow-hidden"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <Server className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-200">System Components</div>
              <div className="text-xs text-zinc-500">Service health status</div>
            </div>
          </div>
          {healthStatus && (
            <div 
              className="px-2.5 py-1 rounded-md text-xs font-medium"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <span className={isReady ? "text-emerald-400" : "text-amber-400"}>
                {readyCount}/{totalCount}
              </span>
              <span className="text-zinc-500 ml-1">ready</span>
            </div>
          )}
        </div>

        {!healthStatus ? (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-sm text-zinc-500">Loading status...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {components.map(([name, state]) => (
              <div 
                key={name}
                className="flex items-center gap-2.5 p-2.5 rounded-lg"
                style={{ backgroundColor: "#1c1c22" }}
              >
                {state.ready ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-300 truncate">{formatName(name)}</div>
                  {!state.ready && state.message && (
                    <div className="text-[10px] text-red-400 truncate">{state.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

