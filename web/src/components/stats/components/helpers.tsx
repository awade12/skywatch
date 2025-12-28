import { COLORS } from "./types"

export function DbStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-zinc-500 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-xl font-bold text-white font-mono">{value?.toLocaleString() ?? "-"}</div>
    </div>
  )
}

export function HealthBar({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value > 80 ? COLORS.red : value > 60 ? COLORS.orange : COLORS.green
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-zinc-500">{label}</span>
        <span className="font-mono text-sm text-white">{value.toFixed(1)}%{suffix && <span className="text-zinc-500 text-xs ml-1">({suffix})</span>}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function MsgTypeStat({ label, sublabel, value, color = COLORS.textMuted }: { label: string; sublabel: string; value: number; color?: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: COLORS.bg }}>
      <div className="text-xs font-bold" style={{ color }}>{label}</div>
      <div className="text-[10px] text-zinc-600 mb-1">{sublabel}</div>
      <div className="font-mono text-sm text-white">{value?.toLocaleString() ?? "0"}</div>
    </div>
  )
}

