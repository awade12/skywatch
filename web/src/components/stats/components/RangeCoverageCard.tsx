import { Radar } from "lucide-react"
import { type RangeStats } from "./types"

interface RangeCoverageCardProps {
  rangeStats: RangeStats | null
}

export function RangeCoverageCard({ rangeStats }: RangeCoverageCardProps) {
  if (!rangeStats) return null

  const buckets = rangeStats.buckets?.slice(0, 36) || []
  const maxRange = rangeStats.all_time_max_nm || 1

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
            <Radar className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-200">Range Coverage</div>
            <div className="text-xs text-zinc-500">Reception distance by bearing</div>
          </div>
        </div>

        <div className="flex-1 flex gap-6">
          <div className="flex-shrink-0 relative">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#1c1c22" strokeWidth="1" />
              <circle cx="80" cy="80" r="52" fill="none" stroke="#1c1c22" strokeWidth="1" strokeDasharray="2 4" />
              <circle cx="80" cy="80" r="35" fill="none" stroke="#1c1c22" strokeWidth="1" strokeDasharray="2 4" />
              
              <line x1="80" y1="10" x2="80" y2="150" stroke="#232329" strokeWidth="1" />
              <line x1="10" y1="80" x2="150" y2="80" stroke="#232329" strokeWidth="1" />
              
              {buckets.map((b, i) => {
                const angle = (b.bearing - 90) * (Math.PI / 180)
                const normalizedRange = b.max_range_nm / maxRange
                const radius = 10 + normalizedRange * 60
                const x = 80 + Math.cos(angle) * radius
                const y = 80 + Math.sin(angle) * radius
                const dotSize = b.max_range_nm > 0 ? 3 : 1.5
                
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={dotSize}
                    fill={b.max_range_nm > 0 ? "#52525b" : "#27272a"}
                  />
                )
              })}
              
              {buckets.length > 0 && (
                <polygon
                  points={buckets.map((b, i) => {
                    const angle = (b.bearing - 90) * (Math.PI / 180)
                    const normalizedRange = b.max_range_nm / maxRange
                    const radius = 10 + normalizedRange * 60
                    const x = 80 + Math.cos(angle) * radius
                    const y = 80 + Math.sin(angle) * radius
                    return `${x},${y}`
                  }).join(' ')}
                  fill="rgba(82, 82, 91, 0.15)"
                  stroke="#52525b"
                  strokeWidth="1.5"
                />
              )}
              
              <circle cx="80" cy="80" r="4" fill="#3f3f46" />
              
              <text x="80" y="8" textAnchor="middle" fontSize="8" fill="#52525b">N</text>
              <text x="152" y="83" textAnchor="middle" fontSize="8" fill="#52525b">E</text>
              <text x="80" y="158" textAnchor="middle" fontSize="8" fill="#52525b">S</text>
              <text x="8" y="83" textAnchor="middle" fontSize="8" fill="#52525b">W</text>
            </svg>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-5">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Max Range</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-zinc-200">{rangeStats.all_time_max_nm?.toFixed(0) ?? "0"}</span>
                <span className="text-sm text-zinc-500">nm</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{rangeStats.all_time_max_icao || "-"}</div>
            </div>

            <div 
              className="pt-4"
              style={{ borderTop: "1px solid #232329" }}
            >
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Contacts</div>
              <div className="text-xl font-medium text-zinc-200">{rangeStats.total_contacts?.toLocaleString() ?? "0"}</div>
            </div>
          </div>
        </div>

        <div 
          className="px-6 pb-4 text-[10px] text-zinc-600"
        >
          Gaps indicate directions where terrain may be blocking signals.
        </div>
      </div>
    </div>
  )
}
