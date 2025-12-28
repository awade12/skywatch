import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis } from "recharts"
import type { HourlyStat, DailyStat } from "./types"
import { COLORS } from "./types"

interface ActivityChartsProps {
  hourly: HourlyStat[]
  daily: DailyStat[]
}

export function ActivityCharts({ hourly, daily }: ActivityChartsProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-6">
      <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
        <div className="text-sm font-medium text-zinc-300 mb-4">Hourly Activity (24h)</div>
        <div className="h-[180px]">
          {hourly.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} tickFormatter={(v) => v.split("T")[1]?.slice(0, 5) || v} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} width={30} />
                <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} fill="url(#hourlyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600">No data</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}` }}>
        <div className="text-sm font-medium text-zinc-300 mb-4">Daily Activity (7 days)</div>
        <div className="h-[180px]">
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: COLORS.textDim, fontSize: 10 }} width={40} />
                <Bar dataKey="unique_aircraft" fill={COLORS.cyan} radius={[4, 4, 0, 0]} name="Aircraft" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600">No data</div>
          )}
        </div>
        {daily.length > 0 && (
          <div className="flex gap-4 mt-2 text-xs text-zinc-500">
            <span>Yesterday: {daily[0]?.unique_aircraft ?? 0} aircraft, {daily[0]?.total_positions?.toLocaleString() ?? 0} positions</span>
          </div>
        )}
      </div>
    </div>
  )
}

