import { Activity, Wifi, WifiOff } from "lucide-react"
import { type FeedStatus } from "./types"

interface FeedDetailsCardProps {
  feed: FeedStatus | null
}

export function FeedDetailsCard({ feed }: FeedDetailsCardProps) {
  const isConnected = feed?.connected ?? false

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
            <Activity className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Feed Details</div>
            <div className="text-xs text-zinc-500">Connection info</div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Connection</span>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={`text-xs font-medium ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Messages/sec</span>
            <span className="text-sm font-mono text-zinc-300">{feed?.messages_per_sec?.toFixed(2) ?? "-"}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Total Messages</span>
            <span className="text-sm font-mono text-zinc-300">{feed?.messages_total?.toLocaleString() ?? "-"}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Reconnects</span>
            <span className={`text-sm font-mono ${(feed?.reconnects ?? 0) > 0 ? "text-amber-400" : "text-zinc-300"}`}>
              {feed?.reconnects ?? "0"}
            </span>
          </div>

          <div 
            className="pt-3 space-y-3"
            style={{ borderTop: "1px solid #232329" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Format</span>
              <span className="text-xs font-mono text-zinc-400 uppercase">{feed?.format ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Source</span>
              <span className="text-xs font-mono text-zinc-400">{feed?.host ?? "-"}:{feed?.port ?? "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

