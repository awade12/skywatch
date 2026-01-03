import { Activity } from "lucide-react"
import { type FeedStatus } from "./types"

interface MessageTypesCardProps {
  feed: FeedStatus | null
}

function TypeBlock({ label, sublabel, value, highlight }: { label: string; sublabel: string; value: number; highlight?: boolean }) {
  return (
    <div 
      className="p-3 rounded-lg text-center"
      style={{ backgroundColor: "#1c1c22" }}
    >
      <div className={`text-xs font-medium mb-0.5 ${highlight ? "text-emerald-400" : "text-zinc-400"}`}>{label}</div>
      <div className="text-[10px] text-zinc-600 mb-1.5">{sublabel}</div>
      <div className="text-sm font-mono text-zinc-200">{value?.toLocaleString() ?? "0"}</div>
    </div>
  )
}

export function MessageTypesCard({ feed }: MessageTypesCardProps) {
  if (!feed?.message_types) return null

  const mt = feed.message_types

  return (
    <div 
      className="rounded-2xl overflow-hidden mb-6"
      style={{ 
        backgroundColor: "#141418",
        border: "1px solid #232329",
      }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1c1c22" }}
          >
            <Activity className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Message Types</div>
            <div className="text-xs text-zinc-500">SBS message breakdown</div>
          </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          <TypeBlock label="MSG1" sublabel="ID" value={mt.msg1_id} />
          <TypeBlock label="MSG2" sublabel="Surface" value={mt.msg2_surface} />
          <TypeBlock label="MSG3" sublabel="Airborne" value={mt.msg3_airborne} highlight />
          <TypeBlock label="MSG4" sublabel="Velocity" value={mt.msg4_velocity} highlight />
          <TypeBlock label="MSG5" sublabel="Surv Alt" value={mt.msg5_surv_alt} />
          <TypeBlock label="MSG6" sublabel="Surv ID" value={mt.msg6_surv_id} />
          <TypeBlock label="MSG7" sublabel="Air2Air" value={mt.msg7_air2air} />
          <TypeBlock label="MSG8" sublabel="AllCall" value={mt.msg8_allcall} />
        </div>

        <div 
          className="mt-5 pt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs"
          style={{ borderTop: "1px solid #232329" }}
        >
          <div>
            <span className="text-zinc-500">Valid:</span>
            <span className="text-emerald-400 font-mono ml-1.5">{feed.valid_messages?.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500">Invalid:</span>
            <span className="text-red-400 font-mono ml-1.5">{feed.invalid_messages?.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500">Position:</span>
            <span className="text-zinc-300 font-mono ml-1.5">{feed.position_messages?.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-zinc-500">Velocity:</span>
            <span className="text-zinc-300 font-mono ml-1.5">{feed.velocity_messages?.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

