import { Wifi, WifiOff, AlertCircle } from "lucide-react"
import { type FeedStatus } from "./types"

interface FeedStatusCardProps {
  feed: FeedStatus | null
}

export function FeedStatusCard({ feed }: FeedStatusCardProps) {
  const isConnected = feed?.connected ?? false
  const messagesPerSec = feed?.messages_per_sec ?? 0
  const messagesTotal = feed?.messages_total ?? 0
  const validMessages = feed?.valid_messages ?? 0
  const invalidMessages = feed?.invalid_messages ?? 0
  const reconnects = feed?.reconnects ?? 0
  const format = feed?.format?.toUpperCase() ?? "SBS"
  const host = feed?.host ?? "127.0.0.1"
  const port = feed?.port ?? 30003

  const errorRate = messagesTotal > 0 
    ? ((invalidMessages / messagesTotal) * 100).toFixed(2) 
    : "0.00"

  return (
    <div 
      className="rounded-2xl overflow-hidden h-full"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            {isConnected 
              ? <Wifi className="w-4 h-4 text-zinc-400" />
              : <WifiOff className="w-4 h-4 text-zinc-400" />
            }
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`}
              style={{ boxShadow: isConnected ? "0 0 6px #34d399" : "0 0 6px #f87171" }}
            />
            <span className="text-xs text-zinc-500 font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1">Message Rate</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-medium text-zinc-200">{messagesPerSec.toFixed(1)}</span>
            <span className="text-xs text-zinc-500">/sec</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div 
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Valid</div>
              <div className="text-sm font-medium text-zinc-300">{validMessages.toLocaleString()}</div>
            </div>
            <div 
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: "#1c1c22" }}
            >
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Errors</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-medium ${invalidMessages > 0 ? "text-amber-400" : "text-zinc-300"}`}>
                  {invalidMessages.toLocaleString()}
                </span>
                {invalidMessages > 0 && (
                  <span className="text-[10px] text-zinc-500">({errorRate}%)</span>
                )}
              </div>
            </div>
          </div>

          {reconnects > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" />
              <span>{reconnects} reconnect{reconnects > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        <div 
          className="pt-4 mt-auto flex items-center justify-between"
          style={{ borderTop: "1px solid #232329" }}
        >
          <div className="text-xs text-zinc-500 font-mono">{format} @ {host}:{port}</div>
          <div className="text-xs text-zinc-600">{messagesTotal.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
