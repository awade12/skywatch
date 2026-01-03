import { Radio } from "lucide-react"
import { type ReceiverInfo } from "./types"

interface NodeCardProps {
  receiver: ReceiverInfo | null
}

export function NodeCard({ receiver }: NodeCardProps) {
  const nodeName = receiver?.node_name ?? "Skywatch Node"
  
  return (
    <div 
      className="rounded-2xl overflow-hidden h-full"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <Radio className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ boxShadow: "0 0 6px #34d399" }}
            />
            <span className="text-xs text-zinc-500 font-medium">Online</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1.5">Receiver Node</div>
          <div className="text-xl font-medium text-zinc-200 leading-tight">{nodeName}</div>
        </div>

        <div 
          className="pt-4 mt-auto"
          style={{ borderTop: "1px solid #232329" }}
        >
          <div className="text-xs text-zinc-500">Primary receiver</div>
        </div>
      </div>
    </div>
  )
}
